"use client";
import type { PayoutRecipient } from "@/lib/mock-api";
import { WICON } from "@/lib/icons";
import { CURRENCY_INFO, hasSpeeds, isCrossBorder, payoutMethodBadgeHtml, payoutMethodSub, recipientsFor } from "../payoutMath";
import { BackRow, SpinButton } from "../parts";
import { usePayout } from "../usePayout";

/** tPayout stage 'recipient' (cash): your accounts, then other recipients. */
export function RecipientScreen() {
  const { recipients, recipient, currency, selectRecipient, startAdd, back } = usePayout();
  const shown = recipientsFor(recipients, currency); // NGN: Nigerian bank accounts only
  const mine = shown.filter((r) => r.isSelf);
  const others = shown.filter((r) => !r.isSelf);
  const row = (r: PayoutRecipient) => {
    const sel = recipient?.id === r.id && recipient.isSelf === r.isSelf;
    const crossBorder = isCrossBorder(currency, r);
    const methodNote = r.isSelf && hasSpeeds(currency) ? (r.methodType === "bank" ? "Standard" : "Instant") : null;
    return (
      <div key={r.id} className={`select-row ${sel ? "sel" : ""}`} data-payoutrecipient={`${r.isSelf ? "self" : "other"}:${r.id}`} onClick={() => selectRecipient(r)}>
        <div className="badge" dangerouslySetInnerHTML={{ __html: payoutMethodBadgeHtml(r) }} />
        <div className="meta">
          <div className="t1">
            {r.name} {crossBorder && <span className="status-pill" dangerouslySetInnerHTML={{ __html: `${WICON.globe} Int'l` }} />}
            {methodNote && <span className="status-pill" dangerouslySetInnerHTML={{ __html: `${WICON.percent} ${methodNote}` }} />}
          </div>
          <div className="t2 mono">{payoutMethodSub(r)}</div>
        </div>
        <div className="radio" />
      </div>
    );
  };
  const empty = (text: string) => <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "4px 0 10px" }}>{text}</div>;
  return (
    <>
      <BackRow id="backToPayoutCurrency" onClick={back} />
      <div className="step-title">Recipient</div>
      <p className="step-sub">Pay out {CURRENCY_INFO[currency].name} to your own account or someone else&apos;s.</p>
      <label className="field-label">Your accounts</label>
      {mine.length ? mine.map(row) : empty("No linked accounts yet.")}
      <button className="btn-secondary" id="addPayoutSelfBtn" style={{ width: "100%", margin: "6px 0 14px" }} onClick={() => startAdd(true)}>+ Link a payout method</button>
      <label className="field-label">Other recipients</label>
      {others.length ? others.map(row) : empty("No saved recipients yet.")}
      <button className="btn-secondary" id="addPayoutOtherBtn" style={{ width: "100%", margin: "6px 0 14px" }} onClick={() => startAdd(false)}>+ Add a recipient</button>
      <SpinButton id="payoutRecipientContinue" disabled={!recipient} delay={400} onClick={() => usePayout.setState({ cents: 0, stage: "amount" })}>Continue</SpinButton>
    </>
  );
}
