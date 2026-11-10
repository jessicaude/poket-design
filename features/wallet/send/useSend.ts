import { create } from "zustand";
import {
  listSendRecipients, lookupPoketUser, savePayoutRecipient, savePoketUser, saveStablecoinWallet,
  type PoketUser, type SendRecipient, type WalletNetwork,
} from "@/lib/mock-api";
import { usePayout } from "../payout/usePayout";
import { useNgn } from "../ngn/useNgn";
import { showNotPorted } from "../useWalletToast";
import { handleKind, initialsOf, routingBank, sortBank, usSpeeds, validAddress, wireAddressOk } from "./sendMath";

/**
 * Send (docs/decisions.md: Send replaces the wallet's Transfer and Payout actions). Recipient-first: the recipients
 * screen, then the amount. Flow and copy from reference/poket-wallet-explore.html (savedPage, toScreen, the pickers);
 * the look is the wallet's. "+ New recipient" asks where to send:
 *   - Bank account: currency first. NGN continues in the existing bank step (bank picker, name enquiry); USD and GBP
 *     use the explore prototype's US and UK bank fields.
 *   - Poket user: @handle, email or phone, with a name lookup; recent: the reference Transfer's contacts.
 *   - Stablecoin wallet (Tier 2, as decided): coin and network, address (validated, start and end highlighted),
 *     optional nickname.
 * Every new recipient can be saved ("Save recipient", on by default). Only NGN to a Nigerian bank has an amount
 * screen so far; the others are saved and the send itself shows "Not in the prototype yet".
 */
export type SendStage = "recipients" | "new" | "bankCurrency" | "usBank" | "ukBank" | "poketUser" | "wallet" | "coinPicker" | "tier2";
export const isSendStage = (s: unknown): s is SendStage =>
  ["recipients", "new", "bankCurrency", "usBank", "ukBank", "poketUser", "wallet", "coinPicker", "tier2"].includes(s as string);

export type UsDraft = { routing: string; acct: string; name: string; nick: string; speed: string; street: string; city: string; state: string; zip: string; save: boolean };
export type UkDraft = { sort: string; acct: string; name: string; nick: string; save: boolean };
export type PoketDraft = { query: string; lookup: { status: "idle" | "resolving" | "found" | "notFound"; user?: PoketUser }; nick: string; save: boolean };
export type WalletDraft = { asset: "USDC" | "USDT"; net: WalletNetwork; address: string; nick: string; save: boolean };

const EMPTY_US: UsDraft = { routing: "", acct: "", name: "", nick: "", speed: "", street: "", city: "", state: "", zip: "", save: true };
const EMPTY_UK: UkDraft = { sort: "", acct: "", name: "", nick: "", save: true };
const EMPTY_POKET: PoketDraft = { query: "", lookup: { status: "idle" }, nick: "", save: true };
const EMPTY_WALLET: WalletDraft = { asset: "USDC", net: "Base", address: "", nick: "", save: true };

type State = {
  stage: SendStage | null;
  search: string;
  recipients: SendRecipient[];
  us: UsDraft;
  uk: UkDraft;
  poket: PoketDraft;
  wallet: WalletDraft;
  open: () => void;
  close: () => void;
  back: () => void;
  setSearch: (q: string) => void;
  /** A saved recipient: straight to the amount. */
  choose: (r: SendRecipient) => void;
  newRecipient: () => void;
  addKind: (kind: "bank" | "poket" | "wallet") => void;
  pickCurrency: (cur: "NGN" | "USD" | "GBP") => void;
  editUs: (p: Partial<UsDraft>) => void;
  continueUs: () => Promise<void>;
  editUk: (p: Partial<UkDraft>) => void;
  continueUk: () => Promise<void>;
  setPoketQuery: (q: string) => void;
  pickRecent: (u: PoketUser) => void;
  editPoket: (p: Partial<Pick<PoketDraft, "nick" | "save">>) => void;
  continuePoket: () => Promise<void>;
  pickCoin: (asset: "USDC" | "USDT", net: WalletNetwork) => void;
  editWallet: (p: Partial<WalletDraft>) => void;
  continueWallet: () => Promise<void>;
};

/** Sending naira to a Nigerian bank account is the only send with an amount screen so far. */
export const canSendTo = (r: SendRecipient) => r.kind === "bank" && r.bank.currency === "NGN";

/** The US bank form is complete (the explore prototype's ok). */
export function usReady(d: UsDraft): boolean {
  const rb = routingBank(d.routing);
  return !!rb && /^\d{6,17}$/.test(d.acct) && d.name.trim().length > 1 && (d.speed !== "wire" || wireAddressOk(d));
}

/** The UK bank form is complete (the explore prototype's ok): a known sort code, 8 digits, a holder name. */
export const ukReady = (d: UkDraft) => !!sortBank(d.sort) && /^\d{8}$/.test(d.acct) && d.name.trim().length > 1;

