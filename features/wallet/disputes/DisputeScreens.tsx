"use client";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { Raw } from "@/components/ui/Raw";
import { CHECK_DRAW } from "@/lib/icons";
import { WICON } from "@/lib/icons";
import {
  DESCRIPTION_MAX, DISPUTE_DAYS, DISPUTE_REASONS, DISPUTE_STRIKE_LIMIT, EVIDENCE_LABEL, NEW_DISPUTE, NOT_MINE_REASON, REASON_SHORT,
  addedCount, canRaiseDispute, countDisputeStrike, formButton, releaseNote, dateProblem, disputeStrikes, disputeWindow, fmtLong, maskDate, openDispute, type DisputeForm,
} from "@/lib/disputes";
import { useAccount, type Payment, type Refund } from "@/store/account";
import { allRefunds, paymentStatus, refundDest, refundLeft, refundNote, refundTitle, refundedTotal, reversedTotal } from "@/lib/refunds";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { DEMO_TXNS, useWalletHome } from "../home/homeData";
import { useWalletNav } from "../useWalletNav";
import { DetailRow, ReferenceRow, formatTxDate } from "../withdrawals/TxDetail";

/**
 * WGT-12 in the wallet: the demo user's Checkout payments in Activity (txRow, tTxDetail) and disputes (tDispute and
 * its "Raise a dispute" entry, from reference/poket-unified.html). A payment to a store can be disputed for
 * DISPUTE_DAYS (the 60-day window from Checkout's Poket account, reference/poket-widgets.html); deposits, top-ups,
 * refunds, sends and conversions can't.
 */

/** What a dispute is about: a Checkout payment (on the account) or one of the wallet's demo payment records. */
export type DisputeTarget = { kind: "checkout" | "demo"; id: string };

/** Disputes on the wallet's own demo records (DEMO_TXNS payments), which aren't on the account. */
export const useDemoDisputes = create<{ open: Record<string, true>; add: (id: string) => void }>((set) => ({
  open: {},
  add: (id) => set((s) => ({ open: { ...s.open, [id]: true } })),
}));

/** A payment's amount as the wallet shows it: "$23.40 USD", "₦36,270.00 NGN". */
const amountText = (p: Payment) => fmtCurrency(p.amount, p.currency);

/** txRow(t) for a Checkout payment: the payment icon, the merchant, "Merchant payment · {merchant}" and the amount out. */
export function CheckoutPaymentRow({ p }: { p: Payment }) {
  const push = useWalletNav((s) => s.push);
  return (
    <div className="tx-row" data-txid={p.id} data-payment={p.id} role="button" tabIndex={0} onClick={() => push({ name: "payment", id: p.id })}>
      <div className="tx-ic out" dangerouslySetInnerHTML={{ __html: WICON.activity }} />
      <div className="tx-main"><div className="tx-title">{p.merchant}</div><div className="tx-sub">Merchant payment · {p.merchant}</div></div>
      <div className="tx-amt"><Grey>{"-" + amountText(p)}</Grey></div>
    </div>
  );
}

/** txRow(t) for a merchant's refund: in, "Refund · {merchant}", "Merchant refund · {merchant}", the amount back. */
export function RefundRow({ p, r }: { p: Payment; r: Refund }) {
  const push = useWalletNav((s) => s.push);
  return (
    <div className="tx-row" data-txid={r.id} data-refund={r.id} role="button" tabIndex={0} onClick={() => push({ name: "refund", id: r.id })}>
      <div className="tx-ic in" dangerouslySetInnerHTML={{ __html: WICON.activity }} />
      <div className="tx-main"><div className="tx-title">{refundTitle(p, r)}</div><div className="tx-sub">Merchant {r.kind === "reversal" ? "reversal" : "refund"} · {p.merchant}</div></div>
      <div className="tx-amt pos"><Grey>{"+" + fmtCurrency(r.amount, p.currency)}</Grey></div>
    </div>
  );
}

