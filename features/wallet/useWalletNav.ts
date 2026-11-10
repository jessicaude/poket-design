import { create } from "zustand";

/** Wallet screens outside the payout and NGN flows. An empty stack is the home screen. */
export type WalletScreen =
  | { name: "ngn-balance" }
  | { name: "on-hold" }
  | { name: "withdrawal"; id: string }
  | { name: "notifications" };

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
