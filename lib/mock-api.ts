/**
 * Mock Poket API: stands in for the backend while designing.
 * Function names follow the planned endpoints so engineering can swap in real calls.
 */
import type { Account, PaymentMethod } from "@/store/account";
import type { CardOutcome } from "@/store/demo";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** People who already have a Poket account (from the prototype's DIRECTORY). */
export const DIRECTORY: Record<string, Account> = {
  "ada@osun.co": {
    email: "ada@osun.co", first: "Ada", last: "Osun", tier: 1, payments: [],
    methods: [
      { id: "pm_visa", kind: "card", brand: "visa", last4: "4242", name: "Visa ••• 4242", sub: "Debit · Expires 12/2028" },
      { id: "pm_bank", kind: "bank", last4: "6789", name: "Chase checking ••• 6789", sub: "Bank account · Pay by bank" },
    ],
  },
};

export const findAccount = (email: string) => DIRECTORY[email.trim().toLowerCase()] ?? null;

/** POST /v1/auth/verify. In the demo any 6 digits work; 000000 is a wrong code. */
export async function verifyCode(code: string): Promise<void> {
  await wait(700);
  if (code === "000000") throw new Error("That code isn’t right. Check it and try again.");
}

/** POST /v1/payments */
export async function createPayment(method: PaymentMethod, outcome: CardOutcome): Promise<{ id: string }> {
  await wait(1200);
  if (outcome === "declined" && method.kind === "card") throw new Error("card_declined");
  return { id: "pay_" + Math.random().toString(36).slice(2, 10) };
}