/** A refund's own receipt (tTxDetail): the amount back, where it went and when it arrives. */
export function RefundDetailScreen({ id }: { id: string }) {
  const back = useWalletNav((s) => s.back);
  // Select the list (a stable value), then find the refund: a selector returning a new object would loop
  const payments = useAccount((s) => s.account?.payments);
  const found = payments && allRefunds(payments).find((x) => x.r.id === id);
  if (!found) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  const { p, r } = found;
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg tx-ic-real" dangerouslySetInnerHTML={{ __html: p.currency === "NGN" ? WICON.ngFlag : WICON.usFlag }} />
      </div>
      <div className="step-title mono" id="refundAmount" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: "var(--ok-600)" }}><Grey>{fmtCurrency(r.amount, p.currency)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{refundTitle(p, r)}</p>
      <div className="info-card" id="txDetail">
        <DetailRow label="Status" value="Completed" />
        <DetailRow label="Date" value={formatTxDate(new Date(r.at).getTime())} />
        <DetailRow label="Currency" value={p.currency} />
        <DetailRow label="Merchant" value={p.merchant} />
        <DetailRow label={r.kind === "reversal" ? "Reversed to" : "Refunded to"} value={refundDest(p, r)} />
        <DetailRow label="Context" value="Checkout" />
        <ReferenceRow refText={r.id} />
      </div>
      <div className="alert info" id="refundNote" role="note" style={{ marginTop: "14px", marginBottom: 0 }}><Raw html={WICON.info} /><span>{refundNote(p, r)}</span></div>
    </>
  );
}

/** The detail's dispute row (extChip('Open · under review','err')). */
export function DisputeRow() {
  return (
    <div className="info-row" data-disputerow="">
      <span>Dispute</span>
      <span><span id="disputeChip" style={{ display: "inline-flex", alignItems: "center", fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", whiteSpace: "nowrap", background: "var(--err-50)", color: "var(--err-600)" }}>Open · under review</span></span>
    </div>
  );
}

/**
 * extRaiseDispute, with Checkout's 60-day window: "You can raise a dispute for N more days." while it's open; after,
 * the reference's note that disputes can be raised up to 60 days after payment.
 */
export function RaiseDispute({ at, merchant, target }: { at: number; merchant: string; target: DisputeTarget }) {
  const push = useWalletNav((s) => s.push);
  const w = disputeWindow(at);
  if (!w.open) return (
    <div className="alert info" id="disputeClosed" role="note" style={{ marginTop: "14px", marginBottom: 0 }}>
      <Raw html={WICON.info} /><span>Disputes can be raised up to {DISPUTE_DAYS} days after payment. This payment was {w.age} days ago, so contact {merchant} directly or reach Poket support.</span>
    </div>
  );
  return (
    <>
      <button className="btn-secondary" id="extRaiseDispute" style={{ width: "100%", marginTop: "14px" }} onClick={() => push({ name: "dispute", target })}>Raise a dispute</button>
      <p className="step-sub" id="disputeWindow" style={{ textAlign: "center", fontSize: "12px", margin: "8px 0 0" }}>You can raise a dispute for {w.left} more day{w.left === 1 ? "" : "s"}.</p>
    </>
  );
}

/** tTxDetail for a Checkout payment: the currency's flag, the amount, the merchant, Currency / Merchant / Context. */
export function PaymentDetailScreen({ id }: { id: string }) {
  const back = useWalletNav((s) => s.back);
  const p = useAccount((s) => s.account?.payments.find((x) => x.id === id));
  if (!p) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  const at = new Date(p.at).getTime();
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg tx-ic-real" dangerouslySetInnerHTML={{ __html: p.currency === "NGN" ? WICON.ngFlag : WICON.usFlag }} />
      </div>
      <div className="step-title mono" id="paymentAmount" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: "var(--n-900)" }}><Grey>{amountText(p)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{p.merchant}</p>
      <div className="info-card" id="txDetail">
        <DetailRow label="Status" value={paymentStatus(p).label} />
        <DetailRow label="Date" value={formatTxDate(at)} />
        <DetailRow label="Currency" value={p.currency} />
        {refundedTotal(p) > 0 && <DetailRow label="Refunded" value={fmtCurrency(refundedTotal(p), p.currency)} />}
        {reversedTotal(p) > 0 && <DetailRow label="Reversed" value={fmtCurrency(reversedTotal(p), p.currency)} />}
        <DetailRow label="Merchant" value={p.merchant} />
        <DetailRow label="Context" value="Checkout" />
        <ReferenceRow refText={p.id} />
        {p.status === "disputed" && <DisputeRow />}
      </div>
      {/* WGT-12: an open dispute holds what's left of the payment; a released one says why */}
      {p.status === "disputed" && <div className="alert warn" id="disputeHeld" role="note" style={{ marginTop: "14px", marginBottom: 0 }}><Raw html={WICON.alert} /><span>{fmtCurrency(refundLeft(p), p.currency)} held while we review.</span></div>}
      {p.dispute?.outcome === "release" && <div className="alert info" id="disputeReleased" role="note" style={{ marginTop: "14px", marginBottom: 0 }}><Raw html={WICON.info} /><span>{releaseNote(p.merchant)}</span></div>}
      {canRaiseDispute(p) && <RaiseDispute at={at} merchant={p.merchant} target={{ kind: "checkout", id: p.id }} />}
    </>
  );
}

