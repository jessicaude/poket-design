import { create } from "zustand";
import {
  listSendRecipients, lookupPoketUser, saveDebitCard, savePayoutRecipient, savePoketUser, saveStablecoinWallet,
  type PoketUser, type SendRecipient, type WalletNetwork,
} from "@/lib/mock-api";
import { usePayout } from "../payout/usePayout";
import { holderName, useNgn } from "../ngn/useNgn";
import { toPayoutRecipient } from "./sources";
import { cardIssue, handleKind, initialsOf, routingBank, sortBank, validAddress } from "./sendMath";

/**
 * Send (docs/decisions.md: Send replaces the wallet's Transfer and Payout actions). Recipient-first: the recipients
 * screen, then the amount. Flow and copy from reference/poket-wallet-explore.html (savedPage, toScreen, the pickers);
 * the look is the wallet's. "+ New recipient" asks where to send:
 *   - Bank account: currency first. NGN continues in the existing bank step (bank picker, name enquiry); USD and GBP
 *     use the explore prototype's US and UK bank fields (a US bank's speed is chosen per send, on the amount screen).
 *   - Debit card: the explore prototype's card fields (number with the brand, name on card, billing ZIP). Visa and
 *     Mastercard debit cards only; credit cards can't receive payouts.
 *   - Poket user: @handle, email or phone, with a name lookup; recent: the reference Transfer's contacts.
 *   - Stablecoin wallet (Tier 2, as decided): coin and network, address (validated, start and end highlighted),
 *     optional nickname.
 * Every new recipient can be saved ("Save recipient", on by default). Every kind then goes on to the same amount,
 * review, PIN, reservation and status screens (features/wallet/payout).
 */
export type SendStage = "recipients" | "new" | "bankCurrency" | "usBank" | "ukBank" | "card" | "poketUser" | "wallet" | "coinPicker" | "tier2" | "unavailable";
export const isSendStage = (s: unknown): s is SendStage =>
  ["recipients", "new", "bankCurrency", "usBank", "ukBank", "card", "poketUser", "wallet", "coinPicker", "tier2", "unavailable"].includes(s as string);

export type UsDraft = { routing: string; acct: string; name: string; nick: string; save: boolean };
export type CardDraft = { num: string; name: string; zip: string; save: boolean };
export type UkDraft = { sort: string; acct: string; name: string; nick: string; save: boolean };
export type PoketDraft = { query: string; lookup: { status: "idle" | "resolving" | "found" | "notFound"; user?: PoketUser }; nick: string; save: boolean };
export type WalletDraft = { asset: "USDC" | "USDT"; net: WalletNetwork; address: string; nick: string; save: boolean };

const EMPTY_US: UsDraft = { routing: "", acct: "", name: "", nick: "", save: true };
const EMPTY_CARD: CardDraft = { num: "", name: "", zip: "", save: true };
const EMPTY_UK: UkDraft = { sort: "", acct: "", name: "", nick: "", save: true };
const EMPTY_POKET: PoketDraft = { query: "", lookup: { status: "idle" }, nick: "", save: true };
const EMPTY_WALLET: WalletDraft = { asset: "USDC", net: "Base", address: "", nick: "", save: true };

type State = {
  stage: SendStage | null;
  /**
   * The balance Send was opened from (a cvKey such as "cash:NGN:open", "cash:NGN:merchant", "cash:USD:fiat",
   * "coin:USDC:Base"), or null from the home (the NGN balance, the only one that can send so far).
   */
  source: string | null;
  /** Where Back leaves the Tier 2 screen: the recipients list (a saved wallet) or "where to send" (a new one). */
  tier2Back: SendStage;
  search: string;
  recipients: SendRecipient[];
  us: UsDraft;
  uk: UkDraft;
  card: CardDraft;
  poket: PoketDraft;
  wallet: WalletDraft;
  open: (source?: string | null) => void;
  close: () => void;
  back: () => void;
  setSearch: (q: string) => void;
  /** A saved recipient: straight to the amount. */
  choose: (r: SendRecipient) => void;
  newRecipient: () => void;
  addKind: (kind: "bank" | "card" | "poket" | "wallet") => void;
  pickCurrency: (cur: "NGN" | "USD" | "GBP") => void;
  editUs: (p: Partial<UsDraft>) => void;
  continueUs: () => Promise<void>;
  editUk: (p: Partial<UkDraft>) => void;
  continueUk: () => Promise<void>;
  editCard: (p: Partial<CardDraft>) => void;
  continueCard: () => Promise<void>;
  setPoketQuery: (q: string) => void;
  pickRecent: (u: PoketUser) => void;
  editPoket: (p: Partial<Pick<PoketDraft, "nick" | "save">>) => void;
  continuePoket: () => Promise<void>;
  pickCoin: (asset: "USDC" | "USDT", net: WalletNetwork) => void;
  editWallet: (p: Partial<WalletDraft>) => void;
  continueWallet: () => Promise<void>;
};

