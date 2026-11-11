import { create } from "zustand";
import type { BrandKey } from "@/lib/card";

/** A saved way to pay. `name` and `sub` are display text, as in the prototype ("Visa ••• 4242", "Debit · Expires 12/2028"). */
export type PaymentMethod = {
  id: string;
  kind: "card" | "bank";
  brand?: BrandKey;
  last4: string;
  name: string;
  sub: string;
  oneTime?: boolean; // "Save this card for next time" was unticked
  currency?: "USD" | "NGN"; // what the method pays in: NGN for a Nigerian card; USD when not set
};
/** `amount` is in minor units of `currency` (cents or kobo). */
export type Payment = { id: string; merchant: string; amount: number; currency: "USD" | "NGN"; method: string; at: string; status: "paid";
  /** Converted: what the method was actually debited, e.g. $23.40 USD for a ₦36,270.00 NGN order. */
  charged?: { amount: number; currency: "USD" } };
export type Account = {
  email: string;
  first: string;
  last: string;
  tier: 0 | 1 | 2;  // Checkout payments under $500 need no ID check
  country?: string; // where the person lives; identity verification asks for it (US: SSN and a Plaid selfie, others: Veriff)
  /** Failed ID checks so far: Veriff's limit of 3 attempts is shared across checks and checkouts. */
  idFailures?: number;
  /** Identity verification ended in a block (under 18, declined or out of attempts, sanctions): never offered again. */
  idBlocked?: "age" | "id_declined" | "sanctions";
  methods: PaymentMethod[];
  payments: Payment[];
};

type AccountState = {
  account: Account | null;
  signIn: (a: Account) => void;
  signOut: () => void;
  update: (fn: (a: Account) => Account) => void;
};

export const useAccount = create<AccountState>((set) => ({
  account: null,
  signIn: (account) => set({ account }),
  signOut: () => set({ account: null }),
  update: (fn) => set((s) => (s.account ? { account: fn(s.account) } : s)),
}));
