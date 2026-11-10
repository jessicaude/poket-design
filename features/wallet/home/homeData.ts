import { create } from "zustand";
import { useNgn } from "../ngn/useNgn";
import { CASH_CURRENCIES, cashBuckets, useHoldings, type CashCurrency, type CoinAsset, type Network } from "../useHoldings";

/**
 * Wallet home data, from tWalletHome in reference/poket-unified.html: cashRows, stablecoinRows, assetDelta, the total
 * balance (aggregateBalance) and the demo activity records (S.txns). Merchant-held NGN is an extra cash row.
 */

/** The reference's fxToUSD. */
export const FX_TO_USD: Record<CashCurrency, number> = { USD: 1, NGN: 1 / 1550, EUR: 1.08, GBP: 1.27, GHS: 1 / 15.5 };
export const CURRENCY_NAME: Record<CashCurrency, string> = { USD: "US Dollar", NGN: "Nigerian Naira", EUR: "Euro", GBP: "British Pound", GHS: "Ghanaian Cedi" };
export const CURRENCY_ICON: Record<CashCurrency, "usFlag" | "ngFlag" | "eurFlag" | "gbFlag" | "ghFlag"> = { USD: "usFlag", NGN: "ngFlag", EUR: "eurFlag", GBP: "gbFlag", GHS: "ghFlag" };
export const ASSET_NAME: Record<CoinAsset, string> = { USDC: "USD Coin", USDT: "Tether" };
/** S.holdings key order (Base, then Polygon), which the home lists them in. */
export const HOME_NETWORKS: Network[] = ["Base", "Polygon"];

/** Home UI state: S.walletTab, S.masked, S.hideZeroBalance, S.assetSettingsOpen, and the tab bar's tab. */
type HomeState = {
  walletTab: "assets" | "cash";
  masked: boolean;
  hideZero: boolean;
  settingsOpen: boolean;
  tab: "home" | "card" | "activity";
  set: (p: Partial<Omit<HomeState, "set">>) => void;
};
export const useWalletHome = create<HomeState>((set) => ({
  walletTab: "assets", masked: false, hideZero: false, settingsOpen: false, tab: "home",
  set: (p) => set(p),
}));

export type CashRow = { key: string; currency: CashCurrency; bucket: "open" | "fiat" | "merchant"; balance: number };
/** cashRows(): each currency's buckets (FIAT-ONLY, open), plus merchant-held NGN; sorted by USD value. */
export function cashRows(hideZero: boolean): CashRow[] {
  const list: CashRow[] = [];
  for (const cur of CASH_CURRENCIES) {
    cashBuckets(cur).forEach((b) => list.push({ key: `${cur}:${b.bucket}`, currency: cur, bucket: b.bucket, balance: b.balance }));
    if (cur === "NGN" && useNgn.getState().ngnMerchantBalance > 0) list.push({ key: "NGN:merchant", currency: "NGN", bucket: "merchant", balance: useNgn.getState().ngnMerchantBalance });
  }
  const filtered = hideZero ? list.filter((a) => a.balance > 0) : list;
  return filtered.sort((a, b) => b.balance * FX_TO_USD[b.currency] - a.balance * FX_TO_USD[a.currency]);
}

export type CoinRow = { key: string; asset: CoinAsset; network: Network; balance: number };
/** stablecoinRows(): every asset on every network, sorted by balance. */
export function stablecoinRows(hideZero: boolean): CoinRow[] {
  const coins = useHoldings.getState().coins;
  const list: CoinRow[] = [];
  for (const asset of ["USDC", "USDT"] as CoinAsset[]) for (const network of HOME_NETWORKS) list.push({ key: `${asset}-${network}`, asset, network, balance: coins[asset][network] || 0 });
  const filtered = hideZero ? list.filter((a) => a.balance > 0) : list;
  return filtered.sort((a, b) => b.balance - a.balance);
}

/** seededRandom, verbatim. */
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 0x1000000; };
}
/** assetDelta: a small daily peg drift for a held stablecoin (seeded by the date, so it's stable within a day). */
export function assetDelta(seed: string, balance: number): { pct: number; amtCents: number } | null {
  if (!balance) return null;
  const pct = (seededRandom(seed + "-24h-" + new Date().toDateString())() - 0.5) * 0.3;
  return { pct, amtCents: (balance * pct) / 100 };
}

/** aggregateBalance(): all cash in USD (including merchant-held NGN), plus stablecoins, in cents. */
export function totalBalanceUsd(): number {
  const h = useHoldings.getState(), n = useNgn.getState();
  let cash = 0;
  for (const cur of CASH_CURRENCIES) cash += (cur === "NGN" ? n.ngnBalance + n.ngnMerchantBalance : h.cash[cur]) * FX_TO_USD[cur];
  let coins = 0;
  for (const a of Object.values(h.coins)) for (const v of Object.values(a)) coins += v || 0;
  return Math.round(cash) + coins;
}

/**
 * The reference's demo wallet records (resetScenario 'autopull'): checkout activity that shows in the wallet.
 * Amounts are USD cents; `type` is the wallet's (refund, payment, deposit).
 */
export type DemoTx = { id: string; type: "refund" | "payment" | "deposit"; title: string; sub: string; amount: number; positive: boolean; ts: number; ref: string; details: [string, string][] };
const now = Date.now();
export const DEMO_TXNS: DemoTx[] = [
  { id: "t1", type: "refund", title: "Refund · Kola Books", sub: "Merchant refund · Kola Books", amount: 450, positive: true, ts: now - 1000 * 60 * 60 * 22, ref: "TXN-" + Math.floor(100000 + Math.random() * 900000),
    details: [["Currency", "USD"], ["Merchant", "Kola Books"], ["Context", "Checkout"]] },
  { id: "t2", type: "payment", title: "Sooyah Bistro", sub: "Merchant payment · Sooyah Bistro", amount: 720, positive: false, ts: now - 1000 * 60 * 60 * 24 * 3, ref: "TXN-" + Math.floor(100000 + Math.random() * 900000),
    details: [["Currency", "USD"], ["Merchant", "Sooyah Bistro"], ["Context", "Checkout"]] },
  { id: "t3", type: "deposit", title: "Top-up · Visa ····4242", sub: "Card top-up", amount: 5000, positive: true, ts: now - 1000 * 60 * 60 * 24 * 4, ref: "TXN-" + Math.floor(100000 + Math.random() * 900000),
    details: [["Currency", "USD"], ["Funding tag", "FIAT-ONLY"]] },
];
