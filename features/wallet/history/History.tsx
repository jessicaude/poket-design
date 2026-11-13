"use client";
import { Fragment, useState, type ReactNode } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { formatNaira } from "@/lib/money";
import { allRefunds } from "@/lib/refunds";
import type { NgnCredit } from "@/lib/mock-api";
import { useAccount } from "@/store/account";
import { useConvert } from "../convert/useConvert";
import { CheckoutPaymentRow, RefundRow } from "../disputes/DisputeScreens";
import { DEMO_TXNS, type DemoTx } from "../home/homeData";
import { BackRow, Grey } from "../payout/parts";
import { useWithdrawals } from "../payout/useWithdrawals";
import { fmtCurrency } from "../payout/payoutMath";
import { useWalletNav } from "../useWalletNav";
import { ConversionRow } from "../withdrawals/ConversionRow";
import { WithdrawalRow } from "../withdrawals/parts";
import { useNgnCredits } from "./credits";
import { TxFields, creditFields } from "./fields";

/**
 * WGT-11, history: every transaction as the reference's activity row (txRow), newest first, grouped by day, with
 * the filter All, Money in, Money out (the exploration's FILTERS; a conversion moves money between your own
 * balances, so it shows under All only, as the exploration's kindOf has it). Rows carry a status chip unless
 * completed.
 */
export type HistoryDir = "in" | "out" | "convert";
export type HistoryItem = { at: number; key: string; dir: HistoryDir;
  /** Moves the NGN balance (the NGN balance's history). */
  ngn: boolean; el: ReactNode };

/** txRow(t) for a demo record: refund in, payment out (activity icon); deposit in (add icon). */
function DemoTxRow({ t }: { t: DemoTx }) {
  const push = useWalletNav((s) => s.push);
  return (
    <div className="tx-row" data-txid={t.id} role="button" tabIndex={0} onClick={() => push({ name: "tx", id: t.id })}>
      <div className={`tx-ic ${t.type === "payment" ? "out" : "in"}`} dangerouslySetInnerHTML={{ __html: t.type === "deposit" ? WICON.add : WICON.activity }} />
      <div className="tx-main"><div className="tx-title">{t.title}</div><div className="tx-sub">{t.sub}</div></div>
      <div className={`tx-amt ${t.positive ? "pos" : ""}`}><Grey>{(t.positive ? "+" : "-") + fmtCurrency(t.amount, "USD")}</Grey></div>
    </div>
  );
}

/** Every transaction in the wallet, newest first. */
export function useActivity(): HistoryItem[] {
  const withdrawals = useWithdrawals((s) => s.list);
  const conversions = useConvert((s) => s.conversions);
  const credits = useNgnCredits((s) => s.list);
  // WGT-12: the demo user's Checkout payments (naira and dollar, card and bank transfer), kept on the account
  const payments = useAccount((s) => s.account?.payments) ?? [];
  return [
    ...DEMO_TXNS.map((t) => ({ at: t.ts, key: t.id, dir: (t.positive ? "in" : "out") as HistoryDir, ngn: false, el: <DemoTxRow key={t.id} t={t} /> })),
    // A payment by card or bank transfer doesn't move the NGN balance; a refund into it does
    ...payments.map((p) => ({ at: new Date(p.at).getTime(), key: p.id, dir: "out" as const, ngn: false, el: <CheckoutPaymentRow key={p.id} p={p} /> })),
    ...allRefunds(payments).map(({ p, r }) => ({ at: new Date(r.at).getTime(), key: r.id, dir: "in" as const, ngn: r.to === "ngn", el: <RefundRow key={r.id} p={p} r={r} /> })),
    ...withdrawals.map((w) => ({ at: w.createdAt, key: w.id, dir: "out" as const, ngn: w.sourceKey ? w.sourceKey.startsWith("cash:NGN:") : w.currency === "NGN", el: <WithdrawalRow key={w.id} w={w} /> })),
    ...conversions.map((c) => ({ at: c.createdAt, key: c.id, dir: "convert" as const, ngn: [c.from, c.to].some((k) => k.startsWith("cash:NGN:")), el: <ConversionRow key={c.id} c={c} /> })),
    ...credits.map((c) => ({ at: c.at, key: c.id, dir: "in" as const, ngn: true, el: <CreditRow key={c.id} c={c} /> })),
  ].sort((a, b) => b.at - a.at);
}

