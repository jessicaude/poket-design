import { create } from "zustand";

/** Demo controls (the prototype bar). Dev-only: they let you switch scenarios while designing. */
export type Customer = "new" | "returning";
export type CardOutcome = "approved" | "declined";
export type Theme = "poket" | "centry";

type DemoState = {
  customer: Customer;
  cardOutcome: CardOutcome;
  theme: Theme;
  shareDetails: boolean; // the merchant shares the customer's details, so sign-up is prefilled
  set: (patch: Partial<Omit<DemoState, "set">>) => void;
};

export const useDemo = create<DemoState>((set) => ({
  customer: "new",
  cardOutcome: "approved",
  theme: "poket",
  shareDetails: true,
  set: (patch) => set(patch),
}));
