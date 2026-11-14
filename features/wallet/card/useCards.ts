import { create } from "zustand";
import { fromUsd } from "@/lib/fees";
import { genRef } from "@/lib/mock-api";
import { attribute } from "../history/ledger";
import { fmtCurrency } from "../payout/payoutMath";
import { cashAmount, fiatOnlyAmt, useHoldings, type CashCurrency, type CoinAsset, type Network } from "../useHoldings";
import { useWalletToast } from "../useWalletToast";
import { useNgn } from "../ngn/useNgn";

/**
 * Virtual cards (the reference's tCard and its bindings): a card spends live from one balance (a currency's cash,
 * or a stablecoin on a network), with no top-up. Tier 3 only. Freeze declines new transactions until unfrozen.
 * "Simulate purchase" approves a random merchant's charge against the balance, or declines it when there isn't
 * enough; each approved charge is a card transaction in Activity and the balance's history.
 */
export type CardSource = { k: "cash"; cur: CashCurrency } | { k: "coin"; asset: CoinAsset; net: Network };
export type VirtualCard = { id: string; nickname: string; source: CardSource; frozen: boolean; revealed: boolean; pan: string; cvv: string; expiry: string };
export type CardPurchase = {
  id: string; at: number; ref: string; cardId: string; cardName: string; last4: string; merchant: string;
  /** In the balance's unit: minor units of the currency, or the coin's cents. */
  amount: number; source: CardSource;
  /** The balances it moved (cvKeys): card spend takes the FIAT-ONLY part first. */
  keys: string[];
};

/** The reference's merchants, in US cents (other currencies: the same at the demo rate). */
export const MERCHANTS = [
  { name: "Blue Bottle Coffee", usd: 650 },
  { name: "Whole Foods Market", usd: 4820 },
  { name: "Uber", usd: 1840 },
  { name: "Netflix", usd: 1599 },
];

/** genCardPan: 4242 and three random groups. */
const genCardPan = () => "4242" + [0, 1, 2].map(() => " " + String(Math.floor(1000 + Math.random() * 9000))).join("");
export const sourceKey = (s: CardSource) => (s.k === "cash" ? `cash:${s.cur}` : `coin:${s.asset}:${s.net}`);
export const sameSource = (a: CardSource | null, b: CardSource) => !!a && sourceKey(a) === sourceKey(b);
/** cardBalanceLabel: "USD cash", "USDC on Base". */
export const cardBalanceLabel = (s: CardSource) => (s.k === "cash" ? `${s.cur} cash` : `${s.asset} on ${s.net}`);
/** cardAvailBalance. */
export const cardAvail = (s: CardSource) => (s.k === "cash" ? cashAmount(s.cur) : useHoldings.getState().coins[s.asset][s.net] || 0);
const fmtCoin = (c: number) => fmtCurrency(c, "USD");
/** cardAvailFmt: the currency's format, or dollars for a stablecoin (the reference's fmt). */
export const fmtSource = (amount: number, s: CardSource) => (s.k === "cash" ? fmtCurrency(amount, s.cur) : fmtCoin(amount));

type State = {
  cards: VirtualCard[];
  activeId: string | null;
  creating: boolean;
  draftNickname: string;
  draftSource: CardSource | null;
  freezeConfirm: boolean;
  authorizing: boolean;
  /** Increase my limits from the lock screen (the step-up). */
  stepUp: boolean;
  purchases: CardPurchase[];
  set: (p: Partial<State>) => void;
  issue: () => void;
  startAdd: () => void;
  select: (id: string) => void;
  toggleReveal: () => void;
  freeze: () => void;
  confirmFreeze: () => void;
  /** Simulate purchase; `pick` (0-3) chooses the merchant (the reference picks at random). */
  simulatePurchase: (pick?: number) => void;
  reset: () => void;
};

const BLANK = { cards: [] as VirtualCard[], activeId: null, creating: false, draftNickname: "", draftSource: null, freezeConfirm: false, authorizing: false, stepUp: false, purchases: [] as CardPurchase[] };
const toast = (t: string) => useWalletToast.getState().showToast(t);

