import { useAccount } from "@/store/account";
import { useNgn } from "./ngn/useNgn";
import { useNotifications } from "./useNotifications";
import { formatNaira } from "@/lib/money";

/**
 * WGT-12: a merchant's refund of a naira bank-transfer payment goes into the NGN balance (to confirm: not in the PRD).
 * The refund is recorded on the account wherever the demo action ran (Checkout or the wallet); the wallet adds each
 * one to the balance once, with a notification. Imported once by WalletBody.
 */
const credited = new Set<string>();
function creditNew() {
  for (const p of useAccount.getState().account?.payments ?? []) {
    for (const r of p.refunds ?? []) {
      if (r.to !== "ngn" || credited.has(r.id)) continue;
      credited.add(r.id);
      useNgn.setState((s) => ({ ngnBalance: s.ngnBalance + r.amount }));
      useNotifications.getState().add({ type: "payout", title: "Refund received", desc: `${formatNaira(r.amount)} from ${p.merchant} added to your NGN balance.` });
    }
  }
}
if (typeof window !== "undefined") {
  creditNew();
  useAccount.subscribe(creditNew);
}
