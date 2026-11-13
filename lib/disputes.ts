/**
 * WGT-12, disputes: the reference's dispute content, shared by the wallet (tDispute in reference/poket-unified.html)
 * and Checkout's Poket account (SCREENS['dispute'] in reference/poket-widgets.html, "the same stages as the unified
 * Poket wallet"). A payment to a store can be disputed up to DISPUTE_DAYS after it was made; deposits, top-ups,
 * refunds, sends and conversions can't.
 */
import { useAccount, type DisputeOutcome, type Payment } from "@/store/account";
import { useEvents } from "@/store/events";
import { HOST_MERCHANT, isFullyRefunded, merchantRefunds, refundLeft } from "./refunds";

/** "Disputes can be raised up to 60 days after a payment." (poket-widgets DISPUTE_DAYS) */
export const DISPUTE_DAYS = 60;
/** At this many disputes the account can't raise more ("You can't raise a dispute right now"). */
export const DISPUTE_STRIKE_LIMIT = 2;

/**
 * WGT-12's reasons (in place of the reference's six): not received, not as described, charged twice, didn't
 * authorise, other. The full sentence is the chip's title; the short one its label.
 */
export const DISPUTE_REASONS = [
  "I never received the product or service", "The product or service wasn't as described", "I was charged twice",
  "I didn’t authorise this payment", "Something else",
] as const;
export const NOT_MINE_REASON = "I didn’t authorise this payment";
export const REASON_SHORT: Record<string, string> = {
  "I never received the product or service": "Not received", "The product or service wasn't as described": "Not as described",
  "I was charged twice": "Charged twice", "I didn’t authorise this payment": "Didn’t authorise", "Something else": "Other",
};
export const EVIDENCE_LABEL: Record<string, string> = {
  "I never received the product or service": "not receiving this", "The product or service wasn't as described": "the issue with your order",
  "I was charged twice": "the duplicate charge", "I didn’t authorise this payment": "not authorising this payment", "Something else": "this issue",
};
/** payment.dispute_opened's reason. */
export const DISPUTE_REASON_CODE: Record<string, string> = {
  "I never received the product or service": "not_received", "The product or service wasn't as described": "not_as_described",
  "I was charged twice": "duplicate", "I didn’t authorise this payment": "unauthorised", "Something else": "other",
};
/** The short description's length limit. */
export const DESCRIPTION_MAX = 300;

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
  reason: string | null; description: string; contacted: boolean; date: string; evidence: boolean; contact: string; editContact: boolean; more: boolean;
};
export const NEW_DISPUTE: DisputeForm = { reason: null, description: "", contacted: false, date: "", evidence: false, contact: "", editContact: false, more: false };
/** "Add more detail · N added". */
export const addedCount = (d: DisputeForm) => (d.contacted ? 1 : 0) + (d.evidence ? 1 : 0);
/** The form's button: what's still missing, else Review dispute. */
export const formButton = (d: DisputeForm) => (!d.reason ? "Choose a reason to continue" : !d.description.trim() ? "Describe what happened to continue" : "Review dispute");

export const disputeStrikes = () => useAccount.getState().account?.disputeStrikes ?? 0;

/**
 * Submit a dispute on a Checkout payment (kept on the account, so Checkout and the wallet both show it open): the
 * payment is "disputed", the account's strikes go up (at most DISPUTE_STRIKE_LIMIT), and the merchant hears
 * payment.dispute_opened with the reason code.
 */
export function openDispute(paymentId: string, reason: string, description: string, widget: "checkout" | "wallet") {
  const at = new Date().toISOString();
  useAccount.getState().update((a) => ({
    ...a,
    disputeStrikes: Math.min((a.disputeStrikes ?? 0) + 1, DISPUTE_STRIKE_LIMIT),
    payments: a.payments.map((p) => (p.id === paymentId ? { ...p, status: "disputed", dispute: { reason, description: description.trim(), at } } : p)),
  }));
  const p = useAccount.getState().account?.payments.find((x) => x.id === paymentId);
  if (p?.merchant === HOST_MERCHANT) useEvents.getState().emit("payment.dispute_opened", { widget, poket_reference: paymentId, reason: DISPUTE_REASON_CODE[reason] ?? "other" });
}
/** A dispute on one of the wallet's own demo records (not a Checkout payment): only the strike counts. */
export function countDisputeStrike() {
  useAccount.getState().update((a) => ({ ...a, disputeStrikes: Math.min((a.disputeStrikes ?? 0) + 1, DISPUTE_STRIKE_LIMIT) }));
}

/** A payment can be disputed once: not after a dispute (open or resolved), nor once it's all been returned. */
export const canRaiseDispute = (p: Payment) => p.status === "paid" && !p.dispute && !isFullyRefunded(p);

/** The reason a released dispute went the merchant's way: not decided, so a placeholder. */
export const RELEASE_REASON_PLACEHOLDER = "[reason]";
/** A released dispute's line (NEW copy). */
export const releaseNote = (merchant: string) => `Dispute closed. ${merchant} keeps the payment. Reason: ${RELEASE_REASON_PLACEHOLDER}.`;

/**
 * Demo "Resolve: refund / release / reversal" on an open dispute. Refund: the merchant refunds what's left (as
 * "Merchant refunds", so to the card or the NGN balance, with payment.refunded). Release: closed, the merchant keeps
 * it. Reversal: what's left goes back the way it was paid (the card, or the bank account a transfer came from).
 * The dispute is then resolved (it can't be reopened), and the merchant hears payment.dispute_resolved.
 */
export function resolveDispute(paymentId: string, outcome: DisputeOutcome) {
  const p = useAccount.getState().account?.payments.find((x) => x.id === paymentId);
  if (!p || p.status !== "disputed") return;
  const left = refundLeft(p);
  if (outcome === "refund") merchantRefunds(p.id, "full", true);
  const at = new Date().toISOString();
  useAccount.getState().update((a) => ({
    ...a,
    payments: a.payments.map((x) => {
      if (x.id !== paymentId) return x;
      const refunds = outcome === "reversal" && left > 0
        ? [...(x.refunds ?? []), { id: "rv_" + Math.random().toString(36).slice(2, 10), amount: left, at, to: "method" as const, kind: "reversal" as const, fromDispute: true }]
        : x.refunds;
      return { ...x, status: "paid", refunds, dispute: { ...x.dispute!, outcome, resolvedAt: at } };
    }),
  }));
  if (p.merchant === HOST_MERCHANT) useEvents.getState().emit("payment.dispute_resolved", { poket_reference: p.id, outcome, amount: outcome === "release" ? 0 : left, currency: p.currency });
}
