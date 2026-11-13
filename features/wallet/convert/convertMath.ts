import { WICON } from "@/lib/icons";
import { DEMO_NGN_PER_USD } from "@/lib/money";
import { fmtCurrency } from "../payout/payoutMath";
import {
  CASH_CURRENCIES, COIN_ASSETS, NETWORKS, bucketBalance, useHoldings,
  type CashCurrency, type CoinAsset, type Network,
} from "../useHoldings";

/**
 * Convert's pure helpers, ported from reference/poket-unified.html: cvKey, cvParse, cvUnit, cvName, cvShort, cvFmt,
 * cvUsdPer, cvAvail, cvBadge, cvType, cvBlockedPair, cvCounts, cvRate, cvQuote and cvRateText. Pairs: cash → cash (FX),
 * cash → stablecoin (onramp), stablecoin → cash (offramp), stablecoin → stablecoin (swap, or bridge to another network).
 * Card-funded (FIAT-ONLY) cash can only be converted to cash other than NGN, and the tag carries over.
 * NGN rules (ngn.mdc) on top of the reference: NGN fees are ₦[fee] (left out of the maths), card-funded money can't
 * become naira, and naira conversions have a ₦[limit] cap.
 */

/** Cash buckets: open and card-funded (FIAT-ONLY). */
export type Bucket = "open" | "fiat";
export type CashSide = { k: "cash"; cur: CashCurrency; bucket: Bucket };
export type CoinSide = { k: "coin"; asset: CoinAsset; net: Network };
export type Side = CashSide | CoinSide;
export type CvType = "fx" | "onramp" | "offramp" | "swap" | "bridge";

export const CV_QUOTE_SECONDS = 30;
export const CV_FEES: Record<CvType, { pct: number; flat?: number; label: string }> = {
  fx: { pct: 0.01, label: "Exchange fee (1%)" },
  onramp: { pct: 0.005, label: "Processing fee (0.5%)" },
  offramp: { pct: 0.005, label: "Processing fee (0.5%)" },
  swap: { pct: 0.001, label: "Swap fee (0.1%)" },
  bridge: { pct: 0, flat: 10, label: "Network fee" },
};

/** The reference's fxToUSD (USD per unit) and currencyInfo icons. */
const FX_TO_USD: Record<CashCurrency, number> = { USD: 1, NGN: 1 / DEMO_NGN_PER_USD, EUR: 1.08, GBP: 1.27, GHS: 1 / 15.5 };
const CURRENCY: Record<CashCurrency, { name: string; icon: keyof typeof WICON }> = {
  USD: { name: "US Dollar", icon: "usFlag" },
  NGN: { name: "Nigerian Naira", icon: "ngFlag" },
  EUR: { name: "Euro", icon: "eurFlag" },
  GBP: { name: "British Pound", icon: "gbFlag" },
  GHS: { name: "Ghanaian Cedi", icon: "ghFlag" },
};
const ASSET: Record<CoinAsset, { name: string; icon: keyof typeof WICON }> = { USDC: { name: "USD Coin", icon: "usdc" }, USDT: { name: "Tether", icon: "usdt" } };
export const NETWORK: Record<Network, { icon: keyof typeof WICON; eta: string }> = { Polygon: { icon: "polygon", eta: "~2 min" }, Base: { icon: "base", eta: "~15 sec" } };

export const cvKey = (o: Side) => (o.k === "cash" ? `cash:${o.cur}:${o.bucket || "open"}` : `coin:${o.asset}:${o.net}`);
export function cvParse(key: string): Side {
  const [k, a, b] = key.split(":");
  return k === "cash" ? { k: "cash", cur: a as CashCurrency, bucket: (b as Bucket) || "open" } : { k: "coin", asset: a as CoinAsset, net: b as Network };
}
export const cvUnit = (o: Side) => (o.k === "cash" ? o.cur : o.asset);
export const cvName = (o: Side) => (o.k === "cash" ? CURRENCY[o.cur].name : `${o.asset} · ${o.net}`);
export const cvShort = (o: Side) => (o.k === "cash" ? o.cur : `${o.asset} (${o.net})`);
/** fmtAsset: "12.34 USDC". */
export const fmtAsset = (c: number, ticker: string) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + ticker;
export const cvFmt = (c: number, o: Side) => (o.k === "cash" ? fmtCurrency(c, o.cur) : fmtAsset(c, o.asset));
export const cvUsdPer = (o: Side) => (o.k === "cash" ? FX_TO_USD[o.cur] || 1 : 1);
export const cvAvail = (o: Side) => o.k === "coin" ? useHoldings.getState().coins[o.asset]?.[o.net] || 0
  : bucketBalance(o.cur, o.bucket || "open");
