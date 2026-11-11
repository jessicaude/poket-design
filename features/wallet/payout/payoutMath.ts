import { WICON } from "@/lib/icons";
import { formatMinor, formatNaira } from "@/lib/money";
import type { PayoutCurrency, PayoutRecipient } from "@/lib/mock-api";

/**
 * Pure helpers behind tPayout in reference/poket-unified.html (currencyInfo, fmtCurrency, payoutMethodSub) and the
 * naira placeholders (ngn.mdc). Send's fees, totals and arrival are in features/wallet/send/sendSummary.ts.
 * Amounts are integer minor units (kobo, cents).
 */

export const CURRENCY_INFO: Record<PayoutCurrency, { name: string; symbol: string; icon: keyof typeof WICON | null }> = {
  USD: { name: "US Dollar", symbol: "$", icon: "usFlag" },
  NGN: { name: "Nigerian Naira", symbol: "₦", icon: "ngFlag" },
  EUR: { name: "Euro", symbol: "€", icon: null },
  GBP: { name: "British Pound", symbol: "£", icon: "gbFlag" },
  GHS: { name: "Ghanaian Cedi", symbol: "GH₵", icon: "ghFlag" },
};

/** fmtCurrency(cents, cur): "₦50,000.00 NGN". Naira always goes through formatNaira (ngn.mdc). */
export const fmtCurrency = (minor: number, cur: PayoutCurrency) => (cur === "NGN" ? formatNaira(minor) : formatMinor(minor, CURRENCY_INFO[cur].symbol, cur));

/**
 * Sends over ₦[step-up] need step-up verification before the PIN. It's judged on the USD value of what leaves the
 * source balance (the amount plus every fee, in any currency), not on what the recipient gets. The limit isn't
 * decided, so screens show the placeholder; STEP_UP_DEMO_USD_CENTS (₦20,000.00 at the demo rate of 1,550, about
 * $12.90) is only a demo value so the step can be reached from the demo balances.
 */
export const STEP_UP_PLACEHOLDER = "\u20a6[step-up]";
export const STEP_UP_DEMO_USD_CENTS = 2000000 / 1550;
export const needsStepUp = (usdCents: number) => usdCents > STEP_UP_DEMO_USD_CENTS;

/** How long a first NGN payment to a new account is held before it sends: not decided, so a placeholder (ngn.mdc). */
export const HOLD_PLACEHOLDER = "[hold]";
/** A first NGN payment to this account: it's held for [hold] before it sends. */
export const isFirstPayment = (cur: PayoutCurrency, r: PayoutRecipient | null) => cur === "NGN" && !!r && !r.paidBefore;

/**
 * NGN fees aren't decided (ngn.mdc): every NGN fee on screen is the placeholder ₦[fee], and the maths leaves it out
 * (it counts as 0), so no made-up number leaks through totals, Max or the balance.
 */
export const FEE_PLACEHOLDER = "\u20a6[fee]";
export const feeDecided = (cur: PayoutCurrency) => cur !== "NGN";

/** A fee as shown: the amount, or ₦[fee] while undecided. */
export const fmtFee = (fee: number, cur: PayoutCurrency) => (feeDecided(cur) ? fmtCurrency(fee, cur) : FEE_PLACEHOLDER);

export function payoutMethodIcon(r: Pick<PayoutRecipient, "methodType"> & { asset?: string }): string {
  if (r.methodType === "poket") return WICON.user;
  if (r.methodType === "wallet") return r.asset === "USDT" ? WICON.usdt : WICON.usdc;
  if (r.methodType === "card") return WICON.card;
  if (r.methodType === "zelle") return WICON.zelleLogo;
  if (r.methodType === "cashapp") return WICON.cashappLogo;
  return WICON.bank;
}
export const isLogoMethod = (r: Pick<PayoutRecipient, "methodType">) => r.methodType === "zelle" || r.methodType === "cashapp" || r.methodType === "wallet";
/** payoutMethodBadgeHtml(r): logos fill the badge; other icons sit in a grey span. */
export const payoutMethodBadgeHtml = (r: Pick<PayoutRecipient, "methodType">) =>
  isLogoMethod(r) ? payoutMethodIcon(r) : `<span style="display:inline-flex;color:var(--txt2)">${payoutMethodIcon(r)}</span>`;

/** payoutMethodSub(r): "GTBank · •••• 6789", "Visa · •••• 4242", "Zelle · name@email.com", "$cashtag". */
export function payoutMethodSub(r: PayoutRecipient): string {
  if (r.methodType === "poket") return r.handle ?? "";
  if (r.methodType === "wallet") { const a = r.walletAddress ?? ""; return a.length > 16 ? `${a.slice(0, 8)}\u2026${a.slice(-6)}` : a; }
  if (r.methodType === "card") {
    // A debit card recipient: "Visa · •••• 4242" (its brand is kept as bankName, its last 4 as accountNumber)
    const last4 = r.cardNumber ? r.cardNumber.replace(/\D/g, "").slice(-4) : (r.accountNumber || "").slice(-4);
    return r.bankName ? `${r.bankName} · •••• ${last4}` : `•••• ${last4}`;
  }
  if (r.methodType === "zelle") return `Zelle · ${r.zelleContact || ""}`;
  if (r.methodType === "cashapp") return r.cashtag || "";
  const acct = r.accountNumber || "";
  return `${r.bankName} · ${acct.length > 4 ? `•••• ${acct.slice(-4)}` : acct}`;
}
