import { useAccount } from "@/store/account";
import { useNgn } from "./ngn/useNgn";
import { useNotifications } from "./useNotifications";
import { formatNairaShort, withoutCode } from "@/lib/money";
import { refundDest, refundTitle } from "@/lib/refunds";
import { attribute } from "./history/ledger";
import { fmtCurrency } from "./payout/payoutMath";

/**
 * WGT-12: a merchant's refund of a naira bank-transfer payment goes into the NGN balance (to confirm: not in the PRD).
 * The refund is recorded on the account wherever the demo action ran (Checkout or the wallet); the wallet adds each
 * one to the balance once, with a notification. It also tells the user when a dispute is resolved (refund, release,
 * reversal), once each. Imported once by WalletBody.
 */
const credited = new Set<string>();
/** Payments whose dispute resolution has been notified (resolved before the wallet loaded counts too). */
const resolved = new Set<string>();
function creditNew() {
  for (const p of useAccount.getState().account?.payments ?? []) {
    for (const r of p.refunds ?? []) {
      if (r.to !== "ngn" || r.inBalance || credited.has(r.id)) continue;
      credited.add(r.id);
      attribute({ description: refundTitle(p, r), reference: r.id }, () => useNgn.setState((s) => ({ ngnBalance: s.ngnBalance + r.amount })));
      // A dispute's refund: the resolution's notification says so
      if (!r.fromDispute) useNotifications.getState().add({ type: "payout", title: "Refund received", desc: `${formatNairaShort(r.amount)} from ${p.merchant} added to your NGN balance.` });
    }
    // WGT-12: a resolved dispute, once (the reference's notify() wording where it has one; reversal is NEW)
    const o = p.dispute?.outcome;
    if (o && !resolved.has(p.id)) {
      resolved.add(p.id);
      const back = (p.refunds ?? []).filter((r) => r.fromDispute).at(-1);
      const amt = back ? withoutCode(fmtCurrency(back.amount, p.currency)) : "";
      const n = o === "refund"
        ? { title: "Dispute resolved", desc: back?.to === "ngn" ? `${amt} from ${p.merchant} added to your NGN balance.` : `${amt} from ${p.merchant} is on its way back to ${p.method}.` }
        : o === "reversal"
          ? { title: "Payment reversed", desc: `${amt} from ${p.merchant} is on its way back to ${back ? refundDest(p, back) : p.method}.` }
          : { title: "Dispute closed", desc: `${p.merchant} keeps your ${withoutCode(fmtCurrency(p.amount, p.currency))} payment.` };
      useNotifications.getState().add({ type: "payout", ...n });
    }
  }
}
if (typeof window !== "undefined") {
  creditNew();
  useAccount.subscribe(creditNew);
}
