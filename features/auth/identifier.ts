/**
 * Sign-up's identifier: an email or a phone number (reference/poket-widgets.html, "Identifier: email or phone"). The
 * phone has its own country code, separate from the country of residence. Shared by Checkout and the wallet.
 */

/** The reference's DIALS: [country, code, ISO]. */
export const DIALS: [string, string, string][] = [["Argentina","+54","AR"],["Australia","+61","AU"],["Belgium","+32","BE"],["Brazil","+55","BR"],["Cameroon","+237","CM"],["Canada","+1","CA"],["China","+86","CN"],["Colombia","+57","CO"],
  ["Côte d’Ivoire","+225","CI"],["Egypt","+20","EG"],["Ethiopia","+251","ET"],["France","+33","FR"],["Germany","+49","DE"],["Ghana","+233","GH"],["India","+91","IN"],["Indonesia","+62","ID"],
  ["Ireland","+353","IE"],["Italy","+39","IT"],["Japan","+81","JP"],["Kenya","+254","KE"],["Mexico","+52","MX"],["Morocco","+212","MA"],["Netherlands","+31","NL"],["Nigeria","+234","NG"],
  ["Pakistan","+92","PK"],["Philippines","+63","PH"],["Portugal","+351","PT"],["Rwanda","+250","RW"],["Saudi Arabia","+966","SA"],["Senegal","+221","SN"],["Singapore","+65","SG"],["South Africa","+27","ZA"],
  ["Spain","+34","ES"],["Sweden","+46","SE"],["Switzerland","+41","CH"],["Tanzania","+255","TZ"],["Uganda","+256","UG"],["United Arab Emirates","+971","AE"],["United Kingdom","+44","GB"],["United States","+1","US"]];

/** The country code a phone starts with (the reference's S.dial default). */
export const DEFAULT_DIAL = "Nigeria";

const dialOf = (name: string) => DIALS.find((d) => d[0] === name) ?? DIALS.find((d) => d[0] === "United States")!;
export const flag = (iso: string) => String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0)));
export const dialIso = (name: string) => dialOf(name)[2];
export const dialCode = (name: string) => dialOf(name)[1];
/** Digits only, without a leading 0 ("0803 123 4567" → "8031234567"). */
export const localDigits = (v?: string | null) => String(v || "").replace(/\D/g, "").replace(/^0/, "");
/** "8031234567" → "803 123 4567". */
export function fmtPhone(d: string) {
  d = d.replace(/\D/g, "").slice(0, 11);
  return d.length > 6 ? d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6) : d.length > 3 ? d.slice(0, 3) + " " + d.slice(3) : d;
}
/** "kemi@example.com" → "k••••i@example.com". */
export function maskEmail(e: string) {
  const [u, d] = String(e).split("@");
  const s = u || "";
  return (s.length <= 2 ? s[0] + "••••" : s[0] + "••••" + s[s.length - 1]) + "@" + (d || "");
}
/** "+234 ••• ••• 4567". */
export const maskPhone = (dial: string, num: string) => `${dialCode(dial)} ••• ••• ${num.replace(/\D/g, "").slice(-4)}`;
/** "+234 803 123 4567". */
export const fullPhone = (p: { dial: string; num: string }) => `${dialCode(p.dial)} ${fmtPhone(p.num)}`;

export type Identifier = { method: "email" | "phone"; email: string; dial: string; phone: string };
export const isPhone = (id: Identifier) => id.method === "phone";
/** The reference's idValid: an email, or a phone of 7 digits or more. */
export const idValid = (id: Identifier) => (isPhone(id) ? id.phone.replace(/\D/g, "").length >= 7 : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id.email.trim()));
export const maskId = (id: Identifier) => (isPhone(id) ? maskPhone(id.dial, id.phone) : maskEmail(id.email.trim()));

/** How an account is shown masked: its email, or its phone when it has no email (the reference's maskId()). */
export const maskAccount = (a: { email: string; phone?: { dial: string; num: string } }) =>
  a.email.trim() ? maskEmail(a.email.trim()) : a.phone ? maskPhone(a.phone.dial, a.phone.num) : "";
/** How an account is shown in full: its email, or its phone when it has no email. */
export const accountContact = (a: { email: string; phone?: { dial: string; num: string } }) =>
  a.email.trim() ? a.email.trim() : a.phone ? fullPhone(a.phone) : "";
