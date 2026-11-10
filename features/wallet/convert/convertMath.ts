import { WICON } from "@/lib/icons";
import { fmtCurrency } from "../payout/payoutMath";
import {
  CASH_CURRENCIES, COIN_ASSETS, NETWORKS, bucketBalance, useHoldings,
  type CashCurrency, type CoinAsset, type Network,
} from "../useHoldings";

/**
 * Convert's pure helpers, ported from reference/poket-unified.html: cvKey, cvParse, cvUnit, cvName, cvShort, cvFmt,
 * cvUsdPer, cvAvail, cvBadge, cvType, cvBlockedPair, cvCounts, cvRate, cvQuote and cvRateText. Pairs: cash → cash (FX),
 * cash → stablecoin (onramp), stablecoin → cash (offramp), stablecoin → stablecoin (swap, or bridge to another network).
 * Card-funded (FIAT-ONLY) cash can only be converted to cash, and the tag carries over.
 */

export type CashSide = { k: "cash"; cur: CashCurrency; bucket: "open" | "fiat" };
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
const FX_TO_USD: Record<CashCurrency, number> = { USD: 1, NGN: 1 / 1550, EUR: 1.08, GBP: 1.27, GHS: 1 / 15.5 };
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
  return k === "cash" ? { k: "cash", cur: a as CashCurrency, bucket: (b as "open" | "fiat") || "open" } : { k: "coin", asset: a as CoinAsset, net: b as Network };
}
export const cvUnit = (o: Side) => (o.k === "cash" ? o.cur : o.asset);
export const cvName = (o: Side) => (o.k === "cash" ? CURRENCY[o.cur].name : `${o.asset} · ${o.net}`);
export const cvShort = (o: Side) => (o.k === "cash" ? o.cur : `${o.asset} (${o.net})`);
/** fmtAsset: "12.34 USDC". */
export const fmtAsset = (c: number, ticker: string) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + ticker;
export const cvFmt = (c: number, o: Side) => (o.k === "cash" ? fmtCurrency(c, o.cur) : fmtAsset(c, o.asset));
export const cvUsdPer = (o: Side) => (o.k === "cash" ? FX_TO_USD[o.cur] || 1 : 1);
export const cvAvail = (o: Side) => (o.k === "cash" ? bucketBalance(o.cur, o.bucket || "open") : useHoldings.getState().coins[o.asset]?.[o.net] || 0);
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
/** Card-funded cash can't become a stablecoin. */
export const cvBlockedPair = (f: Side, to: Pick<Side, "k">) => f.k === "cash" && (f.bucket || "open") === "fiat" && to.k === "coin";
/** Conversions between cash and a stablecoin count toward tier limits. */
export const cvCounts = (type: CvType | null) => type === "onramp" || type === "offramp";
/** cvRate: units of `to` per unit of `from`. FX carries the quote's small jitter. */
export const cvRate = (f: Side, to: Side, jitter = 1) => (cvUsdPer(f) / cvUsdPer(to)) * (cvType(f, to) === "fx" ? jitter : 1);

export type Quote = { f: Side; to: Side; type: CvType | null; amt: number; fee: number; receive: number; usd: number; spec: { pct: number; flat?: number; label: string }; avail: number };
export function cvQuote(from: string, toKey: string, cents: number, jitter: number): Quote {
  const f = cvParse(from), to = cvParse(toKey), type = cvType(f, to);
  const amt = cents || 0;
  const spec = type ? CV_FEES[type] : { pct: 0, label: "" };
  const fee = type ? Math.min(amt, Math.round(amt * spec.pct) + (spec.flat || 0)) : 0;
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

/** cvFixTo: if the pair is the same balance or blocked, pick a sensible To. */
export function cvFixTo(from: string, to: string): string {
  const f = cvParse(from), t = cvParse(to);
  if (cvType(f, t) && !cvBlockedPair(f, t)) return to;
  if (f.k === "cash") return cvBlockedPair(f, { k: "coin" }) ? `cash:${f.cur === "USD" ? "NGN" : "USD"}:open` : "coin:USDC:Base";
  return "cash:USD:open";
}

/** The picker's options (cvPicker): From lists balances you hold; To lists every currency and stablecoin. */
export function cvOptions(isFrom: boolean, cashBucketsOf: (cur: CashCurrency) => { bucket: "open" | "fiat"; balance: number }[]): Side[] {
  const opts: Side[] = [];
  for (const cur of CASH_CURRENCIES) {
    if (isFrom) cashBucketsOf(cur).forEach((b) => { if (b.balance > 0) opts.push({ k: "cash", cur, bucket: b.bucket }); });
    else opts.push({ k: "cash", cur, bucket: "open" });
  }
  const coins = useHoldings.getState().coins;
  for (const a of COIN_ASSETS) for (const n of NETWORKS) if (!isFrom || (coins[a][n] || 0) > 0) opts.push({ k: "coin", asset: a, net: n });
  return opts;
}
