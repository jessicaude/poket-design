import { create } from "zustand";
import { toNigerianBank, useNairaPartner } from "@/store/partner";
import { listWithdrawals, reportSendProblem, requestRecall as requestRecallApi, setRecallStatus, setWithdrawalStatus, type RecallStatus, type Withdrawal, type WithdrawalStatus } from "@/lib/mock-api";
import { formatNaira } from "@/lib/money";
import { useNgn } from "../ngn/useNgn";
import { creditNgn } from "../history/credits";
import { attribute } from "../history/ledger";
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
  /** "Report a problem" on a Paid send; the wrong-account reason requests a recall instead (Nigerian banks). */
  reportProblem: (id: string, reason: string, details: string) => Promise<void>;
  requestRecall: (id: string, reason: string, details: string) => Promise<void>;
  /** Demo: the recall moves on. Recovered puts the naira back in the NGN balance, with a notification; Not recovered notifies "Recall closed". */
  setRecall: (id: string, to: RecallStatus) => Promise<void>;
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
  // Ada's seeded history is there from the start
  list: listWithdrawals(),
  refresh: () => set({ list: listWithdrawals() }),

  move: async (id, to) => {
    const before = get().list.find((w) => w.id === id) ?? listWithdrawals().find((w) => w.id === id);
    if (!before) return;
    const after = await setWithdrawalStatus(id, to);
    const total = before.sourceTotal ?? before.amount + before.fee;
    const d = reservationEffect(before.status, to, total);
    // The NGN balance's ledger: money given back by a failed or reversed send (NEW lines)
    const back = { description: `${to === "reversed" ? "Reversed" : "Returned"} · To ${before.recipientName}`, reference: before.ref, withdrawalId: before.id };
    attribute(back, () => {
      if (before.reservedIn === "source" && before.sourceKey) {
        // Taken from the paying balance at the PIN: given back when the send fails or is reversed; nothing on hold.
        if (d.balance) returnToSource(before.sourceKey, d.balance);
      } else if (before.reservedIn === "ngn" || after.currency === "NGN") {
        useNgn.setState((s) => ({ ngnBalance: s.ngnBalance + d.balance, ngnReserved: s.ngnReserved + d.reserved }));
      }
    });
    get().refresh();
    if (to === "reversed") {
      const desc = `${sentText(after)} to ${after.recipientName}. Funds returned to your balance.`; // what left (and returns to) your balance
      useNotifications.getState().add({ type: "payout", title: "Transfer reversed", desc });
      useWalletToast.getState().showNotice("Transfer reversed", desc, 3200);
    }
  },

  reportProblem: async (id, reason, details) => { await reportSendProblem(id, reason, details); get().refresh(); },
  requestRecall: async (id, reason, details) => { await requestRecallApi(id, reason, details); get().refresh(); },
  setRecall: async (id, to) => {
    const w = await setRecallStatus(id, to);
    if (to === "recovered") {
      // WGT-11: the recovered naira is its own record (from the account it came back from)
      creditNgn({ kind: "recall", amount: w.amount, from: w.recipientSub, withdrawalId: w.id, description: `Recall · ${w.recipientName}` });
      useNotifications.getState().add({ type: "payout", title: "Transfer recovered", desc: `${formatNaira(w.amount)} is back in your NGN balance.` });
    } else if (to === "not_recovered") {
      useNotifications.getState().add({ type: "payout", title: "Recall closed", desc: `We couldn’t recover your transfer to ${w.recipientName}.` });
    }
    get().refresh();
  },

  releaseHold: async (id) => {
    await get().move(id, "sending");
    await new Promise((r) => setTimeout(r, RELEASE_SEND_MS));
    // WGT-13: a send to a Nigerian bank stays Sending while the naira partner is down (partnerRecovery pays it)
    const w = get().list.find((x) => x.id === id);
    if (w && toNigerianBank(w) && useNairaPartner.getState().down) return;
    if (w?.status === "sending") await get().move(id, "paid");
  },
}));
