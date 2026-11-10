"use client";
import { WICON } from "@/lib/icons";
import { BackRow, Grey } from "../payout/parts";
import { conversionTitle, useConvert } from "../convert/useConvert";
import { useWalletNav } from "../useWalletNav";

const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

/** A conversion's receipt: the reference's tTxDetail for a 'convert' transaction (Status, Date, From, To, Rate, fee, Reference). */
export function ConversionReceiptScreen({ id }: { id: string }) {
  const c = useConvert((s) => s.conversions.find((x) => x.id === id));
  const back = useWalletNav((s) => s.back);
  if (!c) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  const row = (k: string, v: React.ReactNode) => <div className="info-row"><span>{k}</span><span>{v}</span></div>;
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg in" dangerouslySetInnerHTML={{ __html: WICON.convert }} />
      </div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: "var(--ok-600)" }}><Grey>{c.receivedText}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{conversionTitle(c)}</p>
      <div className="info-card" id="cvReceipt">
        {row("Status", "Completed")}
        {row("Date", fmtDate(c.createdAt))}
        {row("From", <Grey>{c.paidText}</Grey>)}
        {row("To", <Grey>{c.receivedText}</Grey>)}
        {row("Rate", <Grey>{c.rateText}</Grey>)}
        {row(c.feeLabel, <Grey>{c.feeText}</Grey>)}
        {row("Reference", <span className="mono">{c.ref}</span>)}
      </div>
    </>
  );
}
