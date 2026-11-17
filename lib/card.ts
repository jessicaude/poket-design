/** Card rules, ported from reference/poket-widgets.html (detectBrand, cardLen, add-card). */
import { BRANDS } from "@/lib/icons";

export type BrandKey = keyof typeof BRANDS; // "visa" | "mc" | "amex" | "discover" | "verve"

export function detectBrand(input: string): BrandKey | null {
  const n = String(input || "").replace(/\D/g, "");
  if (/^(506(0|1)|507[89]|6500)/.test(n)) return "verve";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return "mc";
  if (/^(6011|65|64[4-9])/.test(n)) return "discover";
  if (/^4/.test(n)) return "visa";
  return null;
}

export const cardLen = (b: BrandKey | null) => (b ? BRANDS[b].len : 16);
export const cvcLen = (b: BrandKey | null) => (b === "amex" ? 4 : 3);

/** 4242 4242 4242 4242, or 3782 822463 10005 for Amex */
export function formatCardNumber(v: string): string {
  const d = v.replace(/\D/g, ""), b = detectBrand(d), x = d.slice(0, cardLen(b));
  return b === "amex" ? [x.slice(0, 4), x.slice(4, 10), x.slice(10)].filter(Boolean).join(" ") : x.replace(/(.{4})/g, "$1 ").trim();
}

/** The Luhn checksum every card number carries (a mistyped digit fails it). */
export function luhnOk(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Expiry is typed as MM / YY ("1229" → "12 / 29"). */
export function formatExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}
/** A whole expiry, typed: "MM / YY". */
export const expiryComplete = (v: string) => /^\d{2} \/ \d{2}$/.test(v);

/** A real month, in the future: valid until the last moment of the expiry month. */
export function expiryOk(v: string, now = new Date()): boolean {
  const m = /^(0[1-9]|1[0-2]) \/ (\d{2})$/.exec(v);
  if (!m) return false;
  return new Date(2000 + +m[2], +m[1], 0, 23, 59) >= now;
}

/** Amex and some test numbers are credit cards; the rest are debit (prototype rule). */
export const fundingOf = (digits: string): "credit" | "debit" =>
  detectBrand(digits) === "amex" || /^(5555|4111)/.test(digits) ? "credit" : "debit";
