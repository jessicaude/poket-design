import { create } from "zustand";
import type { BrandKey } from "@/lib/card";
import { saveAccount } from "@/lib/mock-api";

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
/**
 * A Checkout payment, kept on the account: Checkout's Poket account and the wallet's Activity both list it (WGT-12).
 * `amount` is in minor units of `currency` (cents or kobo). "disputed": a dispute is open (lib/disputes.ts).
 */
export type Payment = { id: string; merchant: string; amount: number; currency: "USD" | "NGN"; method: string; at: string; status: "paid" | "disputed";
  /** Converted: what the method was actually debited, e.g. $23.40 USD for a ₦36,270.00 NGN order. */
  charged?: { amount: number; currency: "USD" };
  /** The merchant's order reference, and how it was paid (for the receipt's Paid with). */
  order?: string; methodKind?: "card" | "bank"; brand?: BrandKey;
  /** The open dispute: its reason (one of DISPUTE_REASONS) and when it was raised. */
  dispute?: { reason: string; at: string };
  /** The merchant's refunds, oldest first (lib/refunds.ts): all of it ("Refunded") or part ("Partly refunded"). */
  refunds?: Refund[] };
/**
 * A merchant's refund of (part of) a payment, in the payment's currency. `to`: back to the card or bank that paid
 * ("method"), or, for a naira bank transfer, into the NGN balance ("ngn"; to confirm: not in the PRD).
 */
export type Refund = { id: string; amount: number; at: string; to: "method" | "ngn" };
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
  /** Disputes raised (at most 2 counted): at 2 the account can't raise more (the reference's disputeStrikes). */
  disputeStrikes?: number;
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

/** The server keeps the signed-in account's changes (tier, failed checks, block, methods, payments, disputes). */
useAccount.subscribe((st) => { if (st.account) saveAccount(st.account); });
