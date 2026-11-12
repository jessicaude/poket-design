import type { PayoutRecipient } from "@/lib/mock-api";
import { cvFeeText, cvFmt, cvParse, cvQuote, cvRateText, cvType, cvUsdPer, feePlaceholder, involvesNgn } from "../convert/convertMath";
import { NGN_VA } from "../ngn/useNgn";
import { FEE_PLACEHOLDER, HOLD_PLACEHOLDER, fmtCurrency } from "../payout/payoutMath";
import { targetKeyFor } from "./sources";

/**
 * One summary of a send, for any kind of recipient, read by the amount, review, done and status screens.
 * Fees and arrival: NGN banks follow ngn.mdc (₦[fee], "Usually within seconds", the first-payment hold); US banks have
 * one speed, "1 to 3 business days", fee $[fee] (undecided); UK banks are free, within minutes; debit cards
 * arrive instantly, fee $[fee] (undecided); Poket users are free and arrive instantly; stablecoin wallets cost 1.50 in
 * the coin (the explore prototype's feeFor) and take about a minute.
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

/** A debit card's or US bank's fee: not decided, so a placeholder (counts as 0 in the maths, like ₦[fee]). */
export const CARD_FEE_PLACEHOLDER = "$[fee]";
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
  const feeTarget = kind === "wallet" ? 150 : 0;
  const sendFeeText = ngnBank ? FEE_PLACEHOLDER
    : kind === "card" || usBank ? CARD_FEE_PLACEHOLDER
    : feeTarget === 0 ? "Free"
    : tgt.k === "coin" ? cvFmt(feeTarget, tgt) : fmtCurrency(feeTarget, tgt.k === "cash" ? tgt.cur : "USD");
  const q = converting ? cvQuote(payFrom, targetKey, payCents, jitter) : null;
  const feeText = q ? `${cvFeeText(q)} + ${sendFeeText}` : sendFeeText;

  // In the source's units: the fee converts at the quote's USD values
  const feeSource = converting ? Math.round((feeTarget * cvUsdPer(tgt)) / cvUsdPer(src)) : feeTarget;
  const sourceTotal = payCents + feeSource;
  const undecided = ngnBank || kind === "card" || usBank || (q !== null && involvesNgn(q.f, q.to));
  const placeholder = converting ? feePlaceholder(src) : kind === "card" || usBank ? CARD_FEE_PLACEHOLDER : FEE_PLACEHOLDER;
  // Every decided fee is in the total, in the source currency; an undecided one is added as its placeholder
  const totalText = undecided ? `${cvFmt(sourceTotal, src)} + ${placeholder}` : cvFmt(sourceTotal, src);

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
