"use client";
import { WICON } from "@/lib/icons";
import { BackRow, Grey } from "../payout/parts";
import { cvParse } from "../convert/convertMath";
import { conversionTitle, useConvert } from "../convert/useConvert";
import { useWalletNav } from "../useWalletNav";
import { DetailRow, ReferenceRow, formatTxDate } from "./TxDetail";

/** " on Base" after a stablecoin amount, as the reference's conversion details have it. */
const onNetwork = (key: string) => { const o = cvParse(key); return o.k === "coin" ? ` on ${o.net}` : ""; };

/** A conversion's receipt: the reference's tTxDetail for a 'convert' transaction. */
export function ConversionReceiptScreen({ id }: { id: string }) {
  const c = useConvert((s) => s.conversions.find((x) => x.id === id));
  const back = useWalletNav((s) => s.back);
  if (!c) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg in" dangerouslySetInnerHTML={{ __html: WICON.convert }} />
      </div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: "var(--ok-600)" }}><Grey>{c.receivedText}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{conversionTitle(c)}</p>
      <div className="info-card" id="cvReceipt">
        <DetailRow label="Status" value="Completed" />
        <DetailRow label="Date" value={formatTxDate(c.createdAt)} />
        <DetailRow label="From" value={c.paidText + onNetwork(c.from)} />
        <DetailRow label="To" value={c.receivedText + onNetwork(c.to)} />
        <DetailRow label="Rate" value={c.rateText} />
        <DetailRow label={c.feeLabel} value={c.feeText} />
        <ReferenceRow refText={c.ref} />
      </div>
    </>
  );
}
