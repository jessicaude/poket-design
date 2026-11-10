import { create } from "zustand";
import { useNgn } from "./ngn/useNgn";

/**
 * Wallet balances other than NGN, as the reference's account holds them (cashHoldings, fiatOnlyHoldings, holdings).
 * NGN cash stays in useNgn.ngnBalance (the NGN flows' source of truth); everything else lives here.
 * Seeded with the reference's live demo state: $15.60 USD, all card-funded (FIAT-ONLY); no stablecoins.
 * Amounts are integer minor units.
 */
export const CASH_CURRENCIES = ["USD", "NGN", "EUR", "GBP", "GHS"] as const;
export type CashCurrency = (typeof CASH_CURRENCIES)[number];
export const COIN_ASSETS = ["USDC", "USDT"] as const;
export type CoinAsset = (typeof COIN_ASSETS)[number];
export const NETWORKS = ["Polygon", "Base"] as const;
export type Network = (typeof NETWORKS)[number];

type State = {
  /** Cash other than NGN. */
  cash: Record<Exclude<CashCurrency, "NGN">, number>;
  /** The card-funded (FIAT-ONLY) part of each cash balance: spendable on fiat, never on digital assets. */
  fiatOnly: Record<CashCurrency, number>;
  coins: Record<CoinAsset, Record<Network, number>>;
  set: (patch: Partial<Pick<State, "cash" | "fiatOnly" | "coins">>) => void;
  reset: () => void;
};

const INITIAL = {
  cash: { USD: 1560, EUR: 0, GBP: 0, GHS: 0 },
  fiatOnly: { USD: 1560, NGN: 0, EUR: 0, GBP: 0, GHS: 0 },
  coins: { USDC: { Polygon: 0, Base: 0 }, USDT: { Polygon: 0, Base: 0 } },
};

export const useHoldings = create<State>((set) => ({
  ...INITIAL,
  set: (patch) => set(patch),
  reset: () => set(INITIAL),
}));

/** A cash balance (S.cashHoldings[cur]). */
export function cashAmount(cur: CashCurrency): number {
  return cur === "NGN" ? useNgn.getState().ngnBalance : useHoldings.getState().cash[cur];
}
/** Set a cash balance. */
export function setCashAmount(cur: CashCurrency, v: number) {
  if (cur === "NGN") useNgn.setState({ ngnBalance: v });
  else useHoldings.setState((s) => ({ cash: { ...s.cash, [cur]: v } }));
}
/** fiatOnlyAmt(cur): never more than the cash balance. */
export const fiatOnlyAmt = (cur: CashCurrency) => Math.max(0, Math.min(useHoldings.getState().fiatOnly[cur] || 0, cashAmount(cur)));
/** digitalEligibleAmt(cur): the open (convertible to stablecoins) part. */
export const digitalEligibleAmt = (cur: CashCurrency) => Math.max(0, cashAmount(cur) - fiatOnlyAmt(cur));
/** bucketBalance(cur, bucket). */
export const bucketBalance = (cur: CashCurrency, bucket: "open" | "fiat") => (bucket === "fiat" ? fiatOnlyAmt(cur) : digitalEligibleAmt(cur));
/** cashBuckets(cur): FIAT-ONLY first when there is any, then open (shown even at 0 when there's no FIAT-ONLY). */
export function cashBuckets(cur: CashCurrency): { bucket: "open" | "fiat"; balance: number }[] {
  const fo = fiatOnlyAmt(cur), open = digitalEligibleAmt(cur);
  const out: { bucket: "open" | "fiat"; balance: number }[] = [];
  if (fo > 0) out.push({ bucket: "fiat", balance: fo });
  if (open > 0 || fo === 0) out.push({ bucket: "open", balance: open });
  return out;
}
