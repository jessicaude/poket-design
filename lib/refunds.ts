/**
 * WGT-12, refunds: a merchant refunds a Checkout payment in full or in part (demo action "Merchant refunds" on a
 * payment's detail, in Checkout's Poket account and in the wallet). The payment then reads "Refunded" or "Partly
 * refunded", each refund is its own "Refund · {merchant}" record, and the merchant hears payment.refunded.
 * Card (and US bank) payments go back to the method that paid, in [refund time] (not decided). Naira bank-transfer
 * payments have no account to return to, so they're added to the NGN balance (to confirm: not in the PRD; the
 * wallet credits it, features/wallet/refundCredits.ts).
 */
import { useAccount, type Payment, type Refund } from "@/store/account";
import { useEvents } from "@/store/events";

/** The demo's merchant (the Ilé Living page): only its own payments' events reach it (reference: x.merchant===HOST.name). */
export const HOST_MERCHANT = "Ilé Living";

/** How long a refund takes to reach a card or bank: not decided. */
export const REFUND_TIME = "[refund time]";

export const refundedTotal = (p: Payment) => (p.refunds ?? []).reduce((s, r) => s + r.amount, 0);
export const refundLeft = (p: Payment) => Math.max(0, p.amount - refundedTotal(p));
export const isFullyRefunded = (p: Payment) => refundedTotal(p) >= p.amount;
/** A naira bank transfer: refunds go to the NGN balance. */
export const refundsToNgn = (p: Payment) => p.methodKind === "bank" && p.currency === "NGN";

/** Where a refund goes, for "Refunded to" and "To …": the card or bank, or the NGN balance. */
export const refundDest = (p: Payment, r?: Refund) => ((r ? r.to === "ngn" : refundsToNgn(p)) ? "NGN balance" : p.method);
/** The refund's arrival: "Back to Visa ••• 4242 in [refund time]", or straight into the NGN balance. */
export const refundNote = (p: Payment, r: Refund) => (r.to === "ngn" ? "Added to your NGN balance." : `Back to ${p.method} in ${REFUND_TIME}`);

/** The payment's status line: a dispute, a refund (all or part), else completed. Tone: the reference's chip tones. */
export function paymentStatus(p: Payment): { label: string; tone: "ok" | "warn" | "" } {
  if (isFullyRefunded(p)) return { label: "Refunded", tone: "" };
  if (p.status === "disputed") return { label: "Dispute open", tone: "warn" };
  if (refundedTotal(p) > 0) return { label: "Partly refunded", tone: "" };
  return { label: "Completed", tone: "ok" };
}

/** Every refund on the account, with its payment, newest first. */
export const allRefunds = (payments: Payment[]) =>
  payments.flatMap((p) => (p.refunds ?? []).map((r) => ({ p, r }))).sort((a, b) => new Date(b.r.at).getTime() - new Date(a.r.at).getTime());

/**
 * Demo "Merchant refunds": in full (what's left), or in part (half of what's left, in whole units). Records the
 * refund on the payment and tells the merchant (payment.refunded; the demo's merchant hears about its own payments). Returns the refund, or null when nothing's left.
 */
export function merchantRefunds(paymentId: string, kind: "full" | "part"): Refund | null {
  const p = useAccount.getState().account?.payments.find((x) => x.id === paymentId);
  if (!p) return null;
  const left = refundLeft(p);
  if (left <= 0) return null;
  const amount = kind === "full" ? left : Math.max(100, Math.floor(left / 2 / 100) * 100);
  const r: Refund = { id: "rf_" + Math.random().toString(36).slice(2, 10), amount: Math.min(amount, left), at: new Date().toISOString(), to: refundsToNgn(p) ? "ngn" : "method" };
  useAccount.getState().update((a) => ({ ...a, payments: a.payments.map((x) => (x.id === paymentId ? { ...x, refunds: [...(x.refunds ?? []), r] } : x)) }));
  const full = r.amount >= left;
  if (p.merchant === HOST_MERCHANT) useEvents.getState().emit("payment.refunded", {
    poket_reference: p.id, refund_id: r.id, amount: r.amount, currency: p.currency, full,
    refunded_to: r.to === "ngn" ? "ngn_balance" : p.methodKind === "bank" ? "bank" : "card",
  });
  return r;
}
