import { create } from "zustand";
import type { Holding } from "./home/WalletHome";
import type { DisputeTarget } from "./disputes/DisputeScreens";

/** Wallet screens outside the payout and NGN flows. An empty stack is the home screen. */
export type WalletScreen =
  | { name: "ngn-balance" }
  | { name: "on-hold" }
  | { name: "withdrawal"; id: string }
  | { name: "conversion"; id: string }
  | { name: "notifications" }
  | { name: "assets-all" }
  | { name: "holding"; holding: Holding }
  | { name: "tx"; id: string }
  /** WGT-12: a Checkout payment's detail, and a dispute on a payment */
  | { name: "payment"; id: string }
  | { name: "refund"; id: string }
  | { name: "dispute"; target: DisputeTarget }
  | { name: "settings" }
  | { name: "security" }
  | { name: "compliance" }
  | { name: "compliance-stepup" }
  | { name: "instant-transfers" }
  | { name: "instant-limit" };

type State = {
  stack: WalletScreen[];
  push: (s: WalletScreen) => void;
  back: () => void;
  home: () => void;
};

export const useWalletNav = create<State>((set) => ({
  stack: [],
  push: (s) => set((st) => ({ stack: [...st.stack, s] })),
  back: () => set((st) => ({ stack: st.stack.slice(0, -1) })),
  home: () => set({ stack: [] }),
}));

export const currentScreen = (stack: WalletScreen[]) => stack[stack.length - 1] ?? null;