export const useSend = create<State>((set, get) => {
  let lookupId = 0;
  /** After saving a recipient the prototype can't send to yet: back to the list, with the not-ported notice. */
  const savedButNotPorted = (what: string) => { get().open(); showNotPorted(`${what} isn't ported yet.`); };

  return {
    stage: null,
    search: "",
    recipients: [],
    us: EMPTY_US,
    uk: EMPTY_UK,
    poket: EMPTY_POKET,
    wallet: EMPTY_WALLET,

    open: () => set({ stage: "recipients", search: "", recipients: listSendRecipients() }),
    close: () => set({ stage: null, search: "" }),
    back: () => {
      const prev: Record<SendStage, SendStage | null> = {
        recipients: null, new: "recipients", bankCurrency: "new", usBank: "bankCurrency", ukBank: "bankCurrency", poketUser: "new", wallet: "new", coinPicker: "wallet", tier2: "new",
      };
      const to = get().stage ? prev[get().stage!] : null;
      if (to === null) return get().close();
      set({ stage: to });
    },
    setSearch: (search) => set({ search }),

    choose: (r) => {
      if (!canSendTo(r) || r.kind !== "bank") {
        const what = r.kind === "poket" ? "Sending to a Poket user" : r.kind === "wallet" ? "Sending to a stablecoin wallet" : `Sending ${r.bank.currency} to a bank account`;
        return showNotPorted(`${what} isn't ported yet.`);
      }
      get().close();
      usePayout.getState().sendTo(r.bank);
    },

    newRecipient: () => set({ stage: "new" }),
    addKind: (kind) => {
      if (kind === "bank") return set({ stage: "bankCurrency" });
      if (kind === "poket") return set({ stage: "poketUser", poket: EMPTY_POKET });
      // Sending to external wallets needs Tier 2 (docs/decisions.md; the explore prototype's tier2Gate).
      if (useNgn.getState().tier < 2) return set({ stage: "tier2" });
      set({ stage: "wallet", wallet: EMPTY_WALLET });
    },

    pickCurrency: (cur) => {
      if (cur === "NGN") { get().close(); usePayout.getState().sendToNewBank(); return; }
      if (cur === "GBP") return set({ stage: "ukBank", uk: EMPTY_UK });
      set({ stage: "usBank", us: EMPTY_US });
    },
    editUs: (p) => set((s) => {
      const us = { ...s.us, ...p };
      // speedsFor: keep the chosen speed if the bank offers it, else the free one (Standard).
      const rb = routingBank(us.routing);
      if (rb && !usSpeeds(rb.instant).some((x) => x.id === us.speed)) us.speed = "ach";
      if (!rb) us.speed = "";
      return { us };
    }),
    continueUs: async () => {
      const d = get().us, rb = routingBank(d.routing);
      if (!rb || !usReady(d)) return;
      await savePayoutRecipient({
        isSelf: false, name: d.nick.trim() || d.name.trim(), holderName: d.name.trim(), currency: "USD", methodType: "bank",
        bankName: rb.short, bankFullName: rb.full, accountNumber: d.acct, routingNumber: d.routing, speed: d.speed,
        ...(d.speed === "wire" ? { address: d.street, city: d.city, state: d.state, zip: d.zip, country: "United States" } : {}),
        saved: d.save,
      });
      savedButNotPorted("Sending USD to a bank account");
    },

    editUk: (p) => set((s) => ({ uk: { ...s.uk, ...p } })),
    continueUk: async () => {
      const d = get().uk, sb = sortBank(d.sort);
      if (!sb || !ukReady(d)) return;
      await savePayoutRecipient({
        isSelf: false, name: d.nick.trim() || d.name.trim(), holderName: d.name.trim(), currency: "GBP", methodType: "bank",
        bankName: sb.short, bankFullName: sb.full, accountNumber: d.acct, routingNumber: d.sort, saved: d.save,
      });
      savedButNotPorted("Sending GBP to a bank account");
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
      if (save) await savePoketUser({ name, handle: lookup.user.handle, initials: initialsOf(lookup.user.name) });
      savedButNotPorted("Sending to a Poket user");
    },

    pickCoin: (asset, net) => set((s) => ({ wallet: { ...s.wallet, asset, net }, stage: "wallet" })),
    editWallet: (p) => set((s) => ({ wallet: { ...s.wallet, ...p } })),
    continueWallet: async () => {
      const w = get().wallet, a = w.address.trim();
      if (!validAddress(w.net, a)) return;
      if (w.save) await saveStablecoinWallet({ name: w.nick.trim() || `${w.asset} wallet`, address: a, asset: w.asset, network: w.net });
      savedButNotPorted("Sending to a stablecoin wallet");
    },
  };
});