/** "0.00" amounts in the From and To panels. */
export const fmtPlain = (c: number) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** cvBadge(o, size) as HTML (it's placed with dangerouslySetInnerHTML so .badge>svg stays a direct child). */
export function cvBadgeHtml(o: Side, size?: number): string {
  const st = size ? ` style="width:${size}px;height:${size}px"` : "";
  if (o.k === "cash") return `<div class="badge"${st}>${WICON[CURRENCY[o.cur].icon]}</div>`;
  return `<div class="asset-icon-wrap"><div class="badge"${st}>${WICON[ASSET[o.asset].icon]}</div><span class="badge-network">${WICON[NETWORK[o.net].icon]}</span></div>`;
}

export function cvType(f: Side, to: Side): CvType | null {
  if (f.k === "cash" && to.k === "cash") return f.cur === to.cur ? null : "fx";
  if (f.k === "cash") return "onramp";
  if (to.k === "cash") return "offramp";
  if (f.k === "coin" && to.k === "coin" && f.asset === to.asset) return f.net === to.net ? null : "bridge";
  return "swap";
}
/**
 * Why a target can't be chosen for this source, as shown on its row in "Convert to" (null: it can).
 * Card-funded cash can't become a stablecoin (reference) or naira (NGN rule).
 */
export function cvBlockReason(f: Side, to: Side | { k: "coin" }): string | null {
  if (f.k !== "cash") return null;
  if (f.bucket === "fiat" && to.k === "coin") return "Card-funded cash can’t convert to stablecoins";
  if (f.bucket === "fiat" && to.k === "cash" && "cur" in to && to.cur === "NGN") return "Card-funded money can’t be converted to naira";
  return null;
}
export const cvBlockedPair = (f: Side, to: Side | { k: "coin" }) => cvBlockReason(f, to) !== null;
/** Demo control "NGN to stablecoins: Blocked": naira to USDC or USDT isn't available yet. */
export const isNgnToStablecoin = (f: Side, to: Side) => f.k === "cash" && f.cur === "NGN" && to.k === "coin";

/** NGN rules apply to any conversion from or to naira. */
export const involvesNgn = (f: Side, to: Side) => (f.k === "cash" && f.cur === "NGN") || (to.k === "cash" && to.cur === "NGN");
/** ₦[fee] in the unit the fee is paid in: "₦[fee]", "$[fee]", or the coin equivalent "[fee] USDC". */
export function feePlaceholder(f: Side): string {
  if (f.k === "coin") return `[fee] ${f.asset}`;
  return { USD: "$", NGN: "\u20a6", EUR: "\u20ac", GBP: "\u00a3", GHS: "GH\u20b5" }[f.cur] + "[fee]";
}
/** The fee as shown: ₦[fee] (or equivalent) for naira conversions, else the reference's amount. */
export const cvFeeText = (q: Quote) => (involvesNgn(q.f, q.to) ? feePlaceholder(q.f) : cvFmt(q.fee, q.f));
/** The fee's label: "Fee" for naira conversions (no percentage while undecided), else the reference's. */
export const cvFeeLabel = (q: Quote) => (involvesNgn(q.f, q.to) ? "Fee" : q.spec.label);

/**
 * Per-conversion naira limit: ₦[limit] on screen. NGN_CONVERT_LIMIT_DEMO_KOBO (₦40,000.00) is a demo value only,
 * so the limit can be reached from a ₦50,000 balance; it never shows.
 */
export const LIMIT_PLACEHOLDER = "\u20a6[limit]";
export const NGN_CONVERT_LIMIT_DEMO_KOBO = 4000000;
/** The naira side of a conversion: what leaves NGN, or what arrives in it. */
export const ngnAmount = (q: Quote) => (q.f.k === "cash" && q.f.cur === "NGN" ? q.amt : q.to.k === "cash" && q.to.cur === "NGN" ? q.receive : 0);
export const overNgnLimit = (q: Quote) => ngnAmount(q) > NGN_CONVERT_LIMIT_DEMO_KOBO;

/**
 * Naira conversion minimum: ₦[minimum] on screen. NGN_CONVERT_MIN_DEMO_KOBO (₦1,550.00, the reference's $1.00) is a
 * demo value only; it never shows. Checked on the naira side of the conversion.
 */
export const MIN_PLACEHOLDER = "\u20a6[minimum]";
export const NGN_CONVERT_MIN_DEMO_KOBO = 155000;
/** Below the minimum: for naira conversions the naira side, otherwise the reference's $1.00 equivalent. */
export const belowMinimum = (q: Quote) => q.amt > 0 && (involvesNgn(q.f, q.to) ? ngnAmount(q) < NGN_CONVERT_MIN_DEMO_KOBO : q.usd < 100);
/** Conversions between cash and a stablecoin count toward tier limits. */
export const cvCounts = (type: CvType | null) => type === "onramp" || type === "offramp";
/** cvRate: units of `to` per unit of `from`. FX carries the quote's small jitter. */
export const cvRate = (f: Side, to: Side, jitter = 1) => (cvUsdPer(f) / cvUsdPer(to)) * (cvType(f, to) === "fx" ? jitter : 1);

/** `noTarget`: no To chosen yet (a card-funded source shows "Choose a currency"); `to` then repeats `f`. */
export type Quote = { noTarget?: boolean; f: Side; to: Side; type: CvType | null; amt: number; fee: number; receive: number; usd: number; spec: { pct: number; flat?: number; label: string }; avail: number };
export function cvQuote(from: string, toKey: string, cents: number, jitter: number): Quote {
  if (!toKey) { const f = cvParse(from); return { noTarget: true, f, to: f, type: null, amt: cents || 0, fee: 0, receive: 0, usd: Math.round((cents || 0) * cvUsdPer(f)), spec: { pct: 0, label: "" }, avail: cvAvail(f) }; }
  const f = cvParse(from), to = cvParse(toKey), type = cvType(f, to);
  const amt = cents || 0;
  const spec = type ? CV_FEES[type] : { pct: 0, label: "" };
  // NGN fees aren't decided: ₦[fee] on screen, 0 in the maths (as for NGN payouts).
  const fee = type && !involvesNgn(f, to) ? Math.min(amt, Math.round(amt * spec.pct) + (spec.flat || 0)) : 0;
  const receive = type ? Math.max(0, Math.round((amt - fee) * cvRate(f, to, jitter))) : 0;
  const usd = Math.round(amt * cvUsdPer(f));
  return { f, to, type, amt, fee, receive, usd, spec, avail: cvAvail(f) };
}

/** cvRateText: the readable way round by default ("1 USD ≈ 1,550.00 NGN"); `flip` reverses it. */
export function cvRateText(f: Side, to: Side, jitter: number, flip: boolean): string {
  const r = cvRate(f, to, jitter);
  const fmtN = (n: number) => n >= 1
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n >= 100 ? 2 : 4 })
    : n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
  let forward = r >= 1;
  if (flip) forward = !forward;
  return forward ? `1 ${cvUnit(f)} ≈ ${fmtN(r)} ${cvUnit(to)}` : `1 ${cvUnit(to)} ≈ ${fmtN(1 / r)} ${cvUnit(f)}`;
}

