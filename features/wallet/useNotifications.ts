import { create } from "zustand";

/** POKET.identity.notifications in the reference: shown by the header bell (#openNotifHeader) and tNotifications. */
export type WalletNotification = { id: string; type: "payout" | "info"; title: string; desc: string; ts: number; read: boolean };

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
