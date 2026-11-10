"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { CURRENCY_INFO, HOLD_PLACEHOLDER, convertAmount, fmtCurrency, isCrossBorder, payoutEta } from "../payoutMath";
import { Grey } from "../parts";
import { usePayout } from "../usePayout";
import { useWalletNav } from "../../useWalletNav";

/** tPayout stage 'processing' (cash). */
export function ProcessingScreen() {
  const { currency, cents, recipient } = usePayout();
  return (
    <div className="center-col" style={{ paddingTop: "50px" }}>
      <div className="sending-dots"><span /><span /><span /></div>
      <div className="step-title" style={{ marginTop: "18px" }}>Sending payout&hellip;</div>
      <p className="step-sub"><Grey>{`${fmtCurrency(cents, currency)} to ${recipient?.name ?? ""}`}</Grey></p>
    </div>
  );
}

/** tPayout stage 'done' (cash). */
export function DoneScreen() {
  const { currency, recipient: r, sent, speed, lastRef, close } = usePayout();
  if (!r || !sent) return null;
  const isSelf = r.isSelf;
  const crossBorder = isCrossBorder(currency, r);
  const recv = crossBorder ? convertAmount(Math.max(0, sent.amount - sent.fee), currency, r.currency) : sent.amount;
  const held = sent.status === "scheduled";
  const eta = held ? `After ${HOLD_PLACEHOLDER}` : payoutEta(currency, r, speed);
  const icon = CURRENCY_INFO[currency].icon;
  return (
    <>
      <div className="center-col" style={{ paddingBottom: 0 }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "14px" }}>
          <div className="check-circle" style={{ marginBottom: 0 }}><Raw html={WICON.check} /></div>
          <span className="check-badge" dangerouslySetInnerHTML={{ __html: icon ? WICON[icon] : "" }} />
        </div>
        <div className="step-title mono" style={{ marginTop: "2px", fontSize: "26px" }}><Grey>{fmtCurrency(sent.amount, currency)}</Grey></div>
        {/* Held (first payment to a new account): NEW copy, not in the reference */}
        <p className="step-sub">{held ? `Sends to ${r.name} after ${HOLD_PLACEHOLDER}` : `${isSelf ? "On its way to" : "Sent to"} ${r.name}`}</p>
        <span className="btn-ghost" id="viewPayoutTx" role="button" tabIndex={0}
          onClick={() => { close(); useWalletNav.getState().push({ name: "withdrawal", id: sent.id }); }}>View transaction</span>
      </div>
      <div className="receipt-card" style={{ marginTop: "16px" }}>
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.hash} /></span><span className="r-label">Confirmation</span><span className="r-value mono">{lastRef}</span></div>
        {crossBorder && (
          <div className="receipt-row"><span className="r-ic"><Raw html={WICON.coins} /></span><span className="r-label">Recipient receives</span><span className="r-value"><Grey>{fmtCurrency(recv, r.currency)}</Grey></span></div>
        )}
        <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.calendar} /></span><span className="r-label">{isSelf ? "Estimated arrival" : "Estimated delivery"}</span><span className="r-value">{eta}</span></div>
      </div>
      <p className="fine-print"><Raw html={WICON.info} /><span>A confirmation receipt has been sent to your email.</span></p>
      <button className="btn-primary" id="payoutDone" style={{ marginTop: "18px" }} onClick={close}>Done</button>
    </>
  );
}
