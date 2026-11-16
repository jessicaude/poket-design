"use client";
import type { ReactNode } from "react";
import { WICON } from "@/lib/icons";
import { BackRow, Grey } from "../payout/parts";
import { ShareReceiptButton } from "../receipt/ReceiptSheet";
import type { Receipt } from "../receipt/receipt";
import { useWalletNav } from "../useWalletNav";
import { TxFields, type TxFieldsData } from "./fields";

/**
 * One look for every transaction, money in or out. The icon says the direction only: + for money in, ↗ for money
 * out, ⇄ for a conversion between your own balances. How it moved (bank, card, Poket, stablecoin) is in the row's
 * subtitle and the detail's Method row.
 */
export type TxDir = "in" | "out" | "convert";
const DIR_ICON: Record<TxDir, keyof typeof WICON> = { in: "add", out: "send", convert: "convert" };

/** The direction icon, in an activity row or (lg) at the top of a transaction's detail. */
export function TxIcon({ dir, lg }: { dir: TxDir; lg?: boolean }) {
  return <div className={`tx-ic${lg ? " tx-ic-lg" : ""} ${dir === "out" ? "out" : "in"}`} data-dir={dir} dangerouslySetInnerHTML={{ __html: WICON[DIR_ICON[dir]] }} />;
}

/**
 * A transaction's detail (the reference's tTxDetail), the same template for every kind: the direction icon, the
 * amount (green when it came in), one title line; the rows in FIELD_ORDER (the status only in the Status row);
 * Share receipt; then what's particular to it (`children`: a note, Raise a dispute, Report a problem).
 */
export function TxDetailView({ dir, amount, title, tag, f, rows, receipt, banner, amountId, cardId = "txDetail", children }: {
  dir: TxDir; amount: string; title: string;
  /** FIAT-ONLY, after the title. */
  tag?: string;
  f: TxFieldsData;
  /** Rows after the shared ones (a dispute's). */
  rows?: ReactNode;
  receipt: Receipt;
  /** Above the Back row (the naira partner's banner). */
  banner?: ReactNode;
  amountId?: string; cardId?: string;
  children?: ReactNode;
}) {
  const back = useWalletNav((s) => s.back);
  return (
    <>
      {banner}
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}><TxIcon dir={dir} lg /></div>
      <div className="step-title mono" id={amountId} data-txamount="" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: dir === "out" ? "var(--n-900)" : "var(--ok-600)" }}>
        <Grey>{amount}</Grey>
      </div>
      <p className="step-sub" data-txtitle="" style={{ textAlign: "center", marginBottom: "14px" }}>{title}{tag && <span className="fiat-tag" id="txTag">{tag}</span>}</p>
      <div className="info-card" id={cardId}><TxFields f={f}>{rows}</TxFields></div>
      <ShareReceiptButton receipt={receipt} />
      {children}
    </>
  );
}

/** A transaction that isn't there (any more). */
export function TxNotFound() {
  const back = useWalletNav((s) => s.back);
  return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
}
