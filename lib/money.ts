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
