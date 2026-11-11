import type { PayoutRecipient } from "@/lib/mock-api";
import { cvFeeText, cvFmt, cvParse, cvQuote, cvRateText, cvType, cvUsdPer, feePlaceholder, involvesNgn } from "../convert/convertMath";
import { NGN_VA } from "../ngn/useNgn";
import { FEE_PLACEHOLDER, HOLD_PLACEHOLDER, fmtCurrency } from "../payout/payoutMath";
import { usSpeeds } from "./sendMath";
import { targetKeyFor } from "./sources";

/**
 * One summary of a send, for any kind of recipient, read by the amount, review, done and status screens.
 * Fees and arrival: NGN banks follow ngn.mdc (₦[fee], "Usually within seconds", the first-payment hold); US banks use
 * the speed chosen for this send (the explore prototype's speedsFor); UK banks are free, within minutes; debit cards
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
};

const US_SPEED_FEE: Record<string, number> = { rtp: 150, ach: 0, wire: 1500 };
/** A debit card's fee: not decided, so a placeholder (counts as 0 in the maths, like ₦[fee]). */
export const CARD_FEE_PLACEHOLDER = "$[fee]";

/** `speed`: a US bank send's speed, chosen on the amount screen (rtp, ach, wire); Standard (ach) by default. */
export function sendSummary(r: PayoutRecipient, payFrom: string, payCents: number, cents: number, jitter: number, speed = "ach"): SendSummary {
  const kind = r.methodType === "poket" ? "poket" : r.methodType === "wallet" ? "wallet" : r.methodType === "card" ? "card" : "bank";
  const targetKey = targetKeyFor(r, payFrom);
  const src = cvParse(payFrom), tgt = cvParse(targetKey);
  const converting = !!cvType(src, tgt);
  const ngnBank = kind === "bank" && r.currency === "NGN";
  const firstPayment = kind === "bank" && !r.paidBefore;

  // The send's own fee, in the target's units
  const feeTarget = kind === "wallet" ? 150 : kind === "bank" && r.currency === "USD" ? US_SPEED_FEE[speed] ?? 0 : 0;
  const sendFeeText = ngnBank ? FEE_PLACEHOLDER
    : kind === "card" ? CARD_FEE_PLACEHOLDER
    : feeTarget === 0 ? "Free"
    : tgt.k === "coin" ? cvFmt(feeTarget, tgt) : fmtCurrency(feeTarget, tgt.k === "cash" ? tgt.cur : "USD");
  const q = converting ? cvQuote(payFrom, targetKey, payCents, jitter) : null;
  const feeText = q ? `${cvFeeText(q)} + ${sendFeeText}` : sendFeeText;

  // In the source's units: the fee converts at the quote's USD values
  const feeSource = converting ? Math.round((feeTarget * cvUsdPer(tgt)) / cvUsdPer(src)) : feeTarget;
  const sourceTotal = payCents + feeSource;
  const undecided = ngnBank || kind === "card" || (q !== null && involvesNgn(q.f, q.to));
  const placeholder = converting ? feePlaceholder(src) : kind === "card" ? CARD_FEE_PLACEHOLDER : FEE_PLACEHOLDER;
  const totalText = undecided ? `${cvFmt(payCents, src)} + ${placeholder}` : cvFmt(sourceTotal, src);

  // A first payment to any bank account is scheduled: it sends after [hold] (ngn.mdc, applied to every bank)
  const arrival = firstPayment ? `After ${HOLD_PLACEHOLDER}`
    : ngnBank ? NGN_VA.arrives
    : kind === "bank" && r.currency === "USD" ? usSpeeds(true).find((x) => x.id === speed)?.eta ?? "1 to 3 business days"
    : kind === "bank" ? "Within minutes"
    : kind === "card" || kind === "poket" ? "Instantly"
    : "About 1 minute";

  return {
    kind, targetKey, converting, theyGetText: cvFmt(cents, tgt), feeTarget, feeText,
    ...(q ? { youSendText: cvFmt(payCents, src), rateText: cvRateText(src, tgt, jitter, false) } : {}),
    sourceTotal, totalText, arrival, firstPayment,
  };
}
