import { WICON } from "@/lib/icons";
import { formatMinor } from "@/lib/money";
import type { PayoutCurrency, PayoutRecipient } from "@/lib/mock-api";
import { NGN_VA } from "../ngn/useNgn";

/**
 * Pure helpers behind tPayout in reference/poket-unified.html: currencyInfo, fmtCurrency, sendFee, withdrawFee,
 * withdrawEta, deliveryEta, convertAmount, fxRateLabel, payoutMethodSub and the add-recipient readiness checks.
 * Amounts are integer minor units (kobo, cents).
 */

export const CURRENCY_INFO: Record<PayoutCurrency, { name: string; symbol: string; icon: keyof typeof WICON | null }> = {
  USD: { name: "US Dollar", symbol: "$", icon: "usFlag" },
  NGN: { name: "Nigerian Naira", symbol: "₦", icon: "ngFlag" },
  EUR: { name: "Euro", symbol: "€", icon: null },
  GBP: { name: "British Pound", symbol: "£", icon: "gbFlag" },
  GHS: { name: "Ghanaian Cedi", symbol: "GH₵", icon: "ghFlag" },
};

/** fmtCurrency(cents, cur): "₦50,000.00 NGN". */
export const fmtCurrency = (minor: number, cur: PayoutCurrency) => formatMinor(minor, CURRENCY_INFO[cur].symbol, cur);

/**
 * fxToUSD as exact fractions [num, den] (USD per unit), so conversions stay in integer maths:
 * NGN 1/1550, EUR 1.08, GBP 1.27, GHS 1/15.5.
 */
const FX_TO_USD: Record<PayoutCurrency, [number, number]> = { USD: [1, 1], NGN: [1, 1550], EUR: [108, 100], GBP: [127, 100], GHS: [2, 31] };

/** convertAmount(cents, from, to), rounded to the nearest minor unit. */
export function convertAmount(minor: number, from: PayoutCurrency, to: PayoutCurrency): number {
  if (from === to) return minor;
  const [fn, fd] = FX_TO_USD[from], [tn, td] = FX_TO_USD[to];
  return Math.round((minor * fn * td) / (fd * tn));
}

/** fxRateLabel(from, to): "1 NGN = 0.0006 USD" (4 decimal places at most, like the reference). */
export function fxRateLabel(from: PayoutCurrency, to: PayoutCurrency): string {
  const [fn, fd] = FX_TO_USD[from], [tn, td] = FX_TO_USD[to];
  const equiv = Math.round((fn * td * 10000) / (fd * tn)) / 10000;
  return `1 ${from} = ${equiv.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${to}`;
}

/** The reference prices NGN fees as the naira equivalent of a USD fee, at 1,550. */
const usdEquiv = (cur: PayoutCurrency, usdCents: number) => (cur === "NGN" ? usdCents * 1550 : usdCents);

/** sendFee(cur): a flat $1.00 equivalent, for payouts to someone else. */
export const sendFee = (cur: PayoutCurrency) => usdEquiv(cur, 100);

/** withdrawFee(cur, speed, amount), for payouts to your own methods: instant 1.5% (min $1 equivalent), standard $0.50 equivalent. */
export function withdrawFee(cur: PayoutCurrency, speed: Speed, amount: number): number {
  if (speed === "instant") return Math.max(Math.round(amount * 0.015), usdEquiv(cur, 100));
  return usdEquiv(cur, 50);
}
export type Speed = "standard" | "instant";

/**
 * NGN has no speed choice: NIP bank transfers usually arrive within seconds (NGN_VA.arrives, the reference's
 * VA_SPEC.NGN). Other currencies keep Standard / Instant.
 */
export const hasSpeeds = (cur: PayoutCurrency) => cur !== "NGN";
/** Arrival estimate for a payout: NGN's one speed, else withdrawEta for your own methods and deliveryEta for others. */
export const payoutEta = (cur: PayoutCurrency, r: PayoutRecipient, speed: Speed) =>
  !hasSpeeds(cur) ? NGN_VA.arrives : r.isSelf ? withdrawEta(speed) : deliveryEta(cur, r.currency);
/** NGN pays out only to Nigerian bank accounts, so there's no conversion; other currencies list every recipient. */
export const recipientsFor = (list: PayoutRecipient[], cur: PayoutCurrency) =>
  cur === "NGN" ? list.filter((r) => r.currency === "NGN" && r.methodType === "bank") : list;
