/**
 * Poket's fees (docs/decisions.md, Fees). Amounts are in minor units of the currency they're charged in.
 * - Deposit (bank transfer to a temporary account or the account details): 0.40%, capped at $4.00 (USD) or ₦5,000.00
 *   (NGN), taken from what arrives.
 * - Convert: from USD or a stablecoin, $2.00 (2.00 in the coin) + 0.40%; from NGN, ₦2,000.00 + 0.40%. Charged in the
 *   source, out of the amount converted.
 * - Send to an external account (bank, debit card, stablecoin wallet): $6.00 for USD, 6.00 in the coin for stablecoins,
 *   ₦25.00 for NGN, in the target's currency, on top of the amount. To a Poket (CentryOS) user: free, end to end (naira
 *   that converts to USD on receipt pays no conversion fee).
 * - EUR, GBP and GHS (to confirm): the dollar fees converted at the demo rates (DEMO_USD_PER).
 * Checkout charges the payer nothing: the merchant covers conversion fees there.
 */
import { DEMO_NGN_PER_USD } from "./money";

export type FeeCurrency = "USD" | "NGN" | "EUR" | "GBP" | "GHS";
/** The demo's rates, in USD per unit (Convert's cvUsdPer reads these too). */
export const DEMO_USD_PER: Record<FeeCurrency, number> = { USD: 1, NGN: 1 / DEMO_NGN_PER_USD, EUR: 1.08, GBP: 1.27, GHS: 1 / 15.5 };
/** A dollar amount (cents) in another currency's minor units, at the demo rate. */
export const fromUsd = (usdCents: number, cur: FeeCurrency) => Math.round(usdCents / DEMO_USD_PER[cur]);

export const DEPOSIT_RATE = 0.004;
export const CONVERT_RATE = 0.004;
export const CONVERT_FLAT = { USD: 200, COIN: 200, NGN: 200000 } as const;
export const SEND_FEE = { USD: 600, COIN: 600, NGN: 2500 } as const;

/** The deposit cap: $4.00, ₦5,000.00, else $4.00 at the demo rate (to confirm). */
export const depositCap = (cur: FeeCurrency) => (cur === "NGN" ? 500000 : cur === "USD" ? 400 : fromUsd(400, cur));
/** A deposit's fee: 0.40% of what arrives, up to the cap. */
export const depositFee = (amount: number, cur: FeeCurrency) => Math.min(Math.round(amount * DEPOSIT_RATE), depositCap(cur));

const SYMBOL: Record<FeeCurrency, string> = { USD: "$", NGN: "₦", EUR: "€", GBP: "£", GHS: "GH₵" };
/** An amount in running text: "₦5,000.00", "€3.70". */
const plain = (minor: number, cur: FeeCurrency) => SYMBOL[cur] + (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "0.40% fee, up to ₦5,000.00": the deposit fee as the account cards say it. */
export const depositFeeText = (cur: FeeCurrency) => `0.40% fee, up to ${plain(depositCap(cur), cur)}`;

/** The conversion fee's parts for a source: $2.00 (or its demo equivalent; ₦2,000.00 from NGN) + 0.40%. */
export function convertFeeSpec(source: { k: "cash"; cur: FeeCurrency } | { k: "coin" }): { pct: number; flat: number } {
  if (source.k === "coin") return { pct: CONVERT_RATE, flat: CONVERT_FLAT.COIN };
  if (source.cur === "NGN") return { pct: CONVERT_RATE, flat: CONVERT_FLAT.NGN };
  return { pct: CONVERT_RATE, flat: source.cur === "USD" ? CONVERT_FLAT.USD : fromUsd(CONVERT_FLAT.USD, source.cur) };
}

/** An external send's fee in the target: 6.00 in a coin, ₦25.00, $6.00, else $6.00 at the demo rate (to confirm). */
export function externalSendFee(target: { k: "cash"; cur: FeeCurrency } | { k: "coin" }): number {
  if (target.k === "coin") return SEND_FEE.COIN;
  if (target.cur === "NGN") return SEND_FEE.NGN;
  return target.cur === "USD" ? SEND_FEE.USD : fromUsd(SEND_FEE.USD, target.cur);
}

/**
 * A card top-up's fee (the reference's cardFundFee, *to confirm*: the decided deposit fee covers bank transfers only):
 * 2.9% + 30¢ (₦465.00 for NGN, as the reference; else 30¢ at the demo rate), charged to the card on top of the amount.
 */
export const CARD_FUND_RATE = 0.029;
export const cardFundFlat = (cur: FeeCurrency) => (cur === "NGN" ? Math.round(0.3 * 1550 * 100) : cur === "USD" ? 30 : fromUsd(30, cur));
export const cardFundFee = (amount: number, cur: FeeCurrency) => Math.round(amount * CARD_FUND_RATE) + cardFundFlat(cur);
