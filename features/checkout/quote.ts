import { DEMO_NGN_PER_USD } from "@/lib/money";
import { CV_QUOTE_SECONDS, cvRateText } from "@/features/wallet/convert/convertMath";
import type { PaymentMethod } from "@/store/account";
import type { MerchantSettings, Order } from "./useCheckout";

/**
 * Paying an NGN order with a USD card or bank (merchant accepts Conversion): a quote held for CV_QUOTE_SECONDS,
 * as in the reference's convert review (cvNewQuote: the rate moves up to ±0.2% on each new quote).
 * The merchant covers the conversion fee ("Covered by {merchant}", as the summary's Fees line).
 */
export type Quote = { jitter: number; at: number };
export const QUOTE_SECONDS = CV_QUOTE_SECONDS;

/** A USD method paying an NGN order, converted. */
export const isConverting = (order: Order | null, settings: MerchantSettings | null, m: PaymentMethod | undefined) =>
  !!order && !!m && order.currency === "NGN" && !!settings?.accepts.conversion && m.currency !== "NGN";

/** A USD method on an NGN order when the merchant doesn't accept Conversion: shown disabled, can't be selected or pay. */
export const isBlockedMethod = (order: Order | null, settings: MerchantSettings | null, m: PaymentMethod | undefined) =>
  !!order && !!m && order.currency === "NGN" && !settings?.accepts.conversion && m.currency !== "NGN";
/** Copy on a disabled dollar method (NEW copy, not in the prototypes). */
export const nairaOnlyText = (merchant: string) => `${merchant} only accepts naira for this order.`;

/** The first method that can pay this order. */
export const firstUsable = (methods: PaymentMethod[], order: Order | null, settings: MerchantSettings | null) =>
  methods.find((m) => !isBlockedMethod(order, settings, m))?.id ?? null;

export const newQuote = (first = false): Quote => ({ jitter: first ? 1 : 1 + (Math.random() - 0.5) * 0.004, at: Date.now() });

/** Naira per dollar for this quote. */
export const quoteRate = (q: Quote) => DEMO_NGN_PER_USD * q.jitter;
/** The rate sent to the merchant (fx_rate): naira per dollar, 4 decimals. */
export const quoteFxRate = (q: Quote) => Math.round(quoteRate(q) * 10000) / 10000;
/** The dollars debited for `kobo`, rounded up to the cent so the merchant gets the full naira amount. */
export const quoteUsdCents = (kobo: number, q: Quote) => Math.ceil(kobo / quoteRate(q) - 1e-9);
/** "1 USD ≈ 1,550.00 NGN" */
export const quoteRateText = (q: Quote) =>
  cvRateText({ k: "cash", cur: "USD", bucket: "open" }, { k: "cash", cur: "NGN", bucket: "open" }, q.jitter, false);
/** Seconds the rate is still held. */
export const quoteLeft = (q: Quote, now = Date.now()) => Math.max(0, QUOTE_SECONDS - Math.floor((now - q.at) / 1000));
