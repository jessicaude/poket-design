import { useNotifications } from "./useNotifications";

/**
 * Every notification the wallet sends, in one place (docs/notifications.md lists the same, and a test keeps them
 * equal). Checkout sends none: it tells the merchant through events. docs/copy.md: the title says what happened in
 * 2 to 4 words, past tense; the body is one sentence with the amount and who. {amount} is without the currency code
 * (formatNairaShort, withoutCode).
 */
export const NOTIFICATIONS = {
  topUpReceived: { type: "info", trigger: "A temporary-account top-up arrives (Deposit, bank transfer)", title: "Transfer received", body: "{amount} added to your NGN balance." },
  transferReceived: { type: "info", trigger: "A bank transfer to the NGN account details, or naira from a Poket user, arrives", title: "Transfer received", body: "{amount} from {sender} added to your NGN balance." },
  delayedTransferReceived: { type: "info", trigger: "The naira partner is back: each transfer that arrived while it was down is credited", title: "Transfer received", body: "{amount} from {sender} added to your NGN balance, after a delay." },
  refundReceived: { type: "payout", trigger: "A merchant refunds a naira bank-transfer payment into the NGN balance (not from a dispute)", title: "Refund received", body: "{amount} from {merchant} added to your NGN balance." },
  disputeRefundedToBalance: { type: "payout", trigger: "A dispute is resolved by refund, into the NGN balance (a naira bank transfer)", title: "Dispute resolved", body: "{amount} from {merchant} added to your NGN balance." },
  disputeRefundedToCard: { type: "payout", trigger: "A dispute is resolved by refund, back to the card that paid", title: "Dispute resolved", body: "{amount} from {merchant} is on its way back to {method}." },
  paymentReversed: { type: "payout", trigger: "A dispute is resolved by reversal: back the way it was paid", title: "Payment reversed", body: "{amount} from {merchant} is on its way back to {destination}." },
  disputeClosed: { type: "payout", trigger: "A dispute is resolved by release: the merchant keeps the payment", title: "Dispute closed", body: "{merchant} keeps your {amount} payment." },
  transferFailed: { type: "payout", trigger: "A send fails: the money goes back to the balance that paid it", title: "Transfer failed", body: "{amount} to {recipient} came back to your {currency} balance." },
  transferReversed: { type: "payout", trigger: "A paid send is returned by the bank (also shown as a notice)", title: "Transfer reversed", body: "{amount} to {recipient} came back to your {currency} balance." },
  transferRecovered: { type: "payout", trigger: "A recall on a send to a Nigerian bank is recovered", title: "Transfer recovered", body: "{amount} from {recipient} is back in your NGN balance." },
  recallClosed: { type: "payout", trigger: "A recall on a send to a Nigerian bank is not recovered", title: "Recall closed", body: "We couldn’t recover your {amount} transfer to {recipient}." },
} as const satisfies Record<string, { type: "info" | "payout"; trigger: string; title: string; body: string }>;
export type NotificationKey = keyof typeof NOTIFICATIONS;

/** A body with its {placeholders} filled. Every placeholder must be given. */
export function fillBody(key: NotificationKey, vars: Record<string, string>): string {
  return NOTIFICATIONS[key].body.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (vars[k] === undefined) throw new Error(`notification ${key}: missing {${k}}`);
    return vars[k];
  });
}
/** The notification as sent: its title and filled body. */
export const notificationFor = (key: NotificationKey, vars: Record<string, string>) => ({ type: NOTIFICATIONS[key].type, title: NOTIFICATIONS[key].title, desc: fillBody(key, vars) });

/** Send a notification from the catalogue. The only way the wallet sends one. */
export function notify(key: NotificationKey, vars: Record<string, string>) {
  useNotifications.getState().add(notificationFor(key, vars));
}