/**
 * Merchant-held naira can't be sent to a bank: choosing a bank account from it shows the "not available" screen
 * (with Convert). Every other source is handled on the amount screen, whose chip only offers balances that can pay
 * the recipient (features/wallet/send/sources.ts). Returns the action to take instead of continuing, or null.
 */
export function sourceBlock(source: string | null, r?: SendRecipient): (() => void) | null {
  if (source !== "cash:NGN:merchant") return null;
  if (r && r.kind !== "bank") return null;
  return () => useSend.setState({ stage: "unavailable" });
}
/** "US Dollar", "USDC on Base". */
export function sourceName(source: string): string {
  const [k, a, b] = source.split(":");
  if (k === "coin") return `${a} on ${b}`;
  return ({ USD: "US Dollar", NGN: "Nigerian Naira", EUR: "Euro", GBP: "British Pound", GHS: "Ghanaian Cedi" } as Record<string, string>)[a] ?? a;
}

/** The US bank form is complete (the explore prototype's ok, less the speed, now chosen per send). */
export function usReady(d: UsDraft): boolean {
  return !!routingBank(d.routing) && /^\d{6,17}$/.test(d.acct) && d.name.trim().length > 1;
}

/** The debit card form is complete: a Visa or Mastercard debit card (16 digits), a name, a 5-digit billing ZIP. */
export const cardReady = (d: CardDraft) => d.num.replace(/\D/g, "").length === 16 && !cardIssue(d.num) && d.name.trim().length > 1 && /^\d{5}$/.test(d.zip);

/** The UK bank form is complete (the explore prototype's ok): a known sort code, 8 digits, a holder name. */
export const ukReady = (d: UkDraft) => !!sortBank(d.sort) && /^\d{8}$/.test(d.acct) && d.name.trim().length > 1;

