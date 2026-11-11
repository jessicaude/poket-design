"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { useConvert } from "../convert/useConvert";
import { useSend } from "./useSend";

/**
 * Send stage 'unavailable': a bank account chosen with merchant-held naira as the source. It can't be sent to a bank;
 * Convert is the alternative. Not in the reference. Laid out like tHoldingDetail's header (flag, name with tag, amount).
 */
export function SendUnavailableScreen() {
  const back = useSend((s) => s.back);
  const held = useNgn((s) => s.ngnMerchantBalance);
  return (
    <>
      <BackRow id="backFromWithdraw" onClick={back} />
      <div className="center-col" style={{ padding: "2px 0 4px" }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "10px" }}>
          <div className="badge" style={{ width: "44px", height: "44px" }} dangerouslySetInnerHTML={{ __html: WICON.ngFlag }} />
        </div>
        <p className="step-sub" style={{ marginBottom: "2px" }}>Nigerian Naira<span className="fiat-tag">MERCHANT-HELD</span></p>
        <div className="step-title" style={{ fontSize: "28px", letterSpacing: "-.02em" }}><Grey>{fmtCurrency(held, "NGN")}</Grey></div>
      </div>
      <div className="alert warn" role="alert" style={{ marginTop: "14px" }}><Raw html={WICON.alert} /><span>Not available: this balance can&apos;t be sent to a bank</span></div>
      {/* Merchant-held naira converts to USD or USDC. */}
      <button className="btn-primary" id="withdrawUseConvert" onClick={() => { useSend.getState().close(); useConvert.getState().start({ from: "cash:NGN:merchant" }); }}>Convert</button>
    </>
  );
}
