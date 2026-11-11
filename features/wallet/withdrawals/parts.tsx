"use client";
import type { Withdrawal, WithdrawalStatus } from "@/lib/mock-api";
import { WICON } from "@/lib/icons";
import { fmtCurrency } from "../payout/payoutMath";
import { Grey } from "../payout/parts";
import { QUICK_CHECK, STATUS_META } from "../payout/withdrawals";
import { useWalletNav } from "../useWalletNav";

/** A withdrawal status chip: the wallet's .va-status with its tone (ok / muted / warn / err). */
export function StatusChip({ status, quickCheck }: { status: WithdrawalStatus; quickCheck?: boolean }) {
  const m = STATUS_META[status];
  const chip = status === "review" && quickCheck ? QUICK_CHECK.chip : m.chip;
  return <span className={`va-status${m.tone ? " " + m.tone : ""}`} data-status={status}>{chip}</span>;
}

/** A send's icon: a bank, a debit card, a Poket user, or the stablecoin. */
export const withdrawalIcon = (w: Withdrawal) =>
  w.kind === "poket" ? WICON.user : w.kind === "card" ? WICON.card : w.kind === "wallet" ? (w.amountText?.includes("USDT") ? WICON.usdt : WICON.usdc) : WICON.bank;

/** An activity row for a withdrawal: the reference's txRow (withdraw type: bank icon, "Payout to {name}"), with its status chip. */
export function WithdrawalRow({ w }: { w: Withdrawal }) {
  const push = useWalletNav((s) => s.push);
  return (
    <div className="tx-row" data-txid={w.id} role="button" tabIndex={0} onClick={() => push({ name: "withdrawal", id: w.id })}
      onKeyDown={(e) => { if (e.key === "Enter") push({ name: "withdrawal", id: w.id }); }}>
      <div className="tx-ic out" dangerouslySetInnerHTML={{ __html: withdrawalIcon(w) }} />
      <div className="tx-main">
        {/* A send that converted: one row, "To {name} · {source amount} → {target amount}". */}
        <div className="tx-title">{w.conversion ? <Grey>{`To ${w.recipientName} \u00b7 ${w.conversion.paidText} \u2192 ${w.conversion.receivedText}`}</Grey> : `To ${w.recipientName}`}</div>
        <div className="tx-sub" style={{ display: "flex", alignItems: "center", gap: "6px" }}><StatusChip status={w.status} quickCheck={w.quickCheck} /><span>{w.recipientSub}</span></div>
      </div>
      <div className="tx-amt"><Grey>{"-" + (w.amountText ?? fmtCurrency(w.amount, w.currency))}</Grey></div>
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