/** The day a group of rows is under: Today, Yesterday, else "Nov 9, 2026". */
export function dayLabel(ts: number, now = new Date()): string {
  const d = new Date(ts), day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The exploration's FILTERS, as far as WGT-11 goes. */
const FILTERS: [HistoryFilter, string][] = [["all", "All"], ["in", "Money in"], ["out", "Money out"]];
export type HistoryFilter = "all" | "in" | "out";

/** The list: the filter, then a day heading over each day's rows. */
export function History({ items, id, empty }: { items: HistoryItem[]; id: string; empty: string }) {
  const [f, setF] = useState<HistoryFilter>("all");
  if (items.length === 0) return <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>{empty}</div>;
  const list = items.filter((x) => f === "all" || x.dir === f);
  const groups: { label: string; items: HistoryItem[] }[] = [];
  for (const x of list) {
    const label = dayLabel(x.at);
    const g = groups.at(-1);
    if (g?.label === label) g.items.push(x); else groups.push({ label, items: [x] });
  }
  return (
    <div id={id}>
      <div className="chip-row history-filter" role="group" aria-label="Filter">
        {FILTERS.map(([v, l]) => (
          <button key={v} type="button" className={`chip-opt ${f === v ? "sel" : ""}`} aria-pressed={f === v} data-histfilter={v} onClick={() => setF(v)}>{l}</button>
        ))}
      </div>
      {groups.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }} data-histempty="">Nothing matches.</div>
        : groups.map((g) => (
          <Fragment key={g.label}>
            <div className="history-day" data-histday={g.label}>{g.label}</div>
            <div className="section-card">{g.items.map((x) => <Fragment key={x.key}>{x.el}</Fragment>)}</div>
          </Fragment>
        ))}
    </div>
  );
}

/** A credit's row: "Top-up · Bank transfer", "From Chinedu Eze · Zenith Bank", "Recovered · To {name}"... (NEW copy). */
export function creditTitle(c: NgnCredit, recipientName?: string) {
  if (c.kind === "temp") return "Top-up · Bank transfer";
  if (c.kind === "recall") return `Recall · ${recipientName ?? c.from}`;
  return `From ${c.from.split(" · ")[0]}`;
}
const CREDIT_SUB: Record<NgnCredit["kind"], string> = {
  temp: "Temporary account", account: "NGN account details", delayed: "NGN account details · Delayed", poket: "Poket", recall: "Recovered",
};
const creditIcon = (c: NgnCredit) => (c.kind === "poket" ? WICON.user : c.kind === "temp" ? WICON.add : WICON.bank);

function useRecallName(c: NgnCredit) {
  return useWithdrawals((s) => (c.withdrawalId ? s.list.find((w) => w.id === c.withdrawalId)?.recipientName : undefined));
}

export function CreditRow({ c }: { c: NgnCredit }) {
  const push = useWalletNav((s) => s.push);
  const name = useRecallName(c);
  const open = () => push({ name: "credit", id: c.id });
  return (
    <div className="tx-row" data-txid={c.id} data-credit={c.kind} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}>
      <div className="tx-ic in" dangerouslySetInnerHTML={{ __html: creditIcon(c) }} />
      <div className="tx-main"><div className="tx-title">{creditTitle(c, name)}</div><div className="tx-sub">{CREDIT_SUB[c.kind]}</div></div>
      <div className="tx-amt pos"><Grey>{"+" + formatNaira(c.amount)}</Grey></div>
    </div>
  );
}

/** A credit's receipt (tTxDetail): the naira flag, the amount in, and the shared rows. */
export function CreditDetailScreen({ id }: { id: string }) {
  const back = useWalletNav((s) => s.back);
  const c = useNgnCredits((s) => s.list.find((x) => x.id === id));
  const name = useWithdrawals((s) => (c?.withdrawalId ? s.list.find((w) => w.id === c.withdrawalId)?.recipientName : undefined));
  if (!c) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg tx-ic-real" dangerouslySetInnerHTML={{ __html: WICON.ngFlag }} />
      </div>
      <div className="step-title mono" id="creditAmount" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: "var(--ok-600)" }}><Grey>{formatNaira(c.amount)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{creditTitle(c, name)}</p>
      <div className="info-card" id="txDetail"><TxFields f={creditFields(c)} /></div>
      {c.kind === "delayed" && (
        <div className="alert info" id="creditDelayed" role="note" style={{ marginTop: "14px", marginBottom: 0 }}><Raw html={WICON.info} /><span>This transfer was delayed.</span></div>
      )}
    </>
  );
}
