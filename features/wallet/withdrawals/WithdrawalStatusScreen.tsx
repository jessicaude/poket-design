"use client";
import { SendProblem } from "./ReportProblemScreen";
import { TxFields, withdrawalFields } from "../history/fields";
import { BackRow, Grey } from "../payout/parts";
import { useWithdrawals } from "../payout/useWithdrawals";
import { QUICK_CHECK, STATUS_META, sentText } from "../payout/withdrawals";
import { useWalletNav } from "../useWalletNav";
import { StatusChip, withdrawalIcon } from "./parts";
import { NairaPausedBanner } from "../NairaPausedBanner";
import { toNigerianBank } from "@/store/partner";


/** A withdrawal's status: the reference's tTxDetail layout, with the status chip and its message. */
export function WithdrawalStatusScreen({ id }: { id: string }) {
  const w = useWithdrawals((s) => s.list.find((x) => x.id === id));
  const back = useWalletNav((s) => s.back);
  if (!w) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  // Sending: the send's own arrival (seconds, about 1 minute, 1 to 3 business days...), else the naira one
  const message = w.status === "sending" && w.eta ? w.eta : w.status === "review" && w.quickCheck ? QUICK_CHECK.message : STATUS_META[w.status].message;
  return (
    <>
      {/* WGT-13: a send to a Nigerian bank that's Sending waits for the naira partner */}
      {w.status === "sending" && toNigerianBank(w) && <NairaPausedBanner />}
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg out" dangerouslySetInnerHTML={{ __html: withdrawalIcon(w) }} />
      </div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px" }}><Grey>{sentText(w)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "6px" }}>To {w.recipientName}{w.tag && <span className="fiat-tag" id="withdrawalTag">{w.tag}</span>}</p>
      <div style={{ textAlign: "center" }} id="withdrawalStatus"><StatusChip status={w.status} quickCheck={w.quickCheck} /></div>
      {message && <p className="step-sub" id="withdrawalStatusMsg" style={{ textAlign: "center", margin: "8px 0 14px" }}>{message}</p>}
      {/* WGT-11: the shared rows. A send that converted adds what left the source, what arrived and at what rate; one Fee row covers the conversion and the send. */}
      <div className="info-card" id="txDetail" style={{ marginTop: message ? 0 : "14px" }}>
        <TxFields f={withdrawalFields(w)} />
      </div>
      {/* A Paid send to a Nigerian bank: Report a problem (the wrong account: a recall request) */}
      {w.status === "paid" && toNigerianBank(w) && <SendProblem w={w} />}
    </>
  );
}
