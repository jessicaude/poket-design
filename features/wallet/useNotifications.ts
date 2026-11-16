import { create } from "zustand";
import type { WalletScreen } from "./useWalletNav";

/** POKET.identity.notifications in the reference: shown by the header bell (#openNotifHeader) and tNotifications. */
/** `target`: the transaction it is about (tapping the notification opens its detail). */
export type WalletNotification = { id: string; type: "payout" | "info"; title: string; desc: string; ts: number; read: boolean; target?: WalletScreen };

type State = {
  list: WalletNotification[];
  add: (n: Omit<WalletNotification, "id" | "ts" | "read">) => void;
  markAllRead: () => void;
  reset: () => void;
};

export const useNotifications = create<State>((set) => ({
  list: [],
  add: (n) => set((s) => ({ list: [{ ...n, id: "n" + Date.now() + Math.random().toString(36).slice(2, 6), ts: Date.now(), read: false }, ...s.list] })),
  markAllRead: () => set((s) => ({ list: s.list.map((n) => ({ ...n, read: true })) })),
  reset: () => set({ list: [] }),
}));
