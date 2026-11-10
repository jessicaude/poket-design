import { create } from "zustand";
import { listWithdrawals, setWithdrawalStatus, type Withdrawal, type WithdrawalStatus } from "@/lib/mock-api";
import { useNgn } from "../ngn/useNgn";
import { useNotifications } from "../useNotifications";
import { useWalletToast } from "../useWalletToast";
import { fmtCurrency } from "./payoutMath";
import { reservationEffect } from "./withdrawals";

type State = {
  list: Withdrawal[];
  refresh: () => void;
  /** Move a withdrawal to a new status and apply its effect on the NGN balance and reserved total. */
  move: (id: string, to: WithdrawalStatus) => Promise<void>;
  /** Demo "Release first-payment hold": Scheduled → Sending → Paid. */
  releaseHold: (id: string) => Promise<void>;
};

/** How long "Sending" lasts after a first-payment hold is released, in the demo. */
export const RELEASE_SEND_MS = 1500;

export const useWithdrawals = create<State>((set, get) => ({
  list: [],
  refresh: () => set({ list: listWithdrawals() }),

  move: async (id, to) => {
    const before = get().list.find((w) => w.id === id) ?? listWithdrawals().find((w) => w.id === id);
    if (!before) return;
    const after = await setWithdrawalStatus(id, to);
    if (after.currency === "NGN") {
      const d = reservationEffect(before.status, to, before.amount + before.fee);
      useNgn.setState((s) => ({ ngnBalance: s.ngnBalance + d.balance, ngnReserved: s.ngnReserved + d.reserved }));
    }
    get().refresh();
    if (to === "reversed") {
      const desc = `${fmtCurrency(after.amount, after.currency)} to ${after.recipientName}. Funds returned to your balance.`;
      useNotifications.getState().add({ type: "payout", title: "Transfer reversed", desc });
      useWalletToast.getState().showNotice("Transfer reversed", desc, 3200);
    }
  },

  releaseHold: async (id) => {
    await get().move(id, "sending");
    await new Promise((r) => setTimeout(r, RELEASE_SEND_MS));
    if (get().list.find((w) => w.id === id)?.status === "sending") await get().move(id, "paid");
  },
}));
