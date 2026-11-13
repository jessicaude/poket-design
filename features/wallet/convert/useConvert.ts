import { create } from "zustand";
import { attribute } from "../history/ledger";
import { createConversion, listConversions, setNgnToStablecoinsAllowed, type Conversion } from "@/lib/mock-api";
import { useWalletToast } from "../useWalletToast";
import { useWalletNav } from "../useWalletNav";
import { useNgn } from "../ngn/useNgn";
import { evaluateLimit, useSpend } from "../limits";
import { cashAmount, digitalEligibleAmt, fiatOnlyAmt, setCashAmount, useHoldings } from "../useHoldings";
import {
  cvAvail, cvBlockReason, cvBlockedPair, cvCounts, cvDefaultFrom, cvFeeLabel, cvFeeText, cvFixTo, cvFmt, cvKey, cvName,
  cvParse, cvQuote, cvRateText, cvSourceFor, cvType, isNgnToStablecoin, overNgnLimit,
} from "./convertMath";

/**
 * Convert flow controller (S.cv in the reference), rendered by ConvertBody inside WalletShell's #panelBody.
 * Stages are the reference's c.stage values, plus: empty (opened with a target and nothing to convert from),
 * stepup and limitBlocked (the reference's gateAmount screens before converting).
 * Ported from cvStart, the cv* bindings, cvNewQuote, cvExecute, gateAmount and the review timer.
 */
export const CONVERT_STAGES = ["form", "pickFrom", "pickTo", "review", "processing", "done", "empty", "stepup", "limitBlocked"] as const;
export type ConvertStage = (typeof CONVERT_STAGES)[number];
export const isConvertStage = (s: unknown): s is ConvertStage => CONVERT_STAGES.includes(s as ConvertStage);

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
  /** The conversion just made (done screen). */
  result: Conversion | null;
  /** Conversions made, newest first (activity and receipts). */
  conversions: Conversion[];
  /** Demo bar "NGN to stablecoins": Blocked. */
  ngnCoinsBlocked: boolean;
  /** stepup: the tier needed. limitBlocked: which limit, and the USD amount. */
  gate: { needTier?: number; reason?: "transaction" | "day" | "month"; usd?: number } | null;

  /** cvStart(opts). With a `to` and nothing that can convert into it, opens on "empty". */
  start: (opts?: { from?: string; to?: string }) => void;
  close: () => void;
  openPicker: (which: "from" | "to") => void;
  pickBack: () => void;
  setSearch: (q: string) => void;
  /** data-cvopt: choose a balance in the picker. */
  pick: (key: string) => void;
  /** "Convert to USD" when naira to stablecoins is blocked. */
  useUsd: () => void;
  flip: () => void;
  flipRate: () => void;
  max: () => void;
  key: (k: string) => void;
  review: () => void;
  refresh: () => void;
  backToForm: () => void;
  expire: () => void;
  /** cvConfirm: the limit and tier check (gateAmount), then convert. */
  confirm: () => Promise<void>;
  /** Step-up Continue (placeholder for the verification steps): convert. */
  stepUpContinue: () => Promise<void>;
  setNgnCoinsBlocked: (blocked: boolean) => void;
  reset: () => void;
};

const BLANK = { stage: null, from: "cash:USD:open", to: "coin:USDC:Base", cents: 0, jitter: 1, search: "", quoteAt: 0, expired: false, rateFlip: false, result: null, gate: null };

