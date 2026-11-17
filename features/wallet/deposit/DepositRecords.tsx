"use client";
import { Grey } from "../payout/parts";
import { useWalletNav } from "../useWalletNav";
import { depositFields } from "../history/fields";
import { TxDetailView, TxIcon, TxNotFound } from "../history/TxView";
import { depositReceipt } from "../receipt/receipt";
import { fmtDepositAmount, useDeposit, type DepositRecord } from "./useDeposit";

/** txRow for a deposit: money in (+); the sub says how (the card, the rail, the network). */
export function DepositRow({ r }: { r: DepositRecord }) {
  const push = useWalletNav((s) => s.push);
  const open = () => push({ name: "deposit", id: r.id });
  return (
    <div className="tx-row" data-deposit={r.id} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}>
      <TxIcon dir="in" />
      <div className="tx-main"><div className="tx-title">{r.title}</div><div className="tx-sub">{r.sub}</div></div>
      <div className="tx-amt pos"><Grey>{"+" + fmtDepositAmount(r.amount, r.unit)}</Grey></div>
    </div>
  );
}

/** A deposit's detail: the shared transaction template (card deposits are FIAT-ONLY). */
export function DepositDetailScreen({ id }: { id: string }) {
  const r = useDeposit((s) => s.records.find((x) => x.id === id));
  if (!r) return <TxNotFound />;
  return <TxDetailView dir="in" amount={fmtDepositAmount(r.amount, r.unit)} title={r.title} tag={r.kind === "card" ? "FIAT-ONLY" : undefined} f={depositFields(r)} receipt={depositReceipt(r)} />;
}
