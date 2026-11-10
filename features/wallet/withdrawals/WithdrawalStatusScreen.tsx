"use client";
import { WICON } from "@/lib/icons";
import { fmtCurrency, fmtFee } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { useWithdrawals } from "../payout/useWithdrawals";
import { STATUS_META } from "../payout/withdrawals";
import { useWalletNav } from "../useWalletNav";
import { StatusChip } from "./parts";

/** The reference's formatTxDate: "Nov 10, 2026 - 3:04 PM". */
const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

/** A withdrawal's status: the reference's tTxDetail layout, with the status chip and its message. */
export function WithdrawalStatusScreen({ id }: { id: string }) {
  const w = useWithdrawals((s) => s.list.find((x) => x.id === id));
  const back = useWalletNav((s) => s.back);
  if (!w) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  const message = STATUS_META[w.status].message;
  const row = (k: string, v: React.ReactNode) => <div className="info-row"><span>{k}</span><span>{v}</span></div>;
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg out" dangerouslySetInnerHTML={{ __html: WICON.bank }} />
      </div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px" }}><Grey>{fmtCurrency(w.amount, w.currency)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "6px" }}>Payout to {w.recipientName}</p>
      <div style={{ textAlign: "center" }} id="withdrawalStatus"><StatusChip status={w.status} /></div>
      {message && <p className="step-sub" id="withdrawalStatusMsg" style={{ textAlign: "center", margin: "8px 0 14px" }}>{message}</p>}
      <div className="info-card" style={{ marginTop: message ? 0 : "14px" }}>
        {row("Status", <StatusChip status={w.status} />)}
        {row("Date", fmtDate(w.createdAt))}
        {row("To", w.recipientSub)}
        {row("Fee", <Grey>{fmtFee(w.fee, w.currency)}</Grey>)}
        {row("Reference", <span className="mono">{w.ref}</span>)}
      </div>
    </>
  );
}