export const useConvert = create<State>((set, get) => {
  /** cvNewQuote. */
  const newQuote = () => {
    const { from, to } = get();
    set({ quoteAt: Date.now(), expired: false, jitter: cvType(cvParse(from), cvParse(to)) === "fx" ? 1 + (Math.random() - 0.5) * 0.004 : 1 });
  };

  /** Processing, then cvExecute: debit From, credit To (FIAT-ONLY carries over cash to cash). */
  const execute = async () => {
    const { from, to, cents, jitter, rateFlip } = get();
    const q = cvQuote(from, to, cents, jitter);
    set({ stage: "processing" });
    const conv = await createConversion({
      from, to, amount: q.amt, fee: q.fee, receive: q.receive,
      rateText: cvRateText(q.f, q.to, jitter, rateFlip), feeLabel: cvFeeLabel(q), feeText: cvFeeText(q),
      paidText: cvFmt(q.amt, q.f), receivedText: cvFmt(q.receive, q.to),
    });
    const f = q.f, t = q.to;
    // The NGN balance's ledger: a conversion from or to naira is one line each way
    attribute({ description: conversionTitle(conv), reference: conv.ref }, () => {
      if (f.k === "cash") {
        setCashAmount(f.cur, cashAmount(f.cur) - q.amt);
        if (f.bucket === "fiat") useHoldings.setState((s) => ({ fiatOnly: { ...s.fiatOnly, [f.cur]: Math.max(0, (s.fiatOnly[f.cur] || 0) - q.amt) } }));
      } else {
        const c = useHoldings.getState().coins;
        useHoldings.setState({ coins: { ...c, [f.asset]: { ...c[f.asset], [f.net]: Math.max(0, c[f.asset][f.net] - q.amt) } } });
      }
      if (t.k === "cash") {
        setCashAmount(t.cur, cashAmount(t.cur) + q.receive);
        if (f.k === "cash" && f.bucket === "fiat") useHoldings.setState((s) => ({ fiatOnly: { ...s.fiatOnly, [t.cur]: (s.fiatOnly[t.cur] || 0) + q.receive } }));
      } else {
        const c = useHoldings.getState().coins;
        useHoldings.setState({ coins: { ...c, [t.asset]: { ...c[t.asset], [t.net]: (c[t.asset][t.net] || 0) + q.receive } } });
      }
    });
    if (cvCounts(q.type)) useSpend.getState().record(q.usd / 100);
    set({ stage: "done", result: conv, conversions: listConversions() });
  };

  return {
    ...BLANK,
    conversions: listConversions(),
    ngnCoinsBlocked: false,

    start: (opts) => {
      useNgn.getState().close();
      const blocked = get().ngnCoinsBlocked;
      if (opts?.to && !opts.from) {
        const from = cvSourceFor(opts.to);
        if (!from) return set({ ...BLANK, stage: "empty", from: "", to: opts.to });
        return set({ ...BLANK, stage: "form", from, to: opts.to });
      }
      const from = opts?.from ?? cvDefaultFrom();
      set({ ...BLANK, stage: "form", from, to: cvFixTo(from, opts?.to ?? "coin:USDC:Base", blocked) });
    },
    /** Back to the wallet home, as the reference's backHome and cvDone do. */
    close: () => { useWalletNav.getState().home(); set({ ...BLANK }); },
    openPicker: (which) => set({ search: "", stage: which === "from" ? "pickFrom" : "pickTo" }),
    pickBack: () => set({ stage: "form" }),
    setSearch: (search) => set({ search }),

    pick: (key) => {
      const { stage, from, to, ngnCoinsBlocked } = get();
      const o = cvParse(key);
      if (stage === "pickTo") {
        const f = cvParse(from);
        if (!cvType(f, o)) return; // "Same as the balance you convert from"
        const reason = cvBlockReason(f, o);
        if (reason) {
          const body: Record<string, string> = {
            "Card-funded cash can’t convert to stablecoins": "Choose cash, or convert from a balance without the FIAT-ONLY tag.",
            "Card-funded money can’t be converted to naira": "Choose another currency.",
          };
          useWalletToast.getState().showNotice(reason, body[reason], 4000);
          return;
        }
        return set({ to: key, stage: "form" });
      }
      if (key !== from) return set({ from: key, cents: 0, to: cvFixTo(key, to, ngnCoinsBlocked), stage: "form" });
      set({ stage: "form" });
    },
    useUsd: () => set({ to: "cash:USD:open" }),

    /** cvFlip: swap From and To. Cash keeps its open part when it has one, else its FIAT-ONLY part. */
    flip: () => {
      if (!get().to) return; // nothing to swap with yet
      const f = cvParse(get().from), t = cvParse(get().to);
      const nf = t.k === "cash"
        ? { ...t, bucket: digitalEligibleAmt(t.cur) > 0 ? "open" as const : fiatOnlyAmt(t.cur) > 0 ? "fiat" as const : "open" as const }
        : t;
      const nt = f.k === "cash" ? { k: "cash" as const, cur: f.cur, bucket: "open" as const } : f;
      const from = cvKey(nf);
      set({ from, to: cvFixTo(from, cvKey(nt), get().ngnCoinsBlocked), cents: 0 });
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

    confirm: async () => {
      const { from, to, cents, jitter, ngnCoinsBlocked } = get();
      const q = cvQuote(from, to, cents, jitter);
      if (q.amt <= 0 || q.amt > q.avail || cvBlockedPair(q.f, q.to) || !q.type || overNgnLimit(q)) return;
      if (ngnCoinsBlocked && isNgnToStablecoin(q.f, q.to)) return;
      const tier = useNgn.getState().tier;
      // gateAmount: conversions between cash and stablecoins, and anything below Tier 1, check limits first.
      if (cvCounts(q.type) || tier < 1) {
        const r = evaluateLimit(q.usd / 100, tier);
        if (!r.ok && "blocked" in r) return set({ stage: "limitBlocked", gate: { reason: r.reason, usd: q.usd } });
        if (!r.ok) return set({ stage: "stepup", gate: { needTier: r.needTier } });
      }
      await execute();
    },
    stepUpContinue: () => execute(),

    setNgnCoinsBlocked: (blocked) => { setNgnToStablecoinsAllowed(!blocked); set({ ngnCoinsBlocked: blocked }); },
    reset: () => set({ ...BLANK, conversions: listConversions(), ngnCoinsBlocked: false }),
  };
});

/** The conversion's display name for the activity list: "Converted NGN to USDC". */
export const conversionTitle = (c: Conversion) => {
  const unit = (key: string) => { const o = cvParse(key); return o.k === "cash" ? o.cur : o.asset; };
  return `Converted ${unit(c.from)} to ${unit(c.to)}`;
};
/** The "to" balance name, for the done screen: "USDC on Base", "Nigerian Naira". */
export const toBalanceName = (key: string) => { const t = cvParse(key); return t.k === "coin" ? `${t.asset} on ${t.net}` : cvName(t); };