/** cvDefaultFrom: open USD, then any open cash, then any stablecoin, then any FIAT-ONLY cash. */
export function cvDefaultFrom(): string {
  const order: CashCurrency[] = ["USD", ...CASH_CURRENCIES.filter((c) => c !== "USD")];
  for (const cur of order) if (bucketBalance(cur, "open") > 0) return `cash:${cur}:open`;
  const coins = useHoldings.getState().coins;
  for (const a of COIN_ASSETS) for (const n of NETWORKS) if (coins[a][n] > 0) return `coin:${a}:${n}`;
  for (const cur of order) if (bucketBalance(cur, "fiat") > 0) return `cash:${cur}:fiat`;
  return "cash:USD:open";
}

/**
 * A source that can be converted into `to` (in cvDefaultFrom's order), or null if there's none. Used when Convert
 * opens with a target, e.g. NGN: card-funded USD and naira itself don't count.
 */
export function cvSourceFor(to: string): string | null {
  const t = cvParse(to);
  const order: CashCurrency[] = ["USD", ...CASH_CURRENCIES.filter((c) => c !== "USD")];
  const candidates: string[] = [];
  for (const cur of order) candidates.push(`cash:${cur}:open`);
  for (const a of COIN_ASSETS) for (const n of NETWORKS) candidates.push(`coin:${a}:${n}`);
  for (const cur of order) candidates.push(`cash:${cur}:fiat`);
  return candidates.find((k) => { const f = cvParse(k); return cvAvail(f) > 0 && cvType(f, t) && !cvBlockedPair(f, t); }) ?? null;
}

/**
 * cvFixTo: if the pair is the same balance or blocked, pick a sensible To. Card-funded cash gets no target ("": the
 * user chooses one); naira goes to USDC, or to USD while "NGN to stablecoins" is blocked.
 */
export function cvFixTo(from: string, to: string, ngnCoinsBlocked = false): string {
  const f = cvParse(from);
  if (to) {
    const t = cvParse(to);
    if (cvType(f, t) && !cvBlockedPair(f, t) && !(ngnCoinsBlocked && isNgnToStablecoin(f, t))) return to;
  }
  if (f.k === "cash") {
    if (f.bucket === "fiat") return "";
    return f.cur === "NGN" && ngnCoinsBlocked ? "cash:USD:open" : "coin:USDC:Base";
  }
  return "cash:USD:open";
}

/** The picker's options (cvPicker): From lists balances you hold; To lists every currency and stablecoin. */
export function cvOptions(isFrom: boolean, cashBucketsOf: (cur: CashCurrency) => { bucket: "open" | "fiat"; balance: number }[]): Side[] {
  const opts: Side[] = [];
  for (const cur of CASH_CURRENCIES) {
    if (isFrom) {
      cashBucketsOf(cur).forEach((b) => { if (b.balance > 0) opts.push({ k: "cash", cur, bucket: b.bucket }); });
    } else opts.push({ k: "cash", cur, bucket: "open" });
  }
  const coins = useHoldings.getState().coins;
  for (const a of COIN_ASSETS) for (const n of NETWORKS) if (!isFrom || (coins[a][n] || 0) > 0) opts.push({ k: "coin", asset: a, net: n });
  return opts;
}
