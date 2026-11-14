import { create } from "zustand";
import { DEMO_USD_PER, cardFundFee, depositFee } from "@/lib/fees";
import { genRef } from "@/lib/mock-api";
import { attribute } from "../history/ledger";
import { evaluateLimit, useSpend } from "../limits";
import { notify } from "../notificationCatalogue";
import { holderName, useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { useHoldings, type CashCurrency, type CoinAsset, type Network } from "../useHoldings";
import { VA_SPEC, firstRail, type VaCurrency } from "./vaSpec";

/**
 * Deposit (the reference's tCardFund 'select', tDepositMethod, tCardFund, tAddMoney and tVa), for everything but
 * NGN (which keeps its own flow): choose a currency or a stablecoin; for cash, bank transfer (account details) or
 * card; for a stablecoin, its deposit address. Bank transfers pay the deposit fee (lib/fees.ts) out of what
 * arrives; card top-ups the card fee on top, charged to the card; stablecoin deposits are free.
 */
export type DepositChoice = { k: "cash"; cur: CashCurrency } | { k: "coin"; asset: CoinAsset; net: Network };
export type DepositStage =
  | "select" | "method" | "va"
  | "amount" | "select-card" | "card" | "3ds" | "authorizing" | "card-done"
  | "address" | "confirming" | "coin-done"
  | "stepup" | "limitBlocked";
export type VaStage = "locked" | "intro" | "creating" | "details";
export type Va = { status: "pending" | "ready"; num: string };
export type SavedCard = { id: string; nickname: string; last4: string; brand: string };

/** A deposit's record: what was added (`amount`), and for a bank transfer what arrived and the fee out of it. */
export type DepositRecord = {
  id: string; at: number; ref: string; kind: "card" | "bank" | "coin"; title: string; sub: string;
  /** The balance it went to, as a cvKey ("cash:USD:fiat", "coin:USDC:Base"). */
  key: string;
  unit: string; amount: number; fee: number; gross: number;
  rows: [string, string][];
};

/** The reference's S.savedCards (Ada's, in place of the reference's Jordan Rivera). */
const SAVED_CARDS: SavedCard[] = [
  { id: "card1", nickname: "Personal Visa", last4: "4242", brand: "Visa" },
  { id: "card2", nickname: "Work Mastercard", last4: "0005", brand: "Mastercard" },
];
/** The reference's simulated stablecoin deposit: 25.00. */
export const COIN_DEPOSIT_DEMO = 2500;
export const NETWORK_INFO: Record<Network, { icon: "polygon" | "base"; dot: "polygonDot" | "baseDot"; min: string; conf: string; eta: string }> = {
  Polygon: { icon: "polygon", dot: "polygonDot", min: "1.00", conf: "128 confirmations", eta: "~2 min" },
  Base: { icon: "base", dot: "baseDot", min: "1.00", conf: "12 confirmations", eta: "~15 sec" },
};
export const DEPOSIT_ADDRESS = "0x8f3E2b91Ac47D0c5A19eB4d6F2c8B0a9E77Fc341";

type State = {
  stage: DepositStage | null;
  choice: DepositChoice | null;
  /** Where the flow started: Back there closes it (the select screen, or a balance's Deposit or account card). */
  entry: "select" | "method" | "va";
  search: string;
  cents: number;
  keypadOpen: boolean;
  savedCards: SavedCard[];
  cardId: string | null;
  vaStage: VaStage;
  vaAgree: boolean;
  vas: Partial<Record<VaCurrency, Va>>;
  gate: { needTier: number } | { reason: "transaction" | "day" | "month"; usd: number } | null;
  /** The record the done screen shows. */
  last: string | null;
  records: DepositRecord[];

  /** Deposit from the home: the select screen. */
  open: () => void;
  /** A cash balance's Deposit: straight to its methods. */
  openFor: (cur: VaCurrency) => void;
  /** A cash balance's account card: straight to its account details. */
  openAccount: (cur: VaCurrency) => void;
  close: () => void;
  back: () => void;
  set: (p: Partial<State>) => void;
  /** Select's Continue: a stablecoin's address, else the currency's methods (NGN: handled by the caller). */
  selectContinue: () => void;
  bank: () => void;
  card: () => void;
  key: (k: string) => void;
  addCard: (c: Omit<SavedCard, "id" | "nickname">) => void;
  /** 3DS Verify, and the stablecoin's Simulate deposit: the limit check, then the deposit. */
  verify: () => void;
  simulateCoin: () => void;
  stepUpContinue: () => void;
  vaCreate: () => void;
  /** Demo: the account's partner bank approves it (USD isn't instant). */
  vaApprove: (cur: VaCurrency) => void;
  /** Demo: a transfer from the user's own bank arrives to the account details. */
  vaReceive: (cur: VaCurrency) => DepositRecord | null;
  reset: () => void;
};

const BLANK = { stage: null, choice: null, entry: "select" as const, search: "", cents: 0, keypadOpen: false, cardId: null, vaStage: "intro" as VaStage, vaAgree: false, gate: null, last: null };
let pending: "card" | "coin" | null = null;

const usdOf = (minor: number, unit: string) => (minor * (unit in DEMO_USD_PER ? DEMO_USD_PER[unit as CashCurrency] : 1)) / 100;
const fmtUnit = (minor: number, unit: string) => (unit === "USDC" || unit === "USDT"
  ? `${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}` : fmtCurrency(minor, unit as CashCurrency));

export const useDeposit = create<State>((set, get) => {
  const add = (r: Omit<DepositRecord, "id" | "at">) => {
    const rec = { ...r, id: "dep_" + Math.random().toString(36).slice(2, 10), at: Date.now() };
    set((s) => ({ records: [rec, ...s.records], last: rec.id }));
    return rec;
  };
  /** The deposit itself, once the limit check passes. */
  const run = (what: "card" | "coin") => {
    const c = get().choice;
    if (!c) return;
    if (what === "card" && c.k === "cash") {
      const cur = c.cur as VaCurrency;
      set({ stage: "authorizing" });
      setTimeout(() => {
        const { cents, savedCards, cardId } = get();
        const card = savedCards.find((x) => x.id === cardId)!;
        const fee = cardFundFee(cents, cur), ref = genRef();
        // Card money is FIAT-ONLY: spendable and withdrawable, never stablecoin
        attribute({ description: "Top-up · Card", reference: ref }, () => useHoldings.setState((s) => ({
          cash: { ...s.cash, [cur]: s.cash[cur] + cents }, fiatOnly: { ...s.fiatOnly, [cur]: s.fiatOnly[cur] + cents } })));
        useSpend.getState().record(usdOf(cents, cur));
        add({ kind: "card", ref, title: `${cur} deposit`, sub: `${card.brand} ••• ${card.last4}`, key: `cash:${cur}:fiat`, unit: cur, amount: cents, fee, gross: cents + fee,
          rows: [["Card", `${card.brand} ••• ${card.last4}`], ["Card fee", fmtUnit(fee, cur)], ["Total charged", fmtUnit(cents + fee, cur)], ["Funding tag", "FIAT-ONLY"], ["Statement descriptor", "POKET"]] });
        set({ stage: "card-done" });
      }, 1600);
    }
    if (what === "coin" && c.k === "coin") {
      set({ stage: "confirming" });
      setTimeout(() => {
        const amt = COIN_DEPOSIT_DEMO;
        useHoldings.setState((s) => ({ coins: { ...s.coins, [c.asset]: { ...s.coins[c.asset], [c.net]: s.coins[c.asset][c.net] + amt } } }));
        useSpend.getState().record(amt / 100);
        add({ kind: "coin", ref: genRef(), title: `${c.asset} deposit`, sub: c.net, key: `coin:${c.asset}:${c.net}`, unit: c.asset, amount: amt, fee: 0, gross: amt,
          rows: [["Asset", c.asset], ["Network", c.net]] });
        set({ stage: "coin-done" });
      }, 1400);
    }
  };
  /** gateAmount: deposits count toward the tier's limits. */
  const gate = (what: "card" | "coin") => {
    const c = get().choice!;
    const usd = what === "card" && c.k === "cash" ? usdOf(get().cents, c.cur) : COIN_DEPOSIT_DEMO / 100;
    const r = evaluateLimit(usd, useNgn.getState().tier);
    if (!r.ok && "blocked" in r) return set({ stage: "limitBlocked", gate: { reason: r.reason, usd: Math.round(usd * 100) } });
    if (!r.ok) { pending = what; return set({ stage: "stepup", gate: { needTier: r.needTier } }); }
    run(what);
  };
  const vaStageFor = (cur: VaCurrency): VaStage => (useNgn.getState().tier < 1 ? "locked" : get().vas[cur] ? "details" : "intro");

  return {
    ...BLANK, savedCards: SAVED_CARDS, vas: {}, records: [],
    open: () => set({ ...BLANK, stage: "select", choice: { k: "cash", cur: "USD" }, entry: "select" }),
    openFor: (cur) => set({ ...BLANK, stage: "method", choice: { k: "cash", cur }, entry: "method" }),
    openAccount: (cur) => set({ ...BLANK, stage: "va", choice: { k: "cash", cur }, entry: "va", vaStage: vaStageFor(cur) }),
    close: () => set(BLANK),
    back: () => {
      const { stage, entry } = get();
      if (stage === entry || stage === "select") return get().close();
      const prev: Partial<Record<DepositStage, DepositStage>> = {
        method: "select", va: "method", amount: "method", "select-card": "amount", card: "select-card", address: "select",
      };
      set({ stage: prev[stage!] ?? "select", keypadOpen: false });
    },
    set: (p) => set(p),
    selectContinue: () => {
      const c = get().choice;
      if (!c) return;
      set({ stage: c.k === "coin" ? "address" : "method" });
    },
    bank: () => {
      const c = get().choice;
      if (c?.k === "cash" && c.cur !== "NGN") set({ stage: "va", vaStage: vaStageFor(c.cur), vaAgree: false });
    },
    card: () => set({ stage: "amount", cents: 0, keypadOpen: false }),
    key: (k) => {
      const cents = get().cents;
      if (k === "back") return set({ cents: Math.floor(cents / 10) });
      if (cents >= 100000000) return; // cap at 1,000,000.00
      set({ cents: cents * 10 + parseInt(k, 10) });
    },
    addCard: (c) => {
      const card = { ...c, id: "card" + Date.now(), nickname: `${c.brand} ••• ${c.last4}` };
      set((s) => ({ savedCards: [...s.savedCards, card], cardId: card.id, stage: "3ds" }));
    },
    verify: () => gate("card"),
    simulateCoin: () => gate("coin"),
    stepUpContinue: () => { const w = pending; pending = null; set({ gate: null }); if (w) run(w); },
    vaCreate: () => {
      const c = get().choice;
      if (c?.k !== "cash" || c.cur === "NGN") return;
      const cur = c.cur;
      set({ vaStage: "creating" });
      setTimeout(() => {
        const num = String(Math.floor(1e11 + Math.random() * 8.9e11)) + String(Math.floor(1e3 + Math.random() * 8.9e3));
        set((s) => ({ vas: { ...s.vas, [cur]: { status: VA_SPEC[cur].instant ? "ready" : "pending", num } }, vaStage: "details" }));
      }, 1500);
    },
    vaApprove: (cur) => set((s) => (s.vas[cur] ? { vas: { ...s.vas, [cur]: { ...s.vas[cur]!, status: "ready" } } } : {})),
    vaReceive: (cur) => {
      if (get().vas[cur]?.status !== "ready") return null;
      const gross = VA_SPEC[cur].sample, fee = depositFee(gross, cur), ref = genRef();
      const sender = holderName(), line = `Bank transfer from ${sender}`;
      // As the NGN credits: what arrived, then the fee out of it as its own line (same reference)
      attribute({ description: line, reference: ref }, () => useHoldings.setState((s) => ({ cash: { ...s.cash, [cur]: s.cash[cur] + gross } })));
      if (fee) attribute({ description: `Fee · ${line}`, reference: ref }, () => useHoldings.setState((s) => ({ cash: { ...s.cash, [cur]: s.cash[cur] - fee } })));
      const rec = add({ kind: "bank", ref, title: line, sub: firstRail(cur), key: `cash:${cur}:open`, unit: cur, amount: gross - fee, fee, gross,
        rows: [["From", `${sender} · Your bank`], ["Rail", firstRail(cur)], ["Amount sent", fmtUnit(gross, cur)], ["Deposit fee", fmtUnit(fee, cur)], ["Added", fmtUnit(gross - fee, cur)]] });
      notify("transferReceived", { amount: fmtCurrency(gross - fee, cur).replace(/ [A-Z]{3}$/, ""), sender, currency: cur });
      return rec;
    },
    reset: () => set({ ...BLANK, savedCards: SAVED_CARDS, vas: {}, records: [] }),
  };
});

export const fmtDepositAmount = fmtUnit;
