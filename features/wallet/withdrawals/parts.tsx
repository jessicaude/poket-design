"use client";
import type { Withdrawal, WithdrawalStatus } from "@/lib/mock-api";
import { WICON } from "@/lib/icons";
import { fmtCurrency } from "../payout/payoutMath";
import { Grey } from "../payout/parts";
import { STATUS_META } from "../payout/withdrawals";
import { useWalletNav } from "../useWalletNav";

/** A withdrawal status chip: the wallet's .va-status with its tone (ok / muted / warn / err). */
export function StatusChip({ status }: { status: WithdrawalStatus }) {
  const m = STATUS_META[status];
  return <span className={`va-status${m.tone ? " " + m.tone : ""}`} data-status={status}>{m.chip}</span>;
}

/** An activity row for a withdrawal: the reference's txRow (withdraw type: bank icon, "Payout to {name}"), with its status chip. */
export function WithdrawalRow({ w }: { w: Withdrawal }) {
  const push = useWalletNav((s) => s.push);
  return (
    <div className="tx-row" data-txid={w.id} role="button" tabIndex={0} onClick={() => push({ name: "withdrawal", id: w.id })}
      onKeyDown={(e) => { if (e.key === "Enter") push({ name: "withdrawal", id: w.id }); }}>
      <div className="tx-ic out" dangerouslySetInnerHTML={{ __html: WICON.bank }} />
      <div className="tx-main">
        <div className="tx-title">To {w.recipientName}</div>
        <div className="tx-sub" style={{ display: "flex", alignItems: "center", gap: "6px" }}><StatusChip status={w.status} /><span>{w.recipientSub}</span></div>
      </div>
      <div className="tx-amt"><Grey>{"-" + fmtCurrency(w.amount, w.currency)}</Grey></div>
    </div>
  );
}

/** "₦X on hold": NGN reserved for withdrawals not yet paid. Opens the list of them. */
export function OnHoldLink({ reserved, id }: { reserved: number; id: string }) {
  const push = useWalletNav((s) => s.push);
  return (
    <span className="btn-ghost" id={id} role="button" tabIndex={0}
      onClick={(e) => { e.stopPropagation(); push({ name: "on-hold" }); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); push({ name: "on-hold" }); } }}>
      <Grey>{`${fmtCurrency(reserved, "NGN")} on hold`}</Grey>
    </span>
  );
}