/**
 * Amounts over ₦[step-up] need step-up verification before the PIN. The limit isn't decided, so screens show the
 * placeholder; STEP_UP_DEMO_KOBO (₦20,000.00) is only a demo value so the step can be reached from a ₦50,000 balance.
 */
export const STEP_UP_PLACEHOLDER = "\u20a6[step-up]";
export const STEP_UP_DEMO_KOBO = 2000000;
export const needsStepUp = (cur: PayoutCurrency, amount: number) => cur === "NGN" && amount > STEP_UP_DEMO_KOBO;

/** How long a first NGN payment to a new account is held before it sends: not decided, so a placeholder (ngn.mdc). */
export const HOLD_PLACEHOLDER = "[hold]";
/** A first NGN payment to this account: it's held for [hold] before it sends. */
export const isFirstPayment = (cur: PayoutCurrency, r: PayoutRecipient | null) => cur === "NGN" && !!r && !r.paidBefore;

/** Paying someone in another currency (never for NGN). */
export const isCrossBorder = (cur: PayoutCurrency, r: PayoutRecipient | null) => !!r && cur !== "NGN" && r.currency !== cur;

export const withdrawEta = (speed: Speed) => (speed === "instant" ? "Within 30 minutes" : "1-3 business days");
export const deliveryEta = (from: PayoutCurrency, to: PayoutCurrency) => (from === to ? "Within minutes" : "1-2 business days");

/**
 * NGN fees aren't decided (ngn.mdc): every NGN fee on screen is the placeholder ₦[fee], and the maths leaves it out
 * (it counts as 0), so no made-up number leaks through totals, Max or the balance. Other currencies keep the reference's fees.
 */
export const FEE_PLACEHOLDER = "\u20a6[fee]";
export const feeDecided = (cur: PayoutCurrency) => cur !== "NGN";

/** The fee for this recipient: withdrawFee for your own methods, sendFee for others; 0 while undecided. */
export const payoutFee = (cur: PayoutCurrency, r: PayoutRecipient | null, speed: Speed, amount: number) =>
  !feeDecided(cur) ? 0 : r?.isSelf ? withdrawFee(cur, speed, amount) : sendFee(cur);

/** A fee as shown: the amount, or ₦[fee] while undecided. */
export const fmtFee = (fee: number, cur: PayoutCurrency) => (feeDecided(cur) ? fmtCurrency(fee, cur) : FEE_PLACEHOLDER);
/** A total that includes the fee: "₦12,500.00 NGN + ₦[fee]" while undecided. */
export const fmtWithFee = (amount: number, fee: number, cur: PayoutCurrency) =>
  feeDecided(cur) ? fmtCurrency(amount + fee, cur) : `${fmtCurrency(amount, cur)} + ${FEE_PLACEHOLDER}`;

/** "Max": the reference's payoutMaxAmt. Standard self payouts use the whole balance (the fee then makes it too much; see the report). */
export function maxPayout(cur: PayoutCurrency, r: PayoutRecipient | null, speed: Speed, avail: number): number {
  if (!feeDecided(cur)) return avail; // no fee to leave room for yet
  if (r?.isSelf && speed === "instant") {
    let amt = Math.round((avail * 1000) / 1015);
    const min = usdEquiv(cur, 100);
    if (Math.round(amt * 0.015) < min) amt = Math.max(0, avail - min);
    return amt;
  }
  if (!r?.isSelf) return Math.max(0, avail - sendFee(cur));
  return avail;
}

export function payoutMethodIcon(r: Pick<PayoutRecipient, "methodType">): string {
  if (r.methodType === "card") return WICON.card;
  if (r.methodType === "zelle") return WICON.zelleLogo;
  if (r.methodType === "cashapp") return WICON.cashappLogo;
  return WICON.bank;
}
export const isLogoMethod = (r: Pick<PayoutRecipient, "methodType">) => r.methodType === "zelle" || r.methodType === "cashapp";
/** payoutMethodBadgeHtml(r): logos fill the badge; other icons sit in a grey span. */
export const payoutMethodBadgeHtml = (r: Pick<PayoutRecipient, "methodType">) =>
  isLogoMethod(r) ? payoutMethodIcon(r) : `<span style="display:inline-flex;color:var(--txt2)">${payoutMethodIcon(r)}</span>`;

