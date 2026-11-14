import type { PayoutRecipient } from "@/lib/mock-api";
import { SEND_FEE, externalSendFee } from "@/lib/fees";
import { cvFeeText, cvFmt, cvParse, cvQuote, cvRateText, cvType, cvUsdPer } from "../convert/convertMath";
import { NGN_VA } from "../ngn/useNgn";
import { HOLD_PLACEHOLDER, fmtCurrency } from "../payout/payoutMath";
import { targetKeyFor } from "./sources";

/**
 * One summary of a send, for any kind of recipient, read by the amount, review, done and status screens.
 * Fees (lib/fees.ts), in the target, on top of the amount: ₦25.00 to a Nigerian bank; $6.00 to a US bank or a debit
 * card; 6.00 in the coin to a stablecoin wallet; EUR, GBP and GHS banks $6.00 at the demo rate (to confirm); free to
 * a Poket user, end to end. A send that converts also pays the conversion fee, out of the amount. Arrival: NGN banks "Usually within seconds" (with the
 * first-payment hold); US banks "1 to 3 business days"; UK banks within minutes; debit cards and Poket users
 * instantly; stablecoin wallets about a minute.
 */
export type SendSummary = {
  kind: "bank" | "card" | "poket" | "wallet";
  targetKey: string;
  converting: boolean;
  /** What they get, in the target ("₦15,500.00 NGN", "10.00 USDC"). */
  theyGetText: string;
  /** The send's fee in the target's units (0 where undecided), its text, and the whole fee text (with a conversion's). */
  feeTarget: number;
  feeText: string;
  /** Converting: the source amount and the rate. */
  youSendText?: string;
  rateText?: string;
  /** What leaves the source in all (in the source's units) and how it reads. */
  sourceTotal: number;
  totalText: string;
  arrival: string;
  /** A first payment to a bank account: sends after [hold]. */
  firstPayment: boolean;
  /** How long it takes once it's sending (the arrival without the first-payment hold): the Sending status's message. */
  eta: string;
  /** The USD value of what leaves the source (sourceTotal), in cents, unrounded: what step-up is judged on. */
  usdOut: number;
  /** A Poket user paid from card-funded USD: their money keeps the FIAT-ONLY tag. */
  tag?: "FIAT-ONLY";
};

/** US bank sends have one speed (no Instant or Wire choice). */
export const US_BANK_ETA = "1 to 3 business days";

export function sendSummary(r: PayoutRecipient, payFrom: string, payCents: number, cents: number, jitter: number): SendSummary {
  const kind = r.methodType === "poket" ? "poket" : r.methodType === "wallet" ? "wallet" : r.methodType === "card" ? "card" : "bank";
  const targetKey = targetKeyFor(r, payFrom);
  const src = cvParse(payFrom), tgt = cvParse(targetKey);
  const converting = !!cvType(src, tgt);
  const ngnBank = kind === "bank" && r.currency === "NGN";
  const firstPayment = kind === "bank" && !r.paidBefore;
  const usBank = kind === "bank" && r.currency === "USD";

  // The send's own fee, in the target's units
  // A bank or wallet: the target's fee ($6.00, 6.00 in the coin, ₦25.00; EUR, GBP and GHS at the demo rate); a card: $6.00
  const feeTarget = kind === "poket" ? 0 : kind === "card" ? SEND_FEE.USD : externalSendFee(tgt);
  const sendFeeText = feeTarget === 0 ? "Free"
    : tgt.k === "coin" ? cvFmt(feeTarget, tgt) : fmtCurrency(feeTarget, tgt.k === "cash" ? tgt.cur : "USD");
  // A Poket user is free end to end: naira that converts to USD on receipt pays no conversion fee either
  const q = converting ? cvQuote(payFrom, targetKey, payCents, jitter, kind === "poket") : null;
  // A send that converts: the conversion's fee (in the source), then the send's (in the target), when it has one
  const feeText = q && q.fee ? (feeTarget ? `${cvFeeText(q)} + ${sendFeeText}` : cvFeeText(q)) : sendFeeText;

  // In the source's units: the fee converts at the quote's USD values
  const feeSource = converting ? Math.round((feeTarget * cvUsdPer(tgt)) / cvUsdPer(src)) : feeTarget;
  const sourceTotal = payCents + feeSource;
  // Every fee is in the total, in the source currency
  const totalText = cvFmt(sourceTotal, src);

  const eta = ngnBank ? NGN_VA.arrives
    : usBank ? US_BANK_ETA
    : kind === "bank" ? "Within minutes"
    : kind === "card" || kind === "poket" ? "Instantly"
    : "About 1 minute";
  // A first payment to any bank account is scheduled: it sends after [hold] (ngn.mdc, applied to every bank)
  const arrival = firstPayment ? `After ${HOLD_PLACEHOLDER}` : eta;
  const tag = kind === "poket" && src.k === "cash" && src.bucket === "fiat" ? "FIAT-ONLY" as const : undefined;

  return {
    kind, targetKey, converting, theyGetText: cvFmt(cents, tgt), feeTarget, feeText,
    ...(q ? { youSendText: cvFmt(payCents, src), rateText: cvRateText(src, tgt, jitter, false) } : {}),
    sourceTotal, totalText, arrival, firstPayment, eta, usdOut: sourceTotal * cvUsdPer(src), ...(tag ? { tag } : {}),
  };
}
