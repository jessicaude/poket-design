"use client";
import { useState } from "react";
import {
  PERIOD_LABEL, buildStatement, customRange, customRangeProblem, isoDay, longDay, periodRange, statementCsv, statementFileName, statementPdf,
  type LedgerEntry, type StatementPeriod, type StatementStatus,
} from "@/lib/statement";
import type { WithdrawalStatus } from "@/lib/mock-api";
import { useWithdrawals } from "../payout/useWithdrawals";
import { brandInfo, useWalletBrand } from "../brand";
import { NGN_VA, holderName, useNgn } from "../ngn/useNgn";
import { BackRow } from "../payout/parts";
import { saveBlob } from "../receipt/render";
import { useWalletNav } from "../useWalletNav";
import { useWalletToast } from "../useWalletToast";
import { useNgnLedger } from "./ledger";

/**
 * "Statement" on the NGN balance (NEW): a period (This month, Last month, Last 3 months, or a custom range of up to 12
 * months) and a format (PDF or CSV), then Download statement. Built from the NGN balance's ledger (lib/statement.ts).
 */
const PERIODS: StatementPeriod[] = ["this_month", "last_month", "last_3_months", "custom"];

/** The NGN account details, when there's an account (ready or frozen): the account name, number and bank. */
export function statementAccount(): [string, string][] | null {
  const d = useNgn.getState().dedicated;
  if (!d || (d.status !== "ready" && d.status !== "frozen")) return null;
  return [["Account name", holderName()], ...NGN_VA.fields(d.num)];
}

/** A send's status as it is now (both its lines: the send and any money back); other lines carry their own. */
const SEND_STATUS: Record<WithdrawalStatus, StatementStatus> = { scheduled: "Pending", sending: "Pending", review: "Held", paid: "Completed", failed: "Returned", reversed: "Reversed" };
export function statementStatus(e: LedgerEntry): StatementStatus {
  const w = e.withdrawalId ? useWithdrawals.getState().list.find((x) => x.id === e.withdrawalId) : undefined;
  return w ? SEND_STATUS[w.status] : e.status ?? "Completed";
}

export function StatementScreen() {
  const back = useWalletNav((s) => s.back);
  const brand = useWalletBrand((s) => s.brand);
  const [period, setPeriod] = useState<StatementPeriod>("this_month");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const today = isoDay(new Date());
  const [from, setFrom] = useState(isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(today);
  const problem = period === "custom" ? customRangeProblem(from, to) : null;

  const download = () => {
    if (problem) return;
    const range = period === "custom" ? customRange(from, to) : periodRange(period);
    const s = buildStatement(useNgnLedger.getState().entries, useNgn.getState().ngnBalance, range, { holder: holderName(), account: statementAccount() }, statementStatus);
    const blob = format === "pdf"
      ? new Blob([statementPdf(s, brandInfo(brand).name) as BlobPart], { type: "application/pdf" })
      : new Blob([statementCsv(s)], { type: "text/csv;charset=utf-8" });
    saveBlob(blob, statementFileName(s, format));
    useWalletToast.getState().showToast("Statement downloaded");
  };

  return (
    <>
      <BackRow id="backFromStatement" label="Nigerian Naira" onClick={back} />
      <div className="step-title">Statement</div>
      <p className="step-sub">NGN balance</p>
      <label className="field-label">Period</label>
      <div role="radiogroup" aria-label="Period">
        {PERIODS.map((p) => {
          const r = p === "custom" ? null : periodRange(p);
          return (
            <div key={p} className={`select-row ${period === p ? "sel" : ""}`} role="radio" aria-checked={period === p} tabIndex={0} data-period={p}
              onClick={() => setPeriod(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPeriod(p); } }}>
              <div className="meta">
                <div className="t1" style={{ fontWeight: 500 }}>{PERIOD_LABEL[p]}</div>
                <div className="t2">{r ? `${longDay(r.from)} to ${longDay(r.to)}` : "Up to 12 months"}</div>
              </div>
              <span className="radio" />
            </div>
          );
        })}
      </div>
      {period === "custom" && (
        <div id="statementCustom">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div><label className="field-label" htmlFor="statementFrom">From</label>
              <input className="field-input" id="statementFrom" type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="field-label" htmlFor="statementTo">To</label>
              <input className="field-input" id="statementTo" type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          {problem && <p className="step-sub" id="statementRangeMsg" role="alert" style={{ color: "var(--err-600)", marginTop: 0 }}>{problem}</p>}
        </div>
      )}
      <label className="field-label">Format</label>
      <div className="seg" role="radiogroup" aria-label="Format">
        {(["pdf", "csv"] as const).map((f) => (
          <div key={f} className={`seg-opt ${format === f ? "sel" : ""}`} role="radio" aria-checked={format === f} tabIndex={0} data-format={f} onClick={() => setFormat(f)}>{f.toUpperCase()}</div>
        ))}
      </div>
      <button className="btn-primary" id="downloadStatement" disabled={!!problem} onClick={download}>Download statement</button>
    </>
  );
}
