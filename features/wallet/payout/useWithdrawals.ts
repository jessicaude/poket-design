import { create } from "zustand";
import { listWithdrawals, setWithdrawalStatus, type Withdrawal, type WithdrawalStatus } from "@/lib/mock-api";
import { useNgn } from "../ngn/useNgn";
import { cashAmount, setCashAmount, useHoldings, type CashCurrency, type CoinAsset, type Network } from "../useHoldings";
import { useNotifications } from "../useNotifications";
import { useWalletToast } from "../useWalletToast";
import { reservationEffect, sentText } from "./withdrawals";

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

/** Give money back to the balance a send was paid from (a cvKey). */
function returnToSource(key: string, amount: number) {
  const [k, a, b] = key.split(":");
  if (k === "coin") {
    const asset = a as CoinAsset, net = b as Network;
    useHoldings.setState((s) => ({ coins: { ...s.coins, [asset]: { ...s.coins[asset], [net]: (s.coins[asset]?.[net] || 0) + amount } } }));
    return;
  }
  setCashAmount(a as CashCurrency, cashAmount(a as CashCurrency) + amount);
  if (b === "fiat") useHoldings.setState((s) => ({ fiatOnly: { ...s.fiatOnly, [a]: (s.fiatOnly[a as CashCurrency] || 0) + amount } }));
}

export const useWithdrawals = create<State>((set, get) => ({
  list: [],
  refresh: () => set({ list: listWithdrawals() }),

  move: async (id, to) => {
    const before = get().list.find((w) => w.id === id) ?? listWithdrawals().find((w) => w.id === id);
    if (!before) return;
    const after = await setWithdrawalStatus(id, to);
    const total = before.sourceTotal ?? before.amount + before.fee;
    const d = reservationEffect(before.status, to, total);
    if (before.reservedIn === "source" && before.sourceKey) {
      // Taken from the paying balance at the PIN: given back when the send fails or is reversed; nothing on hold.
      if (d.balance) returnToSource(before.sourceKey, d.balance);
    } else if (before.reservedIn === "ngn" || after.currency === "NGN") {
      useNgn.setState((s) => ({ ngnBalance: s.ngnBalance + d.balance, ngnReserved: s.ngnReserved + d.reserved }));
    }
    get().refresh();
    if (to === "reversed") {
      const desc = `${sentText(after)} to ${after.recipientName}. Funds returned to your balance.`; // what left (and returns to) your balance
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