/** What the dispute screens need about the payment. */
function useDisputeTx(target: DisputeTarget) {
  const p = useAccount((s) => (target.kind === "checkout" ? s.account?.payments.find((x) => x.id === target.id) : undefined));
  if (target.kind === "checkout") return p ? { merchant: p.merchant, amount: amountText(p), at: new Date(p.at).getTime(), sub: false } : null;
  const t = DEMO_TXNS.find((x) => x.id === target.id);
  return t ? { merchant: t.details.find(([k]) => k === "Merchant")?.[1] ?? t.title, amount: fmtCurrency(t.amount, "USD"), at: t.ts, sub: false } : null;
}

/** extWarnBox(title, body, tone). */
function WarnBox({ title, body, tone }: { title: string; body: string; tone?: "err" }) {
  return (
    <div className="ext-warn" style={{ display: "flex", gap: "10px", padding: "12px 14px", borderRadius: "var(--r-lg)", margin: "4px 0",
      ...(tone === "err" ? { background: "var(--err-50)", border: "1px solid rgba(236,34,31,.2)" } : { background: "var(--warn-50)", border: "1px solid var(--warn-200)" }) }}>
      <span style={{ flex: "none", color: tone === "err" ? "var(--err-600)" : "var(--warn-600)" }}><Raw html={WICON.alert} /></span>
      <span style={{ fontSize: "12.5px", lineHeight: 1.5, color: "var(--n-800)" }}><b>{title}</b><br />{body}</span>
    </div>
  );
}

