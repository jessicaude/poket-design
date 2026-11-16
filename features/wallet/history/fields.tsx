"use client";
import type { ReactNode } from "react";
import type { Conversion, NgnCredit, Withdrawal } from "@/lib/mock-api";
import { paymentStatus, refundDest, refundedTotal, reversedTotal } from "@/lib/refunds";
import type { Payment, Refund } from "@/store/account";
import { toNigerianBank } from "@/store/partner";
import { cvParse } from "../convert/convertMath";
import { fmtCurrency, fmtFee } from "../payout/payoutMath";
import { STATUS_META } from "../payout/withdrawals";
import { DetailRow, ReferenceRow, StatusRow } from "../withdrawals/TxDetail";
import { formatTxDate } from "../withdrawals/TxDetail";
import type { DepositRecord } from "../deposit/useDeposit";
import type { CashCurrency } from "../useHoldings";
import type { CardPurchase } from "../card/useCards";
import type { DemoTx } from "../home/homeData";

/**
 * WGT-11: every transaction's detail has the same rows, in the same order, with the same labels (those that apply):
 * Status, Date, From, To, Method, Network (stablecoins), You send, They get, Rate, Refunded, Reversed, Fee, On your
 * statement (card deposits), Reference (the copyable chip, unique per transaction), for a bank transfer the bank's
 * Session ID (not decided: "[session ID]"), and last a card deposit's highlighted Total charged.
 */
export const FIELD_ORDER = ["Status", "Date", "From", "To", "Method", "Network", "You send", "They get", "Rate", "Refunded", "Reversed", "Fee", "On your statement", "Reference", "Session ID", "Total charged"] as const;
/** The bank's session ID for a transfer (NIP): its format isn't decided. */
export const SESSION_ID_PLACEHOLDER = "[session ID]";

export type Tone = "" | "muted" | "warn" | "err";
export type TxFieldsData = {
  status: { label: string; tone: Tone };
  at: number;
  from?: string; to?: string; method?: string;
  /** A stablecoin's network ("Base"): stablecoin deposits, sends and conversions. */
  network?: string;
  youSend?: string; theyGet?: string; rate?: string;
  refunded?: string; reversed?: string;
  fee?: string; feeLabel?: string;
  /** A card deposit: the statement descriptor ("POKET"). */
  statement?: string;
  reference: string;
  /** A bank transfer: shows the bank's session ID. */
  bankTransfer?: boolean;
  /** A card deposit: the amount plus the card fee, the highlighted last row. */
  total?: string;
};
export const COMPLETED = { label: "Completed", tone: "" as Tone };

