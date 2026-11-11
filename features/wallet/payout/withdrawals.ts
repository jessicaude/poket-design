import type { WithdrawalStatus } from "@/lib/mock-api";
import { NGN_VA } from "../ngn/useNgn";
import { HOLD_PLACEHOLDER } from "./payoutMath";

/**
 * Withdrawal statuses as shown: the chip (the wallet's .va-status, tone = its modifier class) and the message
 * under it. Not in the reference, which has no withdrawal statuses; chip styles and copy follow the brief.
 */
export const STATUS_META: Record<WithdrawalStatus, { chip: string; tone: "" | "muted" | "warn" | "err"; message: string | null }> = {
  scheduled: { chip: "Scheduled", tone: "muted", message: `Sends after ${HOLD_PLACEHOLDER}` },
  review: { chip: "Held for review", tone: "warn", message: "We're checking this payment. We'll let you know." },
  // Shown only for sends without their own eta (Withdrawal.eta); every send made in Send has one
  sending: { chip: "Sending", tone: "muted", message: NGN_VA.arrives },
  paid: { chip: "Paid", tone: "", message: null },
  failed: { chip: "Failed", tone: "err", message: "Funds returned to your balance" },
  reversed: { chip: "Reversed", tone: "err", message: "Funds returned to your balance" },
};

/**
 * A first payment of $500 or more to a new card, wallet or Poket user is held (status "review") for a quick check:
 * the exploration's copy, in place of "Held for review".
 */
export const QUICK_CHECK = { chip: "Held for a quick check", message: "First payment to a new recipient. Usually under 15 minutes." };

/** Statuses whose amount is still reserved out of the balance ("on hold"). */
export const isOnHold = (s: WithdrawalStatus) => s === "scheduled" || s === "review" || s === "sending";

/**
 * How the NGN balance and reserved total change when a withdrawal moves between statuses (`total` = amount + fee).
 * Paid clears the reservation; failed releases it back to the balance; reversed (after paid) returns the money.
 */
export function reservationEffect(from: WithdrawalStatus, to: WithdrawalStatus, total: number): { balance: number; reserved: number } {
  if (isOnHold(from) && to === "paid") return { balance: 0, reserved: -total };
  if (isOnHold(from) && to === "failed") return { balance: total, reserved: -total };
  if (from === "paid" && to === "reversed") return { balance: total, reserved: 0 };
  return { balance: 0, reserved: 0 };
}
