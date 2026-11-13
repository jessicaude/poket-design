"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { CURRENCY_INFO, HOLD_PLACEHOLDER } from "../payoutMath";
import { Grey } from "../parts";
import { usePayout } from "../usePayout";
import { useWalletNav } from "../../useWalletNav";
import { sendSummary } from "../../send/sendSummary";
import { cvParse } from "../../convert/convertMath";
import { QUICK_CHECK, STATUS_META } from "../withdrawals";

/** tPayout stage 'processing': what they get, to whom. */
export function ProcessingScreen() {
  const { cents, recipient, payFrom, payCents, jitter } = usePayout();
  const text = payFrom && recipient ? sendSummary(recipient, payFrom, payCents, cents, jitter).theyGetText : "";
  return (
    <div className="center-col" style={{ paddingTop: "50px" }}>
      <div className="sending-dots"><span /><span /><span /></div>
      <div className="step-title" style={{ marginTop: "18px" }}>Sending&hellip;</div>
      <p className="step-sub"><Grey>{`${text} to ${recipient?.name ?? ""}`}</Grey></p>
    </div>
  );
}

/**
 * tPayout stage 'done', for any recipient: what they get, the confirmation and arrival from the send's summary.
 * A Poket user is paid at once ("Sent to"); a first payment to a bank account sends after [hold].
 */
export function DoneScreen() {
  const { recipient: r, sent, lastRef, close, payFrom, payCents, cents, jitter } = usePayout();
  if (!r || !sent || !payFrom) return null;
  const s = sendSummary(r, payFrom, payCents, cents, jitter);
  const held = sent.status === "scheduled";
  // A first payment of $500 or more to a new card, wallet or Poket user (the exploration's doneScreen when held)
  const checking = sent.status === "review" && !!sent.quickCheck;
  // Held for review after the 3rd failed selfie check (not approved, not sent)
  const reviewing = sent.status === "review" && !sent.quickCheck;
  // A converted send leads with what left your balance (its badge too); what they get follows
  const t = cvParse(s.converting ? payFrom : s.targetKey);
  const iconKey = t.k === "coin" ? t.asset.toLowerCase() : CURRENCY_INFO[t.cur as keyof typeof CURRENCY_INFO]?.icon;
  const who = r.isSelf || r.methodType === "wallet" ? r.name : r.name.split(/\s+/)[0];
  return (
    <>
      <div className="center-col" style={{ paddingBottom: 0 }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "14px" }}>
          <div className="check-circle" style={{ marginBottom: 0 }}><Raw html={WICON.check} /></div>
          <span className="check-badge" dangerouslySetInnerHTML={{ __html: iconKey ? WICON[iconKey as keyof typeof WICON] ?? "" : "" }} />
        </div>
        {s.converting && s.youSendText ? (
          <>
            <div className="step-title mono" id="doneSent" style={{ marginTop: "2px", fontSize: "26px" }}><Grey>{s.youSendText}</Grey> <span style={{ fontFamily: "var(--sans)" }}>sent</span></div>
            <p className="step-sub" id="doneTheyGet" style={{ marginBottom: "2px" }}>{who} gets <Grey>{s.theyGetText}</Grey></p>
          </>
        ) : <div className="step-title mono" style={{ marginTop: "2px", fontSize: "26px" }}><Grey>{s.theyGetText}</Grey></div>}
        <p className="step-sub">{held ? `Sends to ${r.name} after ${HOLD_PLACEHOLDER}` : checking || reviewing ? `To ${r.name}` : `${r.isSelf ? "On its way to" : "Sent to"} ${r.name}`}{s.tag && <span className="fiat-tag">{s.tag}</span>}</p>
        {reviewing && (
          <>
            <span className="va-status warn" id="heldForReview">{STATUS_META.review.chip}</span>
            <p className="step-sub" id="heldForReviewNote" style={{ marginTop: "8px" }}>{STATUS_META.review.message}</p>
          </>
        )}
        {checking && (
          <>
            <span className="va-status warn" id="quickCheck">{QUICK_CHECK.chip}</span>
            <p className="step-sub" id="quickCheckNote" style={{ marginTop: "8px" }}>{QUICK_CHECK.message}</p>
          </>
        )}
        <span className="btn-ghost" id="viewPayoutTx" role="button" tabIndex={0}
          onClick={() => { close(); useWalletNav.getState().push({ name: "withdrawal", id: sent.id }); }}>View transaction</span>
      </div>
      <div className="receipt-card" style={{ marginTop: "16px" }}>
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.hash} /></span><span className="r-label">Confirmation</span><span className="r-value mono">{lastRef}</span></div>
        {/* Held for a quick check: no estimate until it's cleared (the note above says how long) */}
        {!checking && !reviewing && <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.calendar} /></span><span className="r-label">{r.isSelf ? "Estimated arrival" : "Estimated delivery"}</span><span className="r-value">{held ? `After ${HOLD_PLACEHOLDER}` : s.arrival}</span></div>}
      </div>
      <p className="fine-print"><Raw html={WICON.info} /><span>We&rsquo;ve emailed you a receipt.</span></p>
      <button className="btn-primary" id="payoutDone" style={{ marginTop: "18px" }} onClick={close}>Done</button>
    </>
  );
}
