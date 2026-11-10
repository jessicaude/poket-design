import type { WalletNetwork } from "@/lib/mock-api";

/**
 * New-recipient helpers, ported from reference/poket-wallet-explore.html: ROUTING / MORE_BANKS / abaValid / routingBank
 * (US bank fields), speedsFor (US speeds), the stablecoin address check and hl() (start and end highlighted).
 */

const ROUTING: Record<string, [string, string, boolean]> = {
  "021000021": ["Chase", "JPMorgan Chase Bank, N.A.", true], "026009593": ["Bank of America", "Bank of America, N.A.", true],
  "121000248": ["Wells Fargo", "Wells Fargo Bank, N.A.", true], "021000089": ["Citi", "Citibank, N.A.", false],
  "051405515": ["Capital One", "Capital One, N.A.", true], "091000022": ["U.S. Bank", "U.S. Bank, N.A.", true],
};
const MORE_BANKS: [string, string, boolean][] = [["PNC", "PNC Bank, N.A.", true], ["Truist", "Truist Bank", true], ["TD Bank", "TD Bank, N.A.", true], ["Regions", "Regions Bank", false], ["Ally", "Ally Bank", false]];

/** abaValid: 9 digits with a valid ABA checksum. */
export function abaValid(r: string): boolean {
  if (!/^\d{9}$/.test(r)) return false;
  const d = [...r].map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}
/** routingBank: the bank for a valid routing number (made up for unknown ones, as in the prototype). */
export function routingBank(r: string): { short: string; full: string; instant: boolean } | null {
  if (!abaValid(r)) return null;
  const b = ROUTING[r] || MORE_BANKS[[...r].reduce((s, c) => s + Number(c), 0) % MORE_BANKS.length];
  return { short: b[0], full: b[1], instant: b[2] };
}

export type UsSpeed = { id: "rtp" | "ach" | "wire"; label: string; eta: string; fee: number };
/** speedsFor(bank): Instant (if the bank supports RTP), Standard, Wire. Fees in US cents. */
export function usSpeeds(instant: boolean): UsSpeed[] {
  const out: UsSpeed[] = [];
  if (instant) out.push({ id: "rtp", label: "Instant", eta: "Within minutes, any day", fee: 150 });
  out.push({ id: "ach", label: "Standard", eta: "1 to 3 business days", fee: 0 });
  out.push({ id: "wire", label: "Wire", eta: "Same day if sent before 5 PM ET", fee: 1500 });
  return out;
}

/** The wire address is complete: street, city, a 2-letter state, a 5-digit ZIP. */
export const wireAddressOk = (a: { street?: string; city?: string; state?: string; zip?: string }) =>
  !!((a.street || "").trim() && (a.city || "").trim() && /^[A-Z]{2}$/i.test(a.state || "") && /^\d{5}$/.test(a.zip || ""));

/** A stablecoin address for the network: base58 for Solana, 0x + 40 hex otherwise. */
export const validAddress = (net: WalletNetwork, a: string) => (net === "Solana" ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) : /^0x[0-9a-fA-F]{40}$/.test(a));
/** hl(addr): the first 6 and last 4 characters highlighted, the middle plain. */
export const addressParts = (a: string): [string, string, string] => (a.length < 14 ? ["", a, ""] : [a.slice(0, 6), a.slice(6, -4), a.slice(-4)]);

/** A Poket user's identifier: an @handle, an email, or a phone number (the reference Transfer's rules). */
export function handleKind(q: string): "tag" | "email" | "phone" | null {
  const v = q.trim();
  if (v.startsWith("@")) return v.length > 2 ? "tag" : null;
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "email" : null;
  return v.replace(/\D/g, "").length >= 7 ? "phone" : null;
}
/** Initials for a name: "Tobi Bello" → "TB". */
export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
