"use client";
import type { Withdrawal, WithdrawalStatus } from "@/lib/mock-api";
import { fmtCurrency } from "../payout/payoutMath";
import { Grey } from "../payout/parts";
import { QUICK_CHECK, STATUS_META, sentText } from "../payout/withdrawals";
import { useWalletNav } from "../useWalletNav";
import { TxIcon } from "../history/TxView";

/** A withdrawal status chip: the wallet's .va-status with its tone (ok / muted / warn / err). */
export function StatusChip({ status, quickCheck }: { status: WithdrawalStatus; quickCheck?: boolean }) {
  const m = STATUS_META[status];
  const chip = status === "review" && quickCheck ? QUICK_CHECK.chip : m.chip;
  return <span className={`va-status${m.tone ? " " + m.tone : ""}`} data-status={status}>{chip}</span>;
}


/**
 * An activity row for a send: the reference's txRow (icon, title, sub, amount), the same as every other row in the
 * wallet. Title "To {name}"; the sub is what converted ("₦5,000.00 NGN → $3.23 USD", like the reference's conversion
 * rows) or the account; the amount is what left your balance. A status chip follows the sub only while it isn't
 * finished (Scheduled, Held for review, Sending) or when it went wrong (Failed, Reversed): paid rows have none, like
 * the reference's completed rows.
 */
export function WithdrawalRow({ w }: { w: Withdrawal }) {
  const push = useWalletNav((s) => s.push);
  // The icon is the direction only: the sub says how (a Poket user's handle, a wallet's address get their method)
  const how = w.kind === "poket" ? "Poket" : w.kind === "wallet" ? "Stablecoin wallet" : null;
  const sub = w.conversion ? `${w.conversion.paidText} \u2192 ${w.conversion.receivedText}` : how && w.recipientSub ? `${how} · ${w.recipientSub}` : w.recipientSub;
  return (
    <div className="tx-row" data-txid={w.id} role="button" tabIndex={0} onClick={() => push({ name: "withdrawal", id: w.id })}
      onKeyDown={(e) => { if (e.key === "Enter") push({ name: "withdrawal", id: w.id }); }}>
      <TxIcon dir="out" />
      <div className="tx-main">
        <div className="tx-title">{`To ${w.recipientName}`}</div>
        <div className="tx-sub"><Grey>{sub}</Grey>{w.status !== "paid" && <> · <StatusChip status={w.status} quickCheck={w.quickCheck} /></>}</div>
      </div>
      <div className="tx-amt"><Grey>{"-" + sentText(w)}</Grey></div>
    </div>
  );
}

/**
 * "₦X on hold": NGN reserved for sends not yet paid. Opens the list of them. `line`: on the NGN balance screen, a
 * grey line under the balance like a balance's second line (tHoldingDetail's step-sub); else inline (the home row).
 */
export function OnHoldLink({ reserved, id, line }: { reserved: number; id: string; line?: boolean }) {
  const push = useWalletNav((s) => s.push);
  const open = (e: { stopPropagation: () => void }) => { e.stopPropagation(); push({ name: "on-hold" }); };
  if (line) {
    return (
      <p className="step-sub" id={id} role="button" tabIndex={0} style={{ cursor: "pointer", marginBottom: 0 }}
        onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(e); }}>
        <Grey>{`${fmtCurrency(reserved, "NGN")} on hold`}</Grey> ›
      </p>
    );
  }
  return (
    <span className="btn-ghost" id={id} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(e); }}>
      <Grey>{`${fmtCurrency(reserved, "NGN")} on hold`}</Grey>
    </span>
  );
}