/** payoutMethodSub(r): "GTBank · •••• 6789", "•••• 4242", "Zelle · name@email.com", "$cashtag". */
export function payoutMethodSub(r: PayoutRecipient): string {
  if (r.methodType === "card") {
    if (r.cardNumber) return `•••• ${r.cardNumber.replace(/\D/g, "").slice(-4)}`;
    return r.accountNumber || "";
  }
  if (r.methodType === "zelle") return `Zelle · ${r.zelleContact || ""}`;
  if (r.methodType === "cashapp") return r.cashtag || "";
  const acct = r.accountNumber || "";
  return `${r.bankName} · ${acct.length > 4 ? `•••• ${acct.slice(-4)}` : acct}`;
}

/** formatCardNumber: 16 digits in groups of 4. */
export const formatCardNumber = (raw: string) => (raw.replace(/\D/g, "").slice(0, 16).match(/.{1,4}/g) || []).join(" ");


const COUNTRY_FLAGS: Record<string, keyof typeof WICON> = { "United States": "usFlag", "United Kingdom": "gbFlag", Nigeria: "ngFlag", Ghana: "ghFlag" };
export const COUNTRY_OPTIONS = [
  "United States", "Canada", "United Kingdom", "Ireland", "Nigeria", "Ghana", "Kenya", "South Africa",
  "Germany", "France", "Netherlands", "Spain", "Italy", "Portugal", "India", "Australia", "Other",
].map((c) => ({ value: c, label: c, icon: WICON[COUNTRY_FLAGS[c]] || WICON.globe }));
export const US_STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana",
  "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
  "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"].map((s) => ({ value: s, label: s }));

export const METHOD_OPTIONS = [
  { value: "bank", label: "Bank transfer", icon: WICON.bank },
  { value: "card", label: "Debit card", icon: WICON.card },
  { value: "zelle", label: "Zelle", icon: WICON.zelleLogo },
  { value: "cashapp", label: "Cash App", icon: WICON.cashappLogo },
];
export const RAIL_OPTIONS = [
  { value: "ACH", label: "ACH", sub: "1-3 business days" },
  { value: "RTP", label: "RTP · Real-Time Payments", sub: "Within minutes" },
  { value: "Wire", label: "Wire transfer", sub: "Same business day" },
];

/** S.payoutRecipientDraft. */
export type Draft = Partial<Omit<PayoutRecipient, "id" | "isSelf">>;

const hasAddress = (d: Draft) => !!((d.address || "").trim() && (d.city || "").trim() && (d.state || "").trim() && (d.zip || "").trim() && (d.country || "").trim());

/** The method part of checkPayoutDraft / checkPayoutOtherMethodDraft. */
export function methodReady(d: Draft): boolean {
  if ((d.methodType ?? "bank") === "bank") {
    // NGN bank accounts don't come through here: they use name enquiry (usePayout.saveNgnAccount).
    return !!(d.railType && (d.routingNumber || "").length === 9 && (d.bankName || "").trim() && (d.accountNumber || "").trim().length >= 4 && hasAddress(d));
  }
  if (d.methodType === "card") return (d.cardNumber || "").replace(/\D/g, "").length === 16 && hasAddress(d);
  if (d.methodType === "zelle") return !!(d.zelleContact && d.zelleContact.trim().length > 3);
  return !!(d.cashtag && d.cashtag.trim().length > 1);
}

/** Your own method must be in the verified account holder's name (case-insensitive). */
export const holderMatches = (d: Draft, legalName: string) => !!(d.holderName && legalName && d.holderName.trim().toLowerCase() === legalName.trim().toLowerCase());

const US_BANKS = ["Chase Bank", "Bank of America", "Wells Fargo", "Citibank", "Capital One", "US Bank", "PNC Bank", "Truist Bank"];
/** seededRandom(seed), verbatim. */
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 0x1000000; };
}
/** resolveUsBankName(routing): a made-up bank for any 9-digit routing number (prototype only). */
export function resolveUsBankName(routing: string): string {
  if (routing.length !== 9) return "";
  return US_BANKS[Math.floor(seededRandom("rt" + routing)() * US_BANKS.length)];
}
