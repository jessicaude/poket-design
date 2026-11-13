/** All amounts are integer cents. */
export type Cents = number;

/** $1,234.56 (same as the prototype's money()) */
export const money = (c: Cents) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Naira amounts are integer kobo (1 naira = 100 kobo), never floats. */
export type Kobo = number;

/**
 * "₦25,000.00 NGN": the reference's fmtCurrency(kobo, 'NGN'). Integer maths only, so no float rounding.
 * Screens show the code grey by wrapping it in <span className="cur-code">, as the reference does after rendering.
 */
export function formatNaira(kobo: Kobo): string {
  return formatMinor(kobo, "₦", "NGN");
}

/** The reference's fmtCurrency(cents, cur) for any currency: symbol, grouped units, two decimals, then the code. Integer maths only. */
export function formatMinor(minor: number, symbol: string, code: string): string {
  if (!Number.isInteger(minor)) throw new Error(`formatMinor expects integer minor units, got ${minor}`);
  const abs = Math.abs(minor);
  const units = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sub = String(abs % 100).padStart(2, "0");
  return `${minor < 0 ? "-" : ""}${symbol}${units}.${sub} ${code}`;
}

/**
 * The one demo rate between naira and dollars: ₦1,550 per $1, used everywhere (checkout orders and quotes, wallet
 * Convert, payouts). The checkout prototype's own RATES table says 1/1540; we don't use it.
 */
export const DEMO_NGN_PER_USD = 1550;

/** Naira in running text (titles, buttons, notes, the merchant's page): "₦36,270.00", no code. Amount rows and cards keep the grey code. */
/** docs/copy.md: running text drops the code ("₦5,000.00 NGN" → "₦5,000.00"); stablecoins keep theirs ("10.00 USDC"). */
export const withoutCode = (amount: string) => amount.replace(/ (NGN|USD|EUR|GBP|GHS)$/, "");
export const formatNairaShort = (kobo: Kobo) => formatNaira(kobo).replace(/ NGN$/, "");

/** An order amount in running text, in its own currency, without the code: "$23.40" or "₦36,270.00". */
export const formatOrder = (minor: number, currency: "USD" | "NGN") => (currency === "NGN" ? formatNairaShort(minor) : money(minor));

/**
 * The order amount's USD value in cents, for USD rules such as the $500 ID check. Rounded down, so a naira total worth
 * $499.9996 counts as under $500.
 */
export const orderUsdCents = (minor: number, currency: "USD" | "NGN") => (currency === "NGN" ? Math.floor(minor / DEMO_NGN_PER_USD) : minor);