export const useCards = create<State>((set, get) => {
  const active = () => { const { cards, activeId } = get(); return cards.find((c) => c.id === activeId) ?? cards[0]; };
  const patch = (id: string, p: Partial<VirtualCard>) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  return {
    ...BLANK,
    set: (p) => set(p),
    issue: () => {
      const { cards, draftSource, draftNickname } = get();
      if (!draftSource) return;
      const isFirst = cards.length === 0;
      const fallback = isFirst ? "Personal" : draftSource.k === "cash" ? `${draftSource.cur} card` : `${draftSource.asset} card`;
      const card: VirtualCard = { id: "vc" + Date.now(), nickname: draftNickname.trim() || fallback, source: draftSource, frozen: false, revealed: false,
        pan: genCardPan(), cvv: String(Math.floor(100 + Math.random() * 900)), expiry: "08/2029" };
      set({ cards: [...cards, card], activeId: card.id, creating: false, draftNickname: "", draftSource: null });
      toast(isFirst ? "Virtual card activated" : "Card created");
    },
    startAdd: () => set({ creating: true, draftNickname: "", draftSource: null, freezeConfirm: false }),
    select: (id) => set({ activeId: id, freezeConfirm: false }),
    toggleReveal: () => { const c = active(); if (c) patch(c.id, { revealed: !c.revealed }); },
    freeze: () => {
      const c = active();
      if (!c) return;
      if (c.frozen) { patch(c.id, { frozen: false }); toast("Card unfrozen"); return; }
      set({ freezeConfirm: true });
    },
    confirmFreeze: () => { const c = active(); if (c) patch(c.id, { frozen: true }); set({ freezeConfirm: false }); toast("Card frozen"); },
    simulatePurchase: (pick) => {
      const card = active();
      if (!card || card.frozen || get().authorizing) return;
      set({ authorizing: true });
      setTimeout(() => {
        const m = MERCHANTS[pick ?? Math.floor(Math.random() * MERCHANTS.length)];
        const s = card.source;
        const amt = s.k === "cash" && s.cur !== "USD" ? fromUsd(m.usd, s.cur) : m.usd;
        if (amt > cardAvail(s)) {
          toast(`Declined: ${m.name} exceeds available balance`);
        } else {
          const ref = genRef();
          let keys: string[];
          if (s.k === "cash") {
            // debitFiatFirst: the card-funded (FIAT-ONLY) part pays first
            const fromFiat = Math.min(fiatOnlyAmt(s.cur), amt);
            keys = [...(fromFiat > 0 ? [`cash:${s.cur}:fiat`] : []), ...(amt - fromFiat > 0 ? [`cash:${s.cur}:open`] : [])];
            attribute({ description: `Card · ${m.name}`, reference: ref }, () => {
              if (s.cur === "NGN") useNgn.setState((n) => ({ ngnBalance: n.ngnBalance - amt }));
              else useHoldings.setState((h) => ({ cash: { ...h.cash, [s.cur]: h.cash[s.cur as Exclude<CashCurrency, "NGN">] - amt } }));
              if (fromFiat) useHoldings.setState((h) => ({ fiatOnly: { ...h.fiatOnly, [s.cur]: h.fiatOnly[s.cur] - fromFiat } }));
            });
          } else {
            keys = [`coin:${s.asset}:${s.net}`];
            useHoldings.setState((h) => ({ coins: { ...h.coins, [s.asset]: { ...h.coins[s.asset], [s.net]: h.coins[s.asset][s.net] - amt } } }));
          }
          const p: CardPurchase = { id: "cp_" + Math.random().toString(36).slice(2, 10), at: Date.now(), ref, cardId: card.id, cardName: card.nickname, last4: card.pan.slice(-4),
            merchant: m.name, amount: amt, source: s, keys };
          set((st) => ({ purchases: [p, ...st.purchases] }));
          toast(`Approved: ${m.name} · ${fmtSource(amt, s).replace(/ [A-Z]{3}$/, "")}`);
        }
        set({ authorizing: false });
      }, 900);
    },
    reset: () => set(BLANK),
  };
});
