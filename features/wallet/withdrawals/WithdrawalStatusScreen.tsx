"use client";
import { SendProblem } from "./ReportProblemScreen";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { withdrawalFields } from "../history/fields";
import { TxDetailView, TxNotFound } from "../history/TxView";
import { withdrawalReceipt } from "../receipt/receipt";
import { useWithdrawals } from "../payout/useWithdrawals";
import { QUICK_CHECK, STATUS_META, sentText } from "../payout/withdrawals";
import { NairaPausedBanner } from "../NairaPausedBanner";
import { toNigerianBank } from "@/store/partner";


/**
 * A send's detail: the shared transaction template (the status only in the Status row). What its status means (when
 * it arrives, why it's held) is a note under the rows.
 */
export function WithdrawalStatusScreen({ id }: { id: string }) {
  const w = useWithdrawals((s) => s.list.find((x) => x.id === id));
  if (!w) return <TxNotFound />;
  // Sending: the send's own arrival (seconds, about 1 minute, 1 to 3 business days...), else the naira one
  const message = w.status === "sending" && w.eta ? w.eta : w.status === "review" && w.quickCheck ? QUICK_CHECK.message : STATUS_META[w.status].message;
  return (
    // WGT-13: a send to a Nigerian bank that's Sending waits for the naira partner
    <TxDetailView dir="out" amount={sentText(w)} title={`To ${w.recipientName}`} tag={w.tag} f={withdrawalFields(w)} receipt={withdrawalReceipt(w)}
      banner={w.status === "sending" && toNigerianBank(w) ? <NairaPausedBanner /> : undefined}>
      {message && <div className="alert info" id="withdrawalStatusMsg" role="note" style={{ marginTop: "14px", marginBottom: 0 }}><Raw html={WICON.info} /><span>{message}</span></div>}
      {/* A Paid send to a Nigerian bank: Report a problem (the wrong account: a recall request) */}
      {w.status === "paid" && toNigerianBank(w) && <SendProblem w={w} />}
    </TxDetailView>
  );
}