/** tDispute: start (what happens, what to have ready), the form (only the reason is required), submitting, done. */
export function DisputeScreen({ target }: { target: DisputeTarget }) {
  const nav = useWalletNav();
  const t = useDisputeTx(target);
  const email = useAccount((s) => s.account?.email) || "ada@osun.co";
  const [stage, setStage] = useState<"start" | "form" | "review" | "submitting" | "done">("start");
  const [d, setD] = useState<DisputeForm>(NEW_DISPUTE);
  const [dateTouched, setDateTouched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!t) return <BackRow id="disputeBack" onClick={nav.back} />;
  const merchant = t.merchant;
  const patch = (p: Partial<DisputeForm>) => setD((x) => ({ ...x, ...p }));
  const backRow = (onClick: () => void) => <BackRow id="disputeBack" onClick={onClick} />;
  const row = (ic: string, title: string, sub: string) => (
    <div className="settings-row" style={{ cursor: "default" }}><span className="settings-row-ic"><Raw html={ic} /></span>
      <div className="settings-row-text"><div className="settings-row-title">{title}</div><div className="settings-row-sub">{sub}</div></div></div>
  );

  if (stage === "start") {
    if (disputeStrikes() >= DISPUTE_STRIKE_LIMIT) return (
      <>
        {backRow(nav.back)}
        <div className="step-title">You can&apos;t raise a dispute right now</div>
        <p className="step-sub">Your account has been restricted from raising further disputes after repeated dispute activity that violated our terms of use.</p>
        <WarnBox title="Account restricted" body="Contact support if you think this is a mistake." tone="err" />
      </>
    );
    return (
      <>
        {backRow(nav.back)}
        <div className="step-title">Dispute this payment?</div>
        <div className="info-card" style={{ margin: "6px 0 12px" }}>
          <div className="info-row"><span>{merchant}</span><span className="mono" style={{ fontWeight: 600 }}>{t.amount}</span></div>
          <div className="info-row"><span>Date</span><span className="mono">{fmtLong(t.at)}</span></div>
        </div>
        <div className="settings-list" style={{ marginBottom: "12px" }}>
          {row(WICON.calendar, "Up to 14 days to resolve", `We review it with ${merchant} and update you by email.`)}
          {row(WICON.card, "Refunds go to your balance", "If it’s resolved in your favor. It may not be.")}
        </div>
        <WarnBox title="False claims can close your account" body="Fraudulent disputes break our terms of use." />
        <button className="btn-primary" id="disputeStart" style={{ marginTop: "14px" }} onClick={() => setStage("form")}>Start dispute</button>
        <p style={{ fontSize: "12px", color: "var(--txt2)", textAlign: "center", margin: "10px 0 0" }}>Tip: have your receipt and any messages with the merchant ready.</p>
      </>
    );
  }

  if (stage === "form") {
    const problem = d.contacted && d.date ? dateProblem(d.date, t.at) : null;
    const showBad = !!problem && (dateTouched ? maskDate(d.date).complete : true);
    const reasons = DISPUTE_REASONS;
    const n = addedCount(d);
    return (
      <div className="ud-form">
        {backRow(() => setStage("start"))}
        <div className="step-title">Tell us what happened</div>
        <p className="step-sub">About your {t.amount} payment to {merchant}.</p>
        <label className="field-label">Why are you disputing it?</label>
        <div className={`ud-chips ${reasons.length % 2 ? "odd" : ""}`} role="radiogroup" aria-label="Reason">
          {reasons.map((r) => (
            <button key={r} type="button" className={`ud-chip ${d.reason === r ? "on" : ""}`} role="radio" aria-checked={d.reason === r} data-dreason={r} title={r} onClick={() => patch({ reason: r })}>{REASON_SHORT[r]}</button>
          ))}
        </div>
        {d.reason === NOT_MINE_REASON && (
          <div className="info-card" style={{ fontSize: "12.5px", lineHeight: 1.5, margin: "0 0 12px" }}>If you don&rsquo;t recognise this payment, also lock your card in the Card tab and contact Poket support so we can secure your account.</div>
        )}
        {/* WGT-12: a short description, required (NEW copy) */}
        <label className="field-label" htmlFor="extDisputeDescription">Describe what happened</label>
        <textarea className="field-input" id="extDisputeDescription" rows={3} maxLength={DESCRIPTION_MAX} placeholder="A sentence or two is enough." value={d.description}
          style={{ height: "auto", resize: "vertical", fontFamily: "inherit", fontSize: "13.5px" }} onChange={(e) => patch({ description: e.target.value })} />
        <p id="extDisputeDescriptionCount" style={{ fontSize: "11.5px", margin: "4px 0 10px", color: "var(--txt3)", textAlign: "right" }}>{d.description.length}/{DESCRIPTION_MAX}</p>
        <button type="button" className={`ud-more ${d.more ? "open" : ""}`} id="extDisputeMore" aria-expanded={d.more} onClick={() => patch({ more: !d.more })}>
          Add more detail <span className="o">{!d.more && n ? `${n} added` : "Optional"}</span>
          <span className="c"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        </button>
        {d.more && (
          <>
            <div className="select-row" style={{ cursor: "default", marginTop: "6px" }}>
              <div className="meta"><div className="t1">I&rsquo;ve contacted {merchant}</div></div>
              <button type="button" id="extDisputeContacted" role="switch" aria-checked={d.contacted} aria-label={`I’ve contacted ${merchant}`} onClick={() => patch({ contacted: !d.contacted })}
                style={{ position: "relative", width: "40px", height: "24px", border: 0, padding: 0, borderRadius: "999px", background: d.contacted ? "var(--brand-500)" : "var(--n-300)", flex: "none", cursor: "pointer", transition: "background .15s ease" }}>
                <span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transform: `translateX(${d.contacted ? 16 : 0}px)`, transition: "transform .15s ease" }} />
              </button>
            </div>
            {d.contacted && (
              <>
                <label className="field-label" htmlFor="extDisputeDate">When did you last contact them?</label>
                <input className="field-input mono" id="extDisputeDate" placeholder="MM / DD / YYYY" inputMode="numeric" maxLength={14} value={d.date} aria-describedby="extDisputeDateMsg"
                  aria-invalid={showBad} style={showBad ? { borderColor: "var(--err-600)" } : undefined}
                  onChange={(e) => { setDateTouched(true); patch({ date: maskDate(e.target.value).shown }); }} />
                <p id="extDisputeDateMsg" style={{ fontSize: "11.5px", margin: "6px 0 12px", color: showBad ? "var(--err-600)" : "var(--txt3)" }}>
                  {showBad ? problem : `Between ${fmtLong(t.at)} (when you paid) and today.`}
                </p>
              </>
            )}
            <label className="field-label" style={{ marginBottom: "2px" }}>Evidence{d.reason ? ` of ${EVIDENCE_LABEL[d.reason] ?? "this issue"}` : ""}</label>
            <p style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--txt2)", margin: "0 0 8px" }}>Attach any of these: messages with {merchant}, your receipt or order confirmation, the product listing or photos.</p>
            <div className={`select-row ${d.evidence ? "sel" : ""}`} id="extAttach" role="button" tabIndex={0} onClick={() => patch({ evidence: !d.evidence })}>
              <span className="settings-row-ic" style={{ width: "30px", height: "30px" }}><Raw html={WICON.copy} /></span>
              <div className="meta"><div className="t1">{d.evidence ? "evidence.pdf attached" : "Attach a file"}</div><div className="t2">{d.evidence ? "Tap to remove" : "PDF or image"}</div></div>
            </div>
          </>
        )}
        {d.editContact && <input className="field-input" id="extDisputeEmail" type="email" value={d.contact || email} aria-label="Email for updates" style={{ marginTop: "12px" }} onChange={(e) => patch({ contact: e.target.value.trim() })} />}
        <div className="ud-foot">
          <p style={{ fontSize: "12.5px", color: "var(--txt2)", margin: "0 0 10px" }}>We&rsquo;ll email updates to <b id="disputeEmail">{d.contact || email}</b> · <button className="btn-ghost" id="extDisputeChange" style={{ fontSize: "12.5px" }} onClick={() => patch({ editContact: !d.editContact })}>{d.editContact ? "Done" : "Change"}</button></p>
          <button className="btn-primary" id="extReviewDispute" disabled={!d.reason || !d.description.trim() || (!!d.date && d.contacted && !!problem)} onClick={() => setStage("review")}>{formButton(d)}</button>
        </div>
      </div>
    );
  }

  if (stage === "review") {
    // WGT-12: review, then submit (NEW screen, in the wallet's info-card rows)
    const submit = () => {
      setStage("submitting");
      timer.current = setTimeout(() => {
        if (target.kind === "checkout") openDispute(target.id, d.reason!, d.description, "wallet");
        else { useDemoDisputes.getState().add(target.id); countDisputeStrike(); }
        setStage("done");
      }, 1300);
    };
    const line = (k: string, v: string, id?: string) => <div className="info-row"><span>{k}</span><span id={id} style={{ maxWidth: "200px", textAlign: "right", wordBreak: "break-word" }}>{v}</span></div>;
    return (
      <>
        {backRow(() => setStage("form"))}
        <div className="step-title">Review your dispute</div>
        <p className="step-sub">About your {t.amount} payment to {merchant}.</p>
        <div className="info-card" id="disputeReview">
          {line("Reason", REASON_SHORT[d.reason!], "reviewReason")}
          {line("What happened", d.description.trim(), "reviewDescription")}
          {line(`Contacted ${merchant}`, d.contacted && d.date ? d.date.replace(/ /g, "") : "No")}
          {line("Evidence", d.evidence ? "evidence.pdf" : "None")}
          {line("Updates to", d.contact || email)}
        </div>
        <button className="btn-primary" id="extSubmitDispute" style={{ marginTop: "14px" }} onClick={submit}>Submit dispute</button>
      </>
    );
  }

  if (stage === "submitting") return (
    <div className="center-col" style={{ paddingTop: "50px" }}>
      <div className="sending-dots"><span /><span /><span /></div>
      <div className="step-title" style={{ marginTop: "18px" }}>Submitting dispute&hellip;</div>
      <p className="step-sub">Sending your details for review.</p>
    </div>
  );
  return (
    <>
      <div className="center-col" style={{ paddingTop: "30px" }} id="disputeDone">
        <div className="check-circle"><Raw html={CHECK_DRAW} /></div>
        <div className="step-title">Dispute submitted</div>
        <p className="step-sub">If resolved in your favor, funds return to your balance.</p>
      </div>
      <button className="btn-primary" id="extDisputeDone" style={{ marginTop: "18px" }} onClick={() => { nav.home(); useWalletHome.getState().set({ tab: "activity" }); }}>Back to activity</button>
    </>
  );
}
