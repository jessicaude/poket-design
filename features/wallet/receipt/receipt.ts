import type { Conversion, NgnCredit, Withdrawal } from "@/lib/mock-api";
import { formatNaira, withoutCode } from "@/lib/money";
import { refundDest, refundLeft, refundTitle } from "@/lib/refunds";
import type { Payment, Refund } from "@/store/account";
import { conversionTitle } from "../convert/useConvert";
import { brandInfo, POWERED_BY, type WalletBrand } from "../brand";
import { CREDIT_METHOD, SESSION_ID_PLACEHOLDER, cardPurchaseFields, conversionFields, creditFields, creditTitle, demoTxFields, depositFields, paymentFields, paymentStatusChip, refundFields, withdrawalFields, type Tone } from "../history/fields";
import { fmtDepositAmount, type DepositRecord } from "../deposit/useDeposit";
import { fmtSource, type CardPurchase } from "../card/useCards";
import type { DemoTx } from "../home/homeData";
import { HOLD_PLACEHOLDER, fmtCurrency } from "../payout/payoutMath";
import { STATUS_META, sentText } from "../payout/withdrawals";
import { formatTxDate } from "../withdrawals/TxDetail";

/**
 * A transaction's receipt (NEW, WGT-11; every transaction, money in and out): the amount, status, date and time, who it was to or from, the account
 * details, the fee ("Free" where there's none: Checkout payments, refunds, recalls) and the reference, in the wallet's look and brand, with
 * "Payments by Poket". A transaction that isn't done (pending, held, failed, reversed, a dispute holding it) says so
 * in `notice`, on the receipt and in what's shared. A naira bank transfer also has the bank's Session ID ("[session ID]").
 */
export type Receipt = {
  /** Who or what: "To Ngozi Eze", "From Chinedu Eze", "Mama Tee’s Kitchen". */
  title: string;
  amount: string;
  status: { label: string; tone: Tone };
  notice: { tone: "warn" | "err"; text: string } | null;
  /** In order: Date and time, To or From, Account, Fee, Reference, and Session ID for a naira bank transfer. */
  rows: [string, string][];
  reference: string;
};

const row = (label: string, value: string | undefined): [string, string][] => (value ? [[label, value]] : []);
/** A naira bank transfer adds the bank's Session ID after the Reference (the detail's own rule: TxFieldsData.bankTransfer). */
const rowsOf = (at: number, dir: "To" | "From", who: string, account: string | undefined, fee: string | undefined, reference: string, bankTransfer?: boolean): [string, string][] => [
  ["Date and time", formatTxDate(at)], [dir, who], ...row("Account", account), ["Fee", fee ?? "Free"], ["Reference", reference],
  ...row("Session ID", bankTransfer ? SESSION_ID_PLACEHOLDER : undefined),
];

/** What a send's receipt says while it isn't paid (NEW copy). */
function sendNotice(w: Withdrawal): Receipt["notice"] {
  switch (w.status) {
    case "scheduled": return { tone: "warn", text: `Pending. Sends after ${HOLD_PLACEHOLDER}.` };
    case "sending": return { tone: "warn", text: "Pending: on its way. It hasn’t arrived yet." };
    case "review": return { tone: "warn", text: `Held for review. ${STATUS_META.review.message}` };
    case "failed": return { tone: "err", text: "Failed: this payment wasn’t sent. The money was returned to your balance." };
    case "reversed": return { tone: "err", text: "Reversed: the bank returned this payment. The money was returned to your balance." };
    default: return null;
  }
}

export function withdrawalReceipt(w: Withdrawal): Receipt {
  const f = withdrawalFields(w);
  return { title: `To ${w.recipientName}`, amount: sentText(w), status: f.status, notice: sendNotice(w),
    rows: rowsOf(w.createdAt, "To", w.recipientName, w.recipientSub, f.fee, w.ref, f.bankTransfer), reference: w.ref };
}

