import { create } from "zustand";

/** Demo controls (the prototype bar). Dev-only: they let you switch scenarios while designing. */
export type Customer = "new" | "returning";
export type CardOutcome = "approved" | "declined";
export type Theme = "poket" | "centry";
export type OrderCurrency = "USD" | "NGN";
/** How the merchant takes naira: by naira card, by naira bank transfer, and whether it accepts payment converted from another currency. */
export type MerchantAccepts = { ngnCard: boolean; ngnBank: boolean; conversion: boolean };
/** Bank transfer account: a dynamic account per payment, or the merchant's pooled account. */
export type BankTransferAccount = "dynamic" | "pool";

type DemoState = {
  customer: Customer;
  cardOutcome: CardOutcome;
  theme: Theme;
  shareDetails: boolean; // the merchant shares the customer's details, so sign-up is prefilled
  orderCurrency: OrderCurrency;
  merchantAccepts: MerchantAccepts;
  bankTransferAccount: BankTransferAccount;
  set: (patch: Partial<Omit<DemoState, "set">>) => void;
};

export const useDemo = create<DemoState>((set) => ({
  customer: "new",
  cardOutcome: "approved",
  theme: "poket",
  shareDetails: true,
  orderCurrency: "USD",
  merchantAccepts: { ngnCard: true, ngnBank: true, conversion: true },
  bankTransferAccount: "dynamic",
  set: (patch) => set(patch),
}));
