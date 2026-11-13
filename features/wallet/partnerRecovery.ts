import { formatNairaShort } from "@/lib/money";
import { DEMO_ACCOUNT_SENDER } from "@/lib/mock-api";
import { creditNgn } from "./history/credits";
import { toNigerianBank, useNairaPartner } from "@/store/partner";
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
    // WGT-11: each is its own record, marked delayed
    creditNgn({ kind: "delayed", amount, from: DEMO_ACCOUNT_SENDER });
    useNotifications.getState().add({ type: "info", title: "Transfer received", desc: `${formatNairaShort(amount)} from ${DEMO_ACCOUNT_SENDER.split(" · ")[0]} added to your NGN balance, after a delay.` });
  }
  const { list, move } = useWithdrawals.getState();
  for (const w of list.filter((x) => toNigerianBank(x) && x.status === "sending")) await move(w.id, "paid");
}

if (typeof window !== "undefined") {
  useNairaPartner.subscribe((s, prev) => { if (prev.down && !s.down) void recoverFromDowntime(); });
}
