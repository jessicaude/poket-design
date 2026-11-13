"use client";
import { WICON } from "@/lib/icons";
import { BackRow, Grey } from "../payout/parts";
import { conversionTitle, useConvert } from "../convert/useConvert";
import { useWalletNav } from "../useWalletNav";
import { TxFields, conversionFields } from "../history/fields";
import { ShareReceiptButton } from "../receipt/ReceiptSheet";
import { conversionReceipt } from "../receipt/receipt";

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
        <TxFields f={conversionFields(c)} />
      </div>
      <ShareReceiptButton receipt={conversionReceipt(c)} />
    </>
  );
}
