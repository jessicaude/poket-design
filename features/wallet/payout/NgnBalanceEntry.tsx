"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "./payoutMath";
import { Grey } from "./parts";
import { usePayout } from "./usePayout";

/**
 * Demo entry point on the wallet home, from tWalletHome(): a Withdraw action (the reference's Payout action) and the
 * Cash list with the NGN rows (cashRowHtml). Withdraw, or tapping a row, opens the payout flow in NGN, as detailPayout does.
 */
export function NgnBalanceEntry() {
  const balance = useNgn((s) => s.ngnBalance);
  const held = useNgn((s) => s.ngnMerchantBalance);
  const open = usePayout((s) => s.open);
  return (
    <div className="screen-fade">
      <div className="action-row">
        <button className="action-btn" id="ngnWithdraw" onClick={() => open("NGN")}><span className="ic"><Raw html={WICON.bank} /></span>Withdraw</button>
      </div>
      <div className="assets-header"><span>Cash</span></div>
      <div className="section-card">
        <div className="tx-row asset-item-row" data-holdtype="cash" data-holdcur="NGN" data-holdbucket="open" onClick={() => open("NGN")}>
          <div className="asset-icon-wrap"><div className="badge" dangerouslySetInnerHTML={{ __html: WICON.ngFlag }} /></div>
          <div className="tx-main">
            <div className="tx-title">Nigerian Naira <span className="verified-badge"><Raw html={WICON.verified} /></span></div>
            <div className="tx-sub"><Grey>{`${Math.round(balance / 100).toLocaleString("en-US")} NGN`}</Grey></div>
          </div>
          <div className="asset-value"><div className="tx-amt"><Grey>{fmtCurrency(balance, "NGN")}</Grey></div></div>
        </div>
        {held > 0 && (
          // Not in the reference: a merchant-held bucket, tagged like its FIAT-ONLY rows. Opens payout, which explains it can't be withdrawn.
          <div className="tx-row asset-item-row" data-holdtype="cash" data-holdcur="NGN" data-holdbucket="merchant" onClick={() => open("NGN", "merchant")}>
            <div className="asset-icon-wrap"><div className="badge" dangerouslySetInnerHTML={{ __html: WICON.ngFlag }} /></div>
            <div className="tx-main">
              <div className="tx-title">Nigerian Naira <span className="verified-badge"><Raw html={WICON.verified} /></span></div>
              <div className="tx-sub"><Grey>{`${Math.round(held / 100).toLocaleString("en-US")} NGN`}</Grey><span className="fiat-tag">MERCHANT-HELD</span></div>
            </div>
            <div className="asset-value"><div className="tx-amt"><Grey>{fmtCurrency(held, "NGN")}</Grey></div></div>
          </div>
        )}
      </div>
    </div>
  );
}
