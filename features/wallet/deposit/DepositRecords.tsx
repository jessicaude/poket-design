"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { CURRENCY_ICON } from "../home/homeData";
import { BackRow, Grey } from "../payout/parts";
import { useWalletNav } from "../useWalletNav";
import type { CashCurrency } from "../useHoldings";
import { DetailRow, ReferenceRow, formatTxDate } from "../withdrawals/TxDetail";
import { fmtDepositAmount, useDeposit, type DepositRecord } from "./useDeposit";

/** txRow for a deposit (the reference's type 'deposit': the add icon), money in. */
export function DepositRow({ r }: { r: DepositRecord }) {
  const push = useWalletNav((s) => s.push);
  return (
    <div className="tx-row" data-deposit={r.id} role="button" tabIndex={0} onClick={() => push({ name: "deposit", id: r.id })}>
      <div className="tx-ic in"><Raw html={WICON.add} /></div>
      <div className="tx-main"><div className="tx-title">{r.title}</div><div className="tx-sub">{r.sub}</div></div>
      <div className="tx-amt pos"><Grey>{"+" + fmtDepositAmount(r.amount, r.unit)}</Grey></div>
    </div>
  );
}

/** A deposit's detail: what was added, then the reference's detail rows (card, fee, rail, network) and the reference. */
export function DepositDetailScreen({ id }: { id: string }) {
  const back = useWalletNav((s) => s.back);
  const r = useDeposit((s) => s.records.find((x) => x.id === id));
  if (!r) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  const icon = r.kind === "coin" ? (r.unit === "USDT" ? WICON.usdt : WICON.usdc) : WICON[CURRENCY_ICON[r.unit as CashCurrency]];
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}><div className="tx-ic tx-ic-lg tx-ic-real"><Raw html={icon} /></div></div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: "var(--ok-600)" }}><Grey>{fmtDepositAmount(r.amount, r.unit)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{r.title}</p>
      <div className="info-card" id="txDetail">
        <DetailRow label="Status" value="Completed" />
        <DetailRow label="Date" value={formatTxDate(r.at)} />
        {r.kind !== "coin" && <DetailRow label="Currency" value={r.unit} />}
        {r.rows.map(([k, v]) => <DetailRow key={k} label={k} value={v} />)}
        <ReferenceRow refText={r.ref} />
      </div>
    </>
  );
}