/** The rows, in FIELD_ORDER. `children` go after them (a dispute's row). */
export function TxFields({ f, children }: { f: TxFieldsData; children?: ReactNode }) {
  const opt = (label: string, value?: string) => (value ? <DetailRow label={label} value={value} /> : null);
  return (
    <>
      <StatusRow label={f.status.label} tone={f.status.tone} />
      <DetailRow label="Date" value={formatTxDate(f.at)} />
      {opt("From", f.from)}{opt("To", f.to)}{opt("Method", f.method)}{opt("Network", f.network)}
      {opt("You send", f.youSend)}{opt("They get", f.theyGet)}{opt("Rate", f.rate)}
      {opt("Refunded", f.refunded)}{opt("Reversed", f.reversed)}
      {f.fee && <DetailRow label={f.feeLabel ?? "Fee"} value={f.fee} />}
      {opt("On your statement", f.statement)}
      <ReferenceRow refText={f.reference} />
      {f.bankTransfer && <DetailRow label="Session ID" value={SESSION_ID_PLACEHOLDER} />}
      {children}
      {/* The highlighted total, always last (the done and review cards' style) */}
      {f.total && <DetailRow label="Total charged" value={f.total} total />}
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
/** A balance's network, when it's a stablecoin. */
const coinNetwork = (key: string) => { const o = cvParse(key); return o.k === "coin" ? o.net : undefined; };

const SEND_METHOD: Record<Withdrawal["kind"], string> = { bank: "Bank transfer", card: "Debit card", poket: "CentryLink", wallet: "Stablecoin wallet" };

/** A send: from the paying balance to the recipient's account. */
export function withdrawalFields(w: Withdrawal): TxFieldsData {
  const m = STATUS_META[w.status];
  return {
    status: { label: m.chip, tone: m.tone },
    at: w.createdAt, from: balanceName(w.sourceKey, w.currency), to: w.recipientSub, method: SEND_METHOD[w.kind ?? "bank"],
    youSend: w.conversion?.paidText, theyGet: w.conversion?.receivedText, rate: w.conversion?.rateText,
    fee: w.feeText ?? (w.conversion ? `${w.conversion.feeText} + ${fmtFee(w.fee, w.currency)}` : fmtFee(w.fee, w.currency)),
    reference: w.ref, bankTransfer: toNigerianBank(w), network: w.network,
  };
}

/** A conversion: from one balance to another. */
export function conversionFields(c: Conversion): TxFieldsData {
  return { status: COMPLETED, at: c.createdAt, from: c.paidText + onNetwork(c.from), to: c.receivedText + onNetwork(c.to), network: coinNetwork(c.to) ?? coinNetwork(c.from), rate: c.rateText, fee: c.feeText, feeLabel: c.feeLabel, reference: c.ref };
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
  delayed: "Bank transfer · NGN account details", poket: "CentryLink", recall: "Bank transfer · Recall",
};
/** Naira into the NGN balance: a deposit's fee (0.40%, capped), free from a CentryLink user; a recall has no fee line. */
export function creditFields(c: NgnCredit): TxFieldsData {
  return {
    status: COMPLETED, at: c.at, from: c.from, to: "NGN balance", method: CREDIT_METHOD[c.kind],
    fee: c.kind === "recall" ? undefined : c.fee ? fmtCurrency(c.fee, "NGN") : "Free", reference: c.ref, bankTransfer: c.kind !== "poket",
  };
}

/** A credit's row: "Top-up · Bank transfer", "From Chinedu Eze · Zenith Bank", "Recovered · To {name}"... (NEW copy). */
export function creditTitle(c: NgnCredit, recipientName?: string) {
  if (c.kind === "temp") return "Top-up · Bank transfer";
  if (c.kind === "recall") return `Recall · ${recipientName ?? c.from}`;
  return `From ${c.from.split(" · ")[0]}`;
}

/** What a card deposit shows on the card's statement (the reference's statement descriptor). */
export const CARD_STATEMENT_DESCRIPTOR = "POKET";

/** A deposit: by card (its fee), bank transfer to account details (the deposit fee) or a stablecoin address (free). */
export function depositFields(r: DepositRecord): TxFieldsData {
  // A stablecoin deposit is free; cash pays the card fee or the deposit fee
  const fee = r.fee && r.kind !== "coin" ? fmtCurrency(r.fee, r.unit as CashCurrency) : "Free";
  const card = r.kind === "card";
  return { status: COMPLETED, at: r.at, from: r.from, to: balanceName(r.key, r.unit), method: r.method, network: coinNetwork(r.key), fee, feeLabel: card ? "Card fee" : undefined,
    statement: card ? CARD_STATEMENT_DESCRIPTOR : undefined, reference: r.ref, total: card ? fmtCurrency(r.gross, r.unit as CashCurrency) : undefined };
}

/** A virtual card's purchase: from the card (spending from its balance) to the merchant. */
export function cardPurchaseFields(p: CardPurchase): TxFieldsData {
  const balance = p.source.k === "cash" ? `${p.source.cur} balance` : `${p.source.asset} on ${p.source.net}`;
  return { status: { label: "Approved", tone: "" }, at: p.at, from: `${p.cardName} ••• ${p.last4} · ${balance}`, to: p.merchant, method: "Virtual card", reference: p.ref };
}

/** The reference's demo records: a Checkout payment and its refund, and a card top-up. */
export function demoTxFields(t: DemoTx): TxFieldsData {
  const merchant = t.details.find(([k]) => k === "Merchant")?.[1] ?? t.title;
  const base = { status: COMPLETED, at: t.ts, reference: t.ref };
  if (t.type === "payment") return { ...base, from: "USD balance", to: merchant, method: "Checkout" };
  if (t.type === "refund") return { ...base, from: merchant, to: "USD balance", method: "Checkout" };
  return { ...base, from: t.title.split(" · ")[1], to: "USD balance", method: "Card" };
}