export const useSend = create<State>((set, get) => {
  let lookupId = 0;

  return {
    stage: null,
    source: null,
    tier2Back: "new",
    search: "",
    recipients: [],
    us: EMPTY_US,
    uk: EMPTY_UK,
    card: EMPTY_CARD,
    poket: EMPTY_POKET,
    wallet: EMPTY_WALLET,

    open: (source = null) => set({ stage: "recipients", search: "", recipients: listSendRecipients(), source }),
    close: () => set({ stage: null, search: "", source: null }),
    back: () => {
      const prev: Record<SendStage, SendStage | null> = {
        recipients: null, new: "recipients", bankCurrency: "new", usBank: "bankCurrency", ukBank: "bankCurrency", card: "new", poketUser: "new", wallet: "new", coinPicker: "wallet", tier2: "new", unavailable: "recipients",
      };
      const stage = get().stage;
      const to = stage === "tier2" ? get().tier2Back : stage ? prev[stage] : null;
      if (to === null) return get().close();
      set({ stage: to });
    },
    setSearch: (search) => set({ search }),

    choose: (r) => {
      const block = sourceBlock(get().source, r); // merchant-held naira and a bank account: "not available"
      if (block) return block();
      // Sending to external wallets needs Tier 2 (docs/decisions.md; the explore prototype's tier2Gate).
      if (r.kind === "wallet" && useNgn.getState().tier < 2) return set({ stage: "tier2", tier2Back: "recipients" });
      set({ stage: null }); // keep the source: Back and "Change" return to Send with it
      usePayout.getState().sendTo(toPayoutRecipient(r));
    },

    newRecipient: () => set({ stage: "new" }),
    addKind: (kind) => {
      if (kind === "bank") return set({ stage: "bankCurrency" });
      if (kind === "card") return set({ stage: "card", card: EMPTY_CARD });
      if (kind === "poket") return set({ stage: "poketUser", poket: EMPTY_POKET });
      // Sending to external wallets needs Tier 2 (docs/decisions.md; the explore prototype's tier2Gate).
      if (useNgn.getState().tier < 2) return set({ stage: "tier2", tier2Back: "new" });
      set({ stage: "wallet", wallet: EMPTY_WALLET });
    },

    pickCurrency: (cur) => {
      if (cur === "NGN") { set({ stage: null }); usePayout.getState().sendToNewBank(); return; }
      if (cur === "GBP") return set({ stage: "ukBank", uk: EMPTY_UK });
      set({ stage: "usBank", us: EMPTY_US });
    },
    editUs: (p) => set((s) => ({ us: { ...s.us, ...p } })),
    continueUs: async () => {
      const d = get().us, rb = routingBank(d.routing);
      if (!rb || !usReady(d)) return;
      const saved = await savePayoutRecipient({
        isSelf: false, name: d.nick.trim() || d.name.trim(), holderName: d.name.trim(), currency: "USD", methodType: "bank",
        bankName: rb.short, bankFullName: rb.full, accountNumber: d.acct, routingNumber: d.routing, country: "United States",
        saved: d.save,
      });
      set({ stage: null }); // keep the source; on to the amount, as for NGN
      usePayout.getState().sendTo(saved);
    },

    editUk: (p) => set((s) => ({ uk: { ...s.uk, ...p } })),
    continueUk: async () => {
      const d = get().uk, sb = sortBank(d.sort);
      if (!sb || !ukReady(d)) return;
      const saved = await savePayoutRecipient({
        isSelf: false, name: d.nick.trim() || d.name.trim(), holderName: d.name.trim(), currency: "GBP", methodType: "bank",
        bankName: sb.short, bankFullName: sb.full, accountNumber: d.acct, routingNumber: d.sort, saved: d.save,
      });
      set({ stage: null });
      usePayout.getState().sendTo(saved);
    },

    editCard: (p) => set((s) => ({ card: { ...s.card, ...p } })),
    continueCard: async () => {
      const d = get().card;
      if (!cardReady(d)) return;
      // A card in the verified user's name is theirs: it's saved under Your accounts
      const saved = await saveDebitCard({ number: d.num, name: d.name, zip: d.zip, saved: d.save, verifiedName: holderName() });
      set({ stage: null }); // keep the source; on to the amount (USD only)
      usePayout.getState().sendTo(saved);
    },

    setPoketQuery: (query) => {
      const id = ++lookupId;
      set((s) => ({ poket: { ...s.poket, query, lookup: { status: handleKind(query) ? "resolving" : "idle" } } }));
      if (!handleKind(query)) return;
      void lookupPoketUser(query).then((user) => {
        if (id !== lookupId) return;
        set((s) => ({ poket: { ...s.poket, lookup: user ? { status: "found", user } : { status: "notFound" } } }));
      });
    },
    pickRecent: (u) => { lookupId++; set((s) => ({ poket: { ...s.poket, query: u.handle, lookup: { status: "found", user: u } } })); },
    editPoket: (p) => set((s) => ({ poket: { ...s.poket, ...p } })),
    continuePoket: async () => {
      const { lookup, nick, save } = get().poket;
      if (lookup.status !== "found" || !lookup.user) return;
      const name = nick.trim() || lookup.user.name;
      const user = save ? await savePoketUser({ name, handle: lookup.user.handle, initials: initialsOf(lookup.user.name), holdsNaira: lookup.user.holdsNaira }) : { ...lookup.user, name };
      set({ stage: null });
      usePayout.getState().sendTo(toPayoutRecipient({ kind: "poket", id: `poket:${user.id}`, user }));
    },

    pickCoin: (asset, net) => set((s) => ({ wallet: { ...s.wallet, asset, net }, stage: "wallet" })),
    editWallet: (p) => set((s) => ({ wallet: { ...s.wallet, ...p } })),
    continueWallet: async () => {
      const w = get().wallet, a = w.address.trim();
      if (!validAddress(w.net, a)) return;
      const fields = { name: w.nick.trim() || `${w.asset} wallet`, address: a, asset: w.asset, network: w.net };
      const wallet = w.save ? await saveStablecoinWallet(fields) : { id: `wallet-new-${Date.now()}`, ...fields };
      set({ stage: null });
      usePayout.getState().sendTo(toPayoutRecipient({ kind: "wallet", id: `wallet:${wallet.id}`, wallet }));
    },
  };
});
