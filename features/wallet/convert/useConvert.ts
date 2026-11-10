import { create } from "zustand";
import { createConversion } from "@/lib/mock-api";
import { useWalletToast } from "../useWalletToast";
import { useWalletNav } from "../useWalletNav";
import { useNgn } from "../ngn/useNgn";
import { digitalEligibleAmt, fiatOnlyAmt, setCashAmount, cashAmount, useHoldings } from "../useHoldings";
import {
  cvAvail, cvBlockedPair, cvDefaultFrom, cvFixTo, cvFmt, cvKey, cvName, cvParse, cvQuote, cvType,
} from "./convertMath";

/**
 * Convert flow controller (S.cv in the reference), rendered by ConvertBody inside WalletShell's #panelBody.
 * Stages are the reference's c.stage values. Ported from cvStart, the cv* bindings, cvNewQuote, cvExecute and
 * the review timer. The tier-limit gate before converting (gateAmount) isn't ported.
 */
export const CONVERT_STAGES = ["form", "pickFrom", "pickTo", "review", "processing", "done"] as const;
export type ConvertStage = (typeof CONVERT_STAGES)[number];
export const isConvertStage = (s: unknown): s is ConvertStage => CONVERT_STAGES.includes(s as ConvertStage);

export type ConvertResult = { received: string; toName: string; paid: string; fk: string; tk: string; fee: string; feeLabel: string; ref: string };

type State = {
  stage: ConvertStage | null;
  from: string;
  to: string;
  cents: number;
  /** FX quotes move slightly with each new quote (cvNewQuote); 1 for other pairs. */
  jitter: number;
  search: string;
  /** When the review quote was made; it holds for CV_QUOTE_SECONDS. */
  quoteAt: number;
  expired: boolean;
  /** The rate reads the other way round (tapping a rate flips it). */
  rateFlip: boolean;
  result: ConvertResult | null;

  /** cvStart(opts). */
  start: (opts?: { from?: string; to?: string }) => void;
  close: () => void;
  openPicker: (which: "from" | "to") => void;
  pickBack: () => void;
  setSearch: (q: string) => void;
  /** data-cvopt: choose a balance in the picker. */
  pick: (key: string) => void;
  flip: () => void;
  flipRate: () => void;
  max: () => void;
  key: (k: string) => void;
  /** cvReview / cvRefresh: a new quote. */
  review: () => void;
  refresh: () => void;
  backToForm: () => void;
  expire: () => void;
  confirm: () => Promise<void>;
};

const BLANK = { stage: null, from: "cash:USD:open", to: "coin:USDC:Base", cents: 0, jitter: 1, search: "", quoteAt: 0, expired: false, rateFlip: false, result: null };

