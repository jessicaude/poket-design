"use client";
import type { ReactNode } from "react";
import type { Conversion, NgnCredit, Withdrawal } from "@/lib/mock-api";
import { paymentStatus, refundDest, refundedTotal, reversedTotal } from "@/lib/refunds";
import type { Payment, Refund } from "@/store/account";
import { toNigerianBank } from "@/store/partner";
import { cvParse } from "../convert/convertMath";
import { fmtCurrency, fmtFee } from "../payout/payoutMath";
import { QUICK_CHECK, STATUS_META } from "../payout/withdrawals";
import { DetailRow, ReferenceRow, StatusRow } from "../withdrawals/TxDetail";
import { formatTxDate } from "../withdrawals/TxDetail";

/**
 * WGT-11: every transaction's detail has the same rows, in the same order, with the same labels (those that apply):
 * Status, Date, From, To, Method, You send, They get, Rate, Refunded, Reversed, Fee, Reference (the copyable chip,
 * unique per transaction) and, for a bank transfer, the bank's Session ID (not decided: "[session ID]").
 */
export const FIELD_ORDER = ["Status", "Date", "From", "To", "Method", "You send", "They get", "Rate", "Refunded", "Reversed", "Fee", "Reference", "Session ID"] as const;
/** The bank's session ID for a transfer (NIP): its format isn't decided. */
export const SESSION_ID_PLACEHOLDER = "[session ID]";

export type Tone = "" | "muted" | "warn" | "err";
export type TxFieldsData = {
  status: { label: string; tone: Tone };
  at: number;
  from?: string; to?: string; method?: string;
  youSend?: string; theyGet?: string; rate?: string;
  refunded?: string; reversed?: string;
  fee?: string; feeLabel?: string;
  reference: string;
  /** A bank transfer: shows the bank's session ID. */
  bankTransfer?: boolean;
};
export const COMPLETED = { label: "Completed", tone: "" as Tone };

/** The rows, in FIELD_ORDER. `children` go after them (a dispute's row). */
export function TxFields({ f, children }: { f: TxFieldsData; children?: ReactNode }) {
  const opt = (label: string, value?: string) => (value ? <DetailRow label={label} value={value} /> : null);
  return (
    <>
      <StatusRow label={f.status.label} tone={f.status.tone} />
      <DetailRow label="Date" value={formatTxDate(f.at)} />
      {opt("From", f.from)}{opt("To", f.to)}{opt("Method", f.method)}
      {opt("You send", f.youSend)}{opt("They get", f.theyGet)}{opt("Rate", f.rate)}
      {opt("Refunded", f.refunded)}{opt("Reversed", f.reversed)}
      {f.fee && <DetailRow label={f.feeLabel ?? "Fee"} value={f.fee} />}
      <ReferenceRow refText={f.reference} />
      {f.bankTransfer && <DetailRow label="Session ID" value={SESSION_ID_PLACEHOLDER} />}
      {children}
    </>
  );
}

/** A balance's name from its key: "NGN balance", "USD balance", "USDC on Base". */
export function balanceName(key: string | undefined, currency: string): string {
  if (!key) return `${currency} balance`;
  const o = cvParse(key);
  return o.k === "coin" ? `${o.asset} on ${o.net}` : `${o.cur} balance`;
}
/** " on Base" after a stablecoin amount, as the reference's conversion details have it. */
const onNetwork = (key: string) => { const o = cvParse(key); return o.k === "coin" ? ` on ${o.net}` : ""; };

const SEND_METHOD: Record<Withdrawal["kind"], string> = { bank: "Bank transfer", card: "Debit card", poket: "Poket", wallet: "Stablecoin wallet" };

/** A send: from the paying balance to the recipient's account. */
export function withdrawalFields(w: Withdrawal): TxFieldsData {
  const m = STATUS_META[w.status];
  return {
    status: { label: w.status === "review" && w.quickCheck ? QUICK_CHECK.chip : m.chip, tone: m.tone },
    at: w.createdAt, from: balanceName(w.sourceKey, w.currency), to: w.recipientSub, method: SEND_METHOD[w.kind ?? "bank"],
    youSend: w.conversion?.paidText, theyGet: w.conversion?.receivedText, rate: w.conversion?.rateText,
    fee: w.feeText ?? (w.conversion ? `${w.conversion.feeText} + ${fmtFee(w.fee, w.currency)}` : fmtFee(w.fee, w.currency)),
    reference: w.ref, bankTransfer: toNigerianBank(w),
  };
}

/** A conversion: from one balance to another. */
export function conversionFields(c: Conversion): TxFieldsData {
  return { status: COMPLETED, at: c.createdAt, from: c.paidText + onNetwork(c.from), to: c.receivedText + onNetwork(c.to), rate: c.rateText, fee: c.feeText, feeLabel: c.feeLabel, reference: c.ref };
}

/** The payment's status in chip tones: Completed green; Dispute open amber; Refunded, Reversed, Dispute closed grey. */
export function paymentStatusChip(p: Payment): { label: string; tone: Tone } {
  const s = paymentStatus(p);
  return { label: s.label, tone: s.tone === "ok" ? "" : s.tone === "warn" ? "warn" : "muted" };
}
/** A Checkout payment: from the card (a bank transfer has no account to name) to the store. */
export function paymentFields(p: Payment): TxFieldsData {
  const bank = p.methodKind === "bank";
  return {
    status: paymentStatusChip(p), at: new Date(p.at).getTime(),
    from: bank ? undefined : p.method, to: p.merchant, method: bank ? "Bank transfer" : "Card",
    refunded: refundedTotal(p) > 0 ? fmtCurrency(refundedTotal(p), p.currency) : undefined,
    reversed: reversedTotal(p) > 0 ? fmtCurrency(reversedTotal(p), p.currency) : undefined,
    reference: p.id, bankTransfer: bank && p.currency === "NGN",
  };
}

/** A merchant's refund or a reversal: from the store to the card, the NGN balance or the bank account that paid. */
export function refundFields(p: Payment, r: Refund): TxFieldsData {
  const bank = p.methodKind === "bank";
  return {
    status: COMPLETED, at: new Date(r.at).getTime(), from: p.merchant, to: refundDest(p, r),
    method: r.to === "ngn" ? undefined : bank ? "Bank transfer" : "Card",
    reference: r.id, bankTransfer: r.kind === "reversal" && bank && p.currency === "NGN",
  };
}

/** How each NGN credit came in. */
export const CREDIT_METHOD: Record<NgnCredit["kind"], string> = {
  temp: "Bank transfer · Temporary account", account: "Bank transfer · NGN account details",
  delayed: "Bank transfer · NGN account details", poket: "Poket", recall: "Bank transfer · Recall",
};
/** Naira into the NGN balance: free to receive (a recall has no fee line). */
export function creditFields(c: NgnCredit): TxFieldsData {
  return {
    status: COMPLETED, at: c.at, from: c.from, to: "NGN balance", method: CREDIT_METHOD[c.kind],
    fee: c.kind === "recall" ? undefined : "Free", reference: c.ref, bankTransfer: c.kind !== "poket",
  };
}

/** A credit's row: "Top-up · Bank transfer", "From Chinedu Eze · Zenith Bank", "Recovered · To {name}"... (NEW copy). */
export function creditTitle(c: NgnCredit, recipientName?: string) {
  if (c.kind === "temp") return "Top-up · Bank transfer";
  if (c.kind === "recall") return `Recall · ${recipientName ?? c.from}`;
  return `From ${c.from.split(" · ")[0]}`;
}
