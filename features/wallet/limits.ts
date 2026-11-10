import { create } from "zustand";

/**
 * Tier limits and the limit check, from the reference: TIERS, tierName, tierForLimit, evaluateLimit and the spend log
 * (recordSpend, spentToday, spentThisMonth). Limits are whole US dollars, as in the reference.
 */
export const TIERS: Record<1 | 2 | 3, { name: string; txLimit: number; dayLimit: number; monthLimit: number; need: string }> = {
  1: { name: "Tier 1: Basic", txLimit: 2000, dayLimit: 5000, monthLimit: 10000, need: "a Veriff document scan and a quick liveness check" },
  2: { name: "Tier 2: Standard", txLimit: 10000, dayLimit: 25000, monthLimit: 75000, need: "proof of address" },
  3: { name: "Tier 3: Enhanced", txLimit: 50000, dayLimit: 100000, monthLimit: 500000, need: "a Source of Funds Declaration and additional document validation" },
};
export const tierName = (t: number) => (t > 0 ? TIERS[t as 1 | 2 | 3].name : "Tier 0: Registered");

type SpendState = { log: { amount: number; at: number }[]; record: (amountUsd: number) => void; reset: () => void };
/** S.spendLog: USD amounts that count toward limits. */
export const useSpend = create<SpendState>((set) => ({
  log: [],
  record: (amount) => set((s) => ({ log: [...s.log, { amount, at: Date.now() }] })),
  reset: () => set({ log: [] }),
}));
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
export const spentToday = () => { const now = new Date(); return useSpend.getState().log.filter((e) => sameDay(new Date(e.at), now)).reduce((s, e) => s + e.amount, 0); };
export const spentThisMonth = () => { const now = new Date(); return useSpend.getState().log.filter((e) => sameMonth(new Date(e.at), now)).reduce((s, e) => s + e.amount, 0); };

type LimitKey = "txLimit" | "dayLimit" | "monthLimit";
/** tierForLimit: the lowest tier allowing `value`; 4 when even Tier 3 doesn't. */
export function tierForLimit(value: number, key: LimitKey): number {
  if (value <= TIERS[1][key]) return 1;
  if (value <= TIERS[2][key]) return 2;
  if (value <= TIERS[3][key]) return 3;
  return 4;
}

export type LimitResult = { ok: true } | { ok: false; blocked: true; reason: "transaction" | "day" | "month" } | { ok: false; needTier: number };
/** evaluateLimit(amountUsd) at `tier`: fine, needs a step-up to `needTier`, or over even Tier 3's limits. */
export function evaluateLimit(amountUsd: number, tier: number): LimitResult {
  const txNeed = tierForLimit(amountUsd, "txLimit");
  const dayNeed = tierForLimit(spentToday() + amountUsd, "dayLimit");
  const monthNeed = tierForLimit(spentThisMonth() + amountUsd, "monthLimit");
  const need = Math.max(txNeed, dayNeed, monthNeed);
  if (need >= 4) return { ok: false, blocked: true, reason: monthNeed >= 4 ? "month" : dayNeed >= 4 ? "day" : "transaction" };
  if (need > tier) return { ok: false, needTier: need };
  return { ok: true };
}