export const useConvert = create<State>((set, get) => {
  /** cvNewQuote. */
  const newQuote = () => {
    const { from, to } = get();
    set({ quoteAt: Date.now(), expired: false, jitter: cvType(cvParse(from), cvParse(to)) === "fx" ? 1 + (Math.random() - 0.5) * 0.004 : 1 });
  };

  return {
    ...BLANK,

    /** Convert replaces whatever flow it's opened from (the reference's go('convert')). */
    start: (opts) => {
      useNgn.getState().close();
      const from = opts?.from ?? cvDefaultFrom();
      set({ ...BLANK, stage: "form", from, to: cvFixTo(from, opts?.to ?? "coin:USDC:Base") });
    },
    /** Back to the wallet home, as the reference's backHome and cvDone do. */
    close: () => { useWalletNav.getState().home(); set({ ...BLANK }); },
    openPicker: (which) => set({ search: "", stage: which === "from" ? "pickFrom" : "pickTo" }),
    pickBack: () => set({ stage: "form" }),
    setSearch: (search) => set({ search }),

    pick: (key) => {
      const { stage, from, to } = get();
      const o = cvParse(key);
      if (stage === "pickTo") {
        const f = cvParse(from);
        if (!cvType(f, o)) return; // "Same as the balance you convert from"
        if (cvBlockedPair(f, o)) {
          useWalletToast.getState().showNotice("Card-funded cash can't convert to stablecoins", "Choose cash, or convert from a balance without the FIAT-ONLY tag.", 4000);
          return;
        }
        return set({ to: key, stage: "form" });
      }
      if (key !== from) return set({ from: key, cents: 0, to: cvFixTo(key, to), stage: "form" });
      set({ stage: "form" });
    },

    /** cvFlip: swap From and To. Cash keeps its open part when it has one, else its FIAT-ONLY part. */
    flip: () => {
      const f = cvParse(get().from), t = cvParse(get().to);
      const nf = t.k === "cash"
        ? { ...t, bucket: digitalEligibleAmt(t.cur) > 0 ? "open" as const : fiatOnlyAmt(t.cur) > 0 ? "fiat" as const : "open" as const }
        : t;
      const nt = f.k === "cash" ? { k: "cash" as const, cur: f.cur, bucket: "open" as const } : f;
      const from = cvKey(nf);
      set({ from, to: cvFixTo(from, cvKey(nt)), cents: 0 });
    },
    flipRate: () => set((s) => ({ rateFlip: !s.rateFlip })),
    max: () => set({ cents: cvAvail(cvParse(get().from)) }),

    /** data-cvkey: digits append (12 at most); back drops the last. */
    key: (k) => {
      let s = String(get().cents || 0);
      if (k === "back") s = s.length > 1 ? s.slice(0, -1) : "0";
      else if (s.length < 12) s = s === "0" ? k : s + k;
      set({ cents: parseInt(s, 10) || 0 });
    },

    review: () => { newQuote(); set({ stage: "review" }); },
    refresh: () => newQuote(),
    backToForm: () => set({ stage: "form" }),
    expire: () => set({ expired: true }),

    /** cvConfirm, then cvExecute: debit From, credit To (FIAT-ONLY carries over cash to cash). */
    confirm: async () => {
      const { from, to, cents, jitter } = get();
      const q = cvQuote(from, to, cents, jitter);
      if (q.amt <= 0 || q.amt > q.avail || cvBlockedPair(q.f, q.to) || !q.type) return;
      set({ stage: "processing" });
      const { ref } = await createConversion({ from, to, amount: q.amt, fee: q.fee, receive: q.receive });
      const f = q.f, t = q.to;
      const h = useHoldings.getState();
      if (f.k === "cash") {
        setCashAmount(f.cur, cashAmount(f.cur) - q.amt);
        if (f.bucket === "fiat") useHoldings.setState((s) => ({ fiatOnly: { ...s.fiatOnly, [f.cur]: Math.max(0, (s.fiatOnly[f.cur] || 0) - q.amt) } }));
      } else {
        useHoldings.setState({ coins: { ...h.coins, [f.asset]: { ...h.coins[f.asset], [f.net]: Math.max(0, h.coins[f.asset][f.net] - q.amt) } } });
      }
      if (t.k === "cash") {
        setCashAmount(t.cur, cashAmount(t.cur) + q.receive);
        if (f.k === "cash" && f.bucket === "fiat") useHoldings.setState((s) => ({ fiatOnly: { ...s.fiatOnly, [t.cur]: (s.fiatOnly[t.cur] || 0) + q.receive } }));
      } else {
        const c = useHoldings.getState().coins;
        useHoldings.setState({ coins: { ...c, [t.asset]: { ...c[t.asset], [t.net]: (c[t.asset][t.net] || 0) + q.receive } } });
      }
      set({
        stage: "done",
        result: {
          received: cvFmt(q.receive, t), toName: t.k === "coin" ? `${t.asset} on ${t.net}` : cvName(t),
          paid: cvFmt(q.amt, f), fk: cvKey(f), tk: cvKey(t), fee: cvFmt(q.fee, f), feeLabel: q.spec.label, ref,
        },
      });
    },
  };
});
