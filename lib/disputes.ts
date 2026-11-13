/**
 * WGT-12, disputes: the reference's dispute content, shared by the wallet (tDispute in reference/poket-unified.html)
 * and Checkout's Poket account (SCREENS['dispute'] in reference/poket-widgets.html, "the same stages as the unified
 * Poket wallet"). A payment to a store can be disputed up to DISPUTE_DAYS after it was made; deposits, top-ups,
 * refunds, sends and conversions can't.
 */
import { useAccount } from "@/store/account";
import { useEvents } from "@/store/events";

/** "Disputes can be raised up to 60 days after a payment." (poket-widgets DISPUTE_DAYS) */
export const DISPUTE_DAYS = 60;
/** At this many disputes the account can't raise more ("You can't raise a dispute right now"). */
export const DISPUTE_STRIKE_LIMIT = 2;

export const DISPUTE_REASONS = [
  "I was charged the wrong amount", "I was charged twice", "I never received the product or service",
  "The product or service wasn't as described", "I did not make this transaction", "I canceled a subscription that still renewed",
] as const;
export const SUBSCRIPTION_REASON = "I canceled a subscription that still renewed";
export const NOT_MINE_REASON = "I did not make this transaction";
export const REASON_SHORT: Record<string, string> = {
  "I was charged the wrong amount": "Wrong amount", "I was charged twice": "Charged twice", "I never received the product or service": "Not received",
  "The product or service wasn't as described": "Not as described", "I did not make this transaction": "Didn’t make this payment",
  "I canceled a subscription that still renewed": "Subscription renewed",
};
export const EVIDENCE_LABEL: Record<string, string> = {
  "I was charged the wrong amount": "the wrong charge amount", "I was charged twice": "the duplicate charge",
  "I never received the product or service": "not receiving this", "The product or service wasn't as described": "the issue with your order",
  "I did not make this transaction": "not making this transaction", "I canceled a subscription that still renewed": "the canceled subscription",
};
/** payment.dispute_opened's reason (poket-widgets DISPUTE_REASON_CODE). */
export const DISPUTE_REASON_CODE: Record<string, string> = {
  "I was charged the wrong amount": "wrong_amount", "I was charged twice": "duplicate", "I never received the product or service": "not_received",
  "The product or service wasn't as described": "not_as_described", "I did not make this transaction": "unrecognised",
  "I canceled a subscription that still renewed": "subscription_canceled",
};

/** Whole days since `at` (ISO or ms). */
export const ageDays = (at: string | number) => Math.floor((Date.now() - new Date(at).getTime()) / 86400000);
/** The 60-day window: days left (negative once it's closed). */
export function disputeWindow(at: string | number) {
  const age = ageDays(at), left = DISPUTE_DAYS - age;
  return { age, left, open: left >= 0 };
}

/** fmtLong / extDateLong: "Nov 12, 2026". */
export const fmtLong = (at: string | number) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The contact date is optional; if given it must be a real date between the payment and today (dateProblem). */
export function dateProblem(v: string, paidAt: string | number): string | null {
  const m = /^(\d{2}) \/ (\d{2}) \/ (\d{4})$/.exec(v || "");
  if (!m) return "Enter the full date as MM / DD / YYYY.";
  const mo = +m[1], da = +m[2], yr = +m[3], dt = new Date(yr, mo - 1, da);
  if (mo < 1 || mo > 12 || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return "That date doesn’t exist. Check the month and day.";
  const paid = new Date(paidAt); paid.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(23, 59, 59, 999);
  if (dt < paid) return `That’s before you paid on ${fmtLong(paidAt)}.`;
  if (dt > today) return "That date is in the future.";
  return null;
}
/** The date field's mask: digits to "MM / DD / YYYY" as typed. Returns the shown value and the digits. */
export function maskDate(raw: string) {
  const v = raw.replace(/\D/g, "").slice(0, 8);
  const shown = v.length > 4 ? `${v.slice(0, 2)} / ${v.slice(2, 4)} / ${v.slice(4)}` : v.length > 2 ? `${v.slice(0, 2)} / ${v.slice(2)}` : v;
  return { shown, complete: v.length === 8 };
}

/** The dispute form (S.disp / the reference's disputeX fields). */
export type DisputeForm = {
  reason: string | null; contacted: boolean; date: string; evidence: boolean; details: string; contact: string; editContact: boolean; more: boolean;
};
export const NEW_DISPUTE: DisputeForm = { reason: null, contacted: false, date: "", evidence: false, details: "", contact: "", editContact: false, more: false };
/** "Add more detail · N added". */
export const addedCount = (d: DisputeForm) => (d.contacted ? 1 : 0) + (d.evidence ? 1 : 0) + (d.details ? 1 : 0);

export const disputeStrikes = () => useAccount.getState().account?.disputeStrikes ?? 0;

/**
 * Submit a dispute on a Checkout payment (kept on the account, so Checkout and the wallet both show it open): the
 * payment is "disputed", the account's strikes go up (at most DISPUTE_STRIKE_LIMIT), and the merchant hears
 * payment.dispute_opened with the reason code.
 */
export function openDispute(paymentId: string, reason: string, widget: "checkout" | "wallet") {
  const at = new Date().toISOString();
  useAccount.getState().update((a) => ({
    ...a,
    disputeStrikes: Math.min((a.disputeStrikes ?? 0) + 1, DISPUTE_STRIKE_LIMIT),
    payments: a.payments.map((p) => (p.id === paymentId ? { ...p, status: "disputed", dispute: { reason, at } } : p)),
  }));
  useEvents.getState().emit("payment.dispute_opened", { widget, poket_reference: paymentId, reason: DISPUTE_REASON_CODE[reason] ?? "other" });
}
/** A dispute on one of the wallet's own demo records (not a Checkout payment): only the strike counts. */
export function countDisputeStrike() {
  useAccount.getState().update((a) => ({ ...a, disputeStrikes: Math.min((a.disputeStrikes ?? 0) + 1, DISPUTE_STRIKE_LIMIT) }));
}