export function conversionReceipt(c: Conversion): Receipt {
  const f = conversionFields(c);
  return { title: conversionTitle(c), amount: c.receivedText, status: f.status, notice: null,
    rows: [["Date and time", formatTxDate(c.createdAt)], ["From", f.from!], ["To", f.to!], ["Fee", c.feeText], ["Reference", c.ref]], reference: c.ref };
}

export function paymentReceipt(p: Payment): Receipt {
  const amount = fmtCurrency(p.amount, p.currency);
  return { title: p.merchant, amount, status: paymentStatusChip(p),
    notice: p.status === "disputed" ? { tone: "warn", text: `Dispute open: ${withoutCode(fmtCurrency(refundLeft(p), p.currency))} held while we review.` } : null,
    rows: rowsOf(new Date(p.at).getTime(), "To", p.merchant, p.method, undefined, p.id, paymentFields(p).bankTransfer), reference: p.id };
}

export function refundReceipt(p: Payment, r: Refund): Receipt {
  return { title: refundTitle(p, r), amount: fmtCurrency(r.amount, p.currency), status: { label: "Completed", tone: "" }, notice: null,
    rows: rowsOf(new Date(r.at).getTime(), "From", p.merchant, refundDest(p, r), undefined, r.id, refundFields(p, r).bankTransfer), reference: r.id };
}

/** A credit: from the sender (a recall: the account it came back from), the account as the bank reports it. */
export function creditReceipt(c: NgnCredit, recallName?: string): Receipt {
  const [who, bank] = c.from.split(" · ");
  const from = c.kind === "recall" ? recallName ?? c.from : who;
  const account = c.kind === "recall" ? c.from : bank ?? CREDIT_METHOD[c.kind];
  return { title: creditTitle(c, recallName), amount: formatNaira(c.amount), status: creditFields(c).status, notice: null,
    rows: rowsOf(c.at, "From", from, account, creditFields(c).fee, c.ref, creditFields(c).bankTransfer), reference: c.ref };
}

/** A deposit: from the card or the sender's bank (a stablecoin: the network). */
export function depositReceipt(r: DepositRecord): Receipt {
  const f = depositFields(r);
  const [who, account] = (r.from ?? `Stablecoin wallet · ${r.sub.replace("Stablecoin · ", "")}`).split(" · ");
  return { title: r.title, amount: fmtDepositAmount(r.amount, r.unit), status: f.status, notice: null,
    rows: rowsOf(r.at, "From", who, account ?? r.method, f.fee, r.ref), reference: r.ref };
}

/** A virtual card's purchase: to the merchant, from the card. */
export function cardPurchaseReceipt(p: CardPurchase): Receipt {
  return { title: p.merchant, amount: fmtSource(p.amount, p.source), status: cardPurchaseFields(p).status, notice: null,
    rows: rowsOf(p.at, "To", p.merchant, `${p.cardName} ••• ${p.last4}`, undefined, p.ref), reference: p.ref };
}

/** The reference's demo records. */
export function demoTxReceipt(t: DemoTx): Receipt {
  const f = demoTxFields(t);
  const out = t.type === "payment";
  return { title: t.title, amount: fmtCurrency(t.amount, "USD"), status: f.status, notice: null,
    rows: rowsOf(t.ts, out ? "To" : "From", out ? f.to! : f.from!, f.method, undefined, t.ref), reference: t.ref };
}

/** What Share sends (or copies): the brand's receipt as text, the notice right under the status. */
export function receiptText(r: Receipt, brand: WalletBrand): string {
  return [
    `${brandInfo(brand).name} receipt`, r.status.label, ...(r.notice ? [r.notice.text] : []), "", r.amount, r.title, "",
    ...r.rows.map(([k, v]) => `${k}: ${v}`), "", POWERED_BY,
  ].join("\n");
}
export const receiptFileName = (r: Receipt, ext: "pdf" | "png") => `receipt-${r.reference}.${ext}`;
