import type { CashCurrency } from "../useHoldings";

/**
 * Account details for cash other than NGN (NGN has its own flow): the reference's VA_SPEC. `fields(n)` are the
 * details from the account's number; `sample` is the demo's incoming transfer (the reference's vaIncoming, own).
 */
export type VaCurrency = Exclude<CashCurrency, "NGN">;
export const VA_SPEC: Record<VaCurrency, { rails: string; arrives: string; instant: boolean; bank: string; fields: (n: string) => [string, string][]; sample: number }> = {
  USD: { rails: "ACH or wire", arrives: "ACH 1-3 business days · wire same day", instant: false, bank: "Lead Bank",
    fields: (n) => [["Account number", "8" + n.slice(0, 9)], ["Routing number (ACH)", "101019644"], ["Routing number (wire)", "101019644"], ["Bank", "Lead Bank"], ["Account type", "Checking"]],
    sample: 50000 },
  EUR: { rails: "SEPA or SEPA Instant", arrives: "Seconds to 1 business day", instant: true, bank: "Banking Circle",
    fields: (n) => [["IBAN", "LU28 0019 " + n.slice(0, 4) + " " + n.slice(4, 8) + " " + n.slice(8, 12)], ["BIC", "BCIRLULL"], ["Bank", "Banking Circle S.A."]],
    sample: 30000 },
  GBP: { rails: "Faster Payments or Bacs", arrives: "Usually within seconds", instant: true, bank: "ClearBank",
    fields: (n) => [["Account number", n.slice(0, 8)], ["Sort code", "04-06-05"], ["Bank", "ClearBank"]],
    sample: 20000 },
  GHS: { rails: "GhIPSS bank transfer", arrives: "Usually within minutes", instant: true, bank: "Zenith Bank Ghana",
    fields: (n) => [["Account number", "60" + n.slice(0, 11)], ["Bank", "Zenith Bank Ghana"], ["Branch", "Accra Main"]],
    sample: 150000 },
};
export const isVaCurrency = (c: CashCurrency): c is VaCurrency => c !== "NGN";
/** The first rail: "ACH", "SEPA", "Faster Payments", "GhIPSS bank transfer". */
export const firstRail = (c: VaCurrency) => VA_SPEC[c].rails.split(" or ")[0];
