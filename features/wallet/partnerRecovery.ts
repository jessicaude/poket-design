import { formatNaira } from "@/lib/money";
import { toNigerianBank, useNairaPartner } from "@/store/partner";
import { useNgn } from "./ngn/useNgn";
import { useWithdrawals } from "./payout/useWithdrawals";
import { useNotifications } from "./useNotifications";

/**
 * WGT-13: when the naira partner comes back (down → up), what waited moves on. The banner and paused screens clear by
 * themselves (they read useNairaPartner). Here: each transfer into naira that arrived while down (demo "Transfer
 * arrived while down") is credited to the NGN balance with its own notification, and every send to a Nigerian bank
 * that's Sending moves on to Paid. Imported once by WalletBody, so it runs wherever the wallet has loaded.
 */
export async function recoverFromDowntime() {
  for (const amount of useNairaPartner.getState().takeQueued()) {
    useNgn.setState((s) => ({ ngnBalance: s.ngnBalance + amount }));
    useNotifications.getState().add({ type: "info", title: "Transfer received", desc: `${formatNaira(amount).replace(/ NGN$/, "")} added to your NGN balance. This transfer was delayed.` });
  }
  const { list, move } = useWithdrawals.getState();
  for (const w of list.filter((x) => toNigerianBank(x) && x.status === "sending")) await move(w.id, "paid");
}

if (typeof window !== "undefined") {
  useNairaPartner.subscribe((s, prev) => { if (prev.down && !s.down) void recoverFromDowntime(); });
}
