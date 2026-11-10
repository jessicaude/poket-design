"use client";
import type { Conversion } from "@/lib/mock-api";
import { WICON } from "@/lib/icons";
import { Grey } from "../payout/parts";
import { conversionTitle } from "../convert/useConvert";
import { useWalletNav } from "../useWalletNav";

/**
 * A conversion in the activity list: the reference's txRow for type 'convert' (tx-ic in, CV_ICON), titled
 * "Converted NGN to USDC", sub "₦10,000.00 NGN → 6.42 USDC", amount "+6.42 USDC".
 */
export function ConversionRow({ c }: { c: Conversion }) {
  const push = useWalletNav((s) => s.push);
  const open = () => push({ name: "conversion", id: c.id });
  return (
    <div className="tx-row" data-txid={c.id} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}>
      <div className="tx-ic in" dangerouslySetInnerHTML={{ __html: WICON.convert }} />
      <div className="tx-main"><div className="tx-title">{conversionTitle(c)}</div><div className="tx-sub"><Grey>{`${c.paidText} → ${c.receivedText}`}</Grey></div></div>
      <div className="tx-amt pos"><Grey>{"+" + c.receivedText}</Grey></div>
    </div>
  );
}
