import { useDemo } from "@/store/demo";

/**
 * Identity verification's rules, shared by Checkout and the wallet (reference/poket-widgets.html: tKycDetails,
 * ageFromDob, ssnValid, computeDocDob). The date of birth is given here, not at sign-up.
 */

/** The reference's MIN_AGE. */
export const MIN_AGE = 18;
/** The details screen's countries. */
export const ID_COUNTRIES = ["United States", "Nigeria", "United Kingdom", "Ghana", "Canada"];
/** The reference's KYC_MONTHS: the picker lists them in full and shows the chosen one short ("Mar"). */
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Age from a date of birth (the reference's ageFromDob); null until the date is complete. */
export function ageFrom(d: string, m: string, y: string, now = new Date()): number | null {
  const Y = +y, M = +m, D = +d;
  if (!Y || !M || !D || y.length < 4) return null;
  let a = now.getFullYear() - Y;
  if (now.getMonth() + 1 < M || (now.getMonth() + 1 === M && now.getDate() < D)) a--;
  return a;
}

/** The reference's ssnValid: 9 digits, not starting 000, 666 or 9, and no 00 group or 0000 serial. */
export const ssnOk = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 9 && !/^(000|666|9)/.test(d) && d.slice(3, 5) !== "00" && d.slice(5) !== "0000";
};
/** "123456789" → "123-45-6789", as it's typed. */
export function fmtSsn(v: string) {
  const x = v.replace(/\D/g, "").slice(0, 9);
  return x.length > 5 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x.length > 3 ? `${x.slice(0, 3)}-${x.slice(3)}` : x;
}

/** What the details screen hands on. */
export type IdentityDetails = { first: string; last: string; country: string; d: string; m: string; y: string; ssn: string; noSsn: boolean };
/** US residents with an SSN go to Plaid's selfie check; everyone else to Veriff's ID and selfie. */
export const usesSsn = (det: Pick<IdentityDetails, "country" | "noSsn">) => det.country === "United States" && !det.noSsn;

/** Under 18 by the date of birth given (or the demo's "Under 18 at date of birth"): the age-blocked screen. */
export function underAgeByDob(det: Pick<IdentityDetails, "d" | "m" | "y">) {
  const age = ageFrom(det.d, det.m, det.y);
  return age === null || age < MIN_AGE || useDemo.getState().idOutcome === "under18";
}

/**
 * The document check (computeDocDob): once the ID is checked, its date of birth is what counts, not the one typed in.
 * A demo trigger stands in for reading it: a legal last name containing "minor", or the demo's "ID shows under 18".
 */
export const idShowsUnder18 = (last: string) => /minor/i.test(last) || useDemo.getState().idOutcome === "docUnder18";
