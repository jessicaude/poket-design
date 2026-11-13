"use client";
import { useEffect, useRef, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { ACCT_ICON, ALERT_ICON, AV_COLORS, BANK_MINI, BRANDS, CHECK_DRAW, ICON, MERCHANT_LOGO } from "@/lib/icons";
import {
  DISPUTE_DAYS, DISPUTE_REASONS, DISPUTE_STRIKE_LIMIT, EVIDENCE_LABEL, NEW_DISPUTE, NOT_MINE_REASON, REASON_SHORT, SUBSCRIPTION_REASON,
  addedCount, dateProblem, disputeStrikes, disputeWindow, fmtLong, maskDate, openDispute, type DisputeForm,
} from "@/lib/disputes";
import { formatOrder } from "@/lib/money";
import { useAccount, type Payment, type Refund } from "@/store/account";
import { allRefunds, isFullyRefunded, paymentStatus, refundDest, refundNote, refundedTotal } from "@/lib/refunds";
import { useCheckout } from "../useCheckout";
import { MoneyU } from "./PayScreen";

/**
 * WGT-12: Checkout's Poket account (reference/poket-widgets.html, "POKET ACCOUNT (Checkout)"): the Activity tab,
 * a payment's detail (pay-detail, with the 60-day dispute window) and the dispute flow (SCREENS['dispute']). Home
 * and Methods aren't ported: their tabs say so. Messages aren't ported either.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const hashOf = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

/** storeLogo(name, size): the merchant's logo, else its initials on a colour from its name. */
function storeLogo(name: string, s = 32) {
  const logo = MERCHANT_LOGO[name];
  if (logo) return `<svg class="logo" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true">${logo}</svg>`;
  const ini = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  return `<span class="logo logo-ini" style="width:${s}px;height:${s}px;border-radius:${Math.round(s / 4)}px;background:${AV_COLORS[hashOf(name) % AV_COLORS.length]};font-size:${Math.max(10, Math.round(s * 0.38))}px" aria-hidden="true">${esc(ini)}</span>`;
}
/** fmtDate: "Nov 12, 3:04 PM" within a day, else "Nov 12" (with the year when it isn't this year's). */
function fmtDate(iso: string) {
  const d = new Date(iso), n = Math.floor((Date.now() - d.getTime()) / 86400000), sameYr = d.getFullYear() === new Date().getFullYear();
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYr ? undefined : "numeric" });
  return n <= 1 ? `${day}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : day;
}
/** dayGroup: "November" (with the year when it isn't this year's). */
const dayGroup = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString("en-US", { month: "long", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); };
/** receiptDate: "12 Nov, 2026, 3:04 PM - <em>UTC</em>". */
function receiptDate(iso: string) {
  const d = new Date(iso), M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let h = d.getUTCHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]}, ${d.getUTCFullYear()}, ${h}:${String(d.getUTCMinutes()).padStart(2, "0")} ${ap} - <em>UTC</em>`;
}
/** descriptor: "POKET* ILE LIVING". */
const descriptor = (merchant: string) => "POKET* " + merchant.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 16);
/** pmMini(brand): the card brand's mini mark, or the bank's. */
const pmMini = (p: Payment) => (p.methodKind === "bank" ? BANK_MINI : p.brand ? BRANDS[p.brand].mini : "");
const amount = (p: Payment) => formatOrder(p.amount, p.currency);

/** The account's tab bar (walletChrome): Home, Activity, Methods; only Activity is ported. */
export function AccountTabbar() {
  const showToast = useCheckout((s) => s.showToast);
  const tabs: [string, string, string, (() => void) | null][] = [
    ["home", "Home", ACCT_ICON.tabHome, () => showToast("Home isn’t ported yet")],
    ["activity", "Activity", ACCT_ICON.tabActivity, () => useCheckout.getState().openAccount()],
    ["methods", "Methods", ACCT_ICON.tabMethods, () => showToast("Methods isn’t ported yet")],
  ];
  return (
    <nav className="tabbar" id="tabbar" aria-label="Poket">
      {tabs.map(([k, l, ic, run]) => (
        <button key={k} type="button" className={`tab ${k === "activity" ? "on" : ""}`} data-tab={k} aria-current={k === "activity" ? "page" : undefined} onClick={() => run?.()}>
          <Raw html={ic} /><span>{l}</span>
        </button>
      ))}
      <span className="tab-ind" style={{ transform: "translateX(100%)" }} />
    </nav>
  );
}

/** payRow(x): the merchant's logo (or the dispute mark), the merchant, date · method (· Dispute open), the amount. */
function PayRow({ p, i }: { p: Payment; i: number }) {
  const viewPayment = useCheckout((s) => s.viewPayment);
  const disp = p.status === "disputed";
  return (
    <button type="button" className="tx-row stg" style={{ ["--i" as string]: i }} data-pay={p.id} onClick={() => viewPayment(p.id, "activity")}>
      {disp ? <span className="tx-ic disp" title="Dispute open"><Raw html={ACCT_ICON.disputeTx} /></span> : <span className="tx-ic logo-ic" aria-hidden="true"><Raw html={storeLogo(p.merchant)} /></span>}
      <span className="tx-main"><span className="tx-title">{p.merchant}</span><span className="tx-sub">{fmtDate(p.at)} · {p.method}{disp ? " · Dispute open" : ""}</span></span>
      <span className="tx-amt">-{amount(p)}</span>
    </button>
  );
}

/** refundRow(x): the refund mark, "Refund · {merchant}", date · To {where it went}, the amount back. */
function RefundRowC({ p, r, i }: { p: Payment; r: Refund; i: number }) {
  const view = useCheckout((s) => s.viewRefundDetail);
  return (
    <button type="button" className="tx-row stg" style={{ ["--i" as string]: i }} data-refund={r.id} onClick={() => view(r.id)}>
      <span className="tx-ic in"><Raw html={ACCT_ICON.refund} /></span>
      <span className="tx-main"><span className="tx-title">Refund · {p.merchant}</span><span className="tx-sub">{fmtDate(r.at)} · To {refundDest(p, r)}</span></span>
      <span className="tx-amt pos">+{formatOrder(r.amount, p.currency)}</span>
    </button>
  );
}

/** SCREENS['activity']: payments and refunds as one list, newest first, grouped by month. */
export function AccountActivityScreen() {
  const list = useAccount((s) => s.account?.payments) ?? [];
  const sorted = [
    ...list.map((p) => ({ at: p.at, key: p.id, el: (i: number) => <PayRow p={p} i={i} /> })),
    ...allRefunds(list).map(({ p, r }) => ({ at: r.at, key: r.id, el: (i: number) => <RefundRowC p={p} r={r} i={i} /> })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  let last: string | null = null, i = 0;
  return (
    <>
      <h2 className="title">Activity</h2>
      {sorted.length ? (
        <div className="tx-list">
          {sorted.map((x) => {
            const g = dayGroup(x.at), head = g !== last;
            last = g;
            return (
              <div key={x.key} style={{ display: "contents" }}>
                {head && <div className="tx-group stg" style={{ ["--i" as string]: i++ }}>{g}</div>}
                {x.el(i++)}
              </div>
            );
          })}
        </div>
      ) : <p className="sub">No payments yet.</p>}
    </>
  );
}

/** SCREENS['pay-detail']: the receipt, then the dispute entry while the 60-day window is open. */
export function PayDetailScreen() {
  const { viewPay, navFrom, go, showToast } = useCheckout();
  const p = useAccount((s) => s.account?.payments.find((x) => x.id === viewPay));
  if (!p) return <h2 className="title">Payment not found</h2>;
  const w = disputeWindow(p.at), canDispute = p.status === "paid" && w.open && !isFullyRefunded(p);
  const st = paymentStatus(p), stat = [st.label, st.tone];
  const row = (ic: string, label: string, value: React.ReactNode, cls = "") => (
    <div className="receipt-row"><span className="r-ic"><Raw html={ic} /></span><span className="r-label">{label}</span><span className={`r-value ${cls}`}>{value}</span></div>
  );
  return (
    <>
      <button className="link nav-back" id="pdBack" onClick={() => go(navFrom === "done" ? "done" : "activity")}><Raw html={ICON.back} /> {navFrom === "done" ? "Back" : "Activity"}</button>
      <div className="tx-hero"><span className="tx-hero-logo"><Raw html={storeLogo(p.merchant, 48)} /></span><div className="tx-hero-amt" id="pdAmount"><MoneyU minor={p.amount} currency={p.currency} /></div><div className="tx-hero-sub">{p.merchant}</div></div>
      <div className="receipt-card" id="pdReceipt">
        {row(ACCT_ICON.check, "Status", <span id="pdStatus">{stat[0]}</span>, `st ${stat[1]}`)}
        {row(ACCT_ICON.cal, "Date", <Raw html={receiptDate(p.at)} />, "nowrap")}
        {row(ACCT_ICON.card, "Paid with", <><Raw html={pmMini(p)} />{p.method}</>, "pm")}
        {p.order && row(ACCT_ICON.bag, "Order", p.order, "mono")}
        {refundedTotal(p) > 0 && row(ACCT_ICON.check, "Refunded", <span id="pdRefunded">{formatOrder(refundedTotal(p), p.currency)} to {refundDest(p)}</span>)}
        {row(ACCT_ICON.card, "On your statement", descriptor(p.merchant))}
        {row(ACCT_ICON.hash, "Reference", <button type="button" className="ref-chip" id="pdCopy" onClick={() => { try { navigator.clipboard?.writeText(p.id).catch(() => {}); } catch { /* no clipboard */ } showToast("Reference copied"); }}>{p.id} <Raw html={ACCT_ICON.copy} /></button>)}
      </div>
      {p.status === "disputed" && <div className="infobox" id="pdDisputed">You raised a dispute. It can take up to 14 days to resolve; we&rsquo;ll email you with updates.</div>}
      {canDispute && (
        <>
          <button className="btn quiet" id="pdDispute" onClick={() => go("dispute")}>Raise a dispute</button>
          <p className="hint center" id="pdWindow" style={{ margin: "8px 0 0" }}>You can raise a dispute for {w.left} more day{w.left === 1 ? "" : "s"}.</p>
        </>
      )}
      {p.status === "paid" && !w.open && !isFullyRefunded(p) && <div className="infobox" id="pdClosed">Disputes can be raised up to {DISPUTE_DAYS} days after payment. This payment was {w.age} days ago, so contact {p.merchant} directly or reach Poket support.</div>}
      <button className="btn outline" id="pdContact" style={{ width: "100%", marginTop: "10px" }} onClick={() => showToast("Messages aren’t ported yet")}><Raw html={ACCT_ICON.msg} /> Message {p.merchant}</button>
    </>
  );
}

/** A refund's own receipt: the amount back, where it went, the payment it refunds, and when it arrives. */
export function RefundDetailScreen() {
  const { viewRefund, go, showToast } = useCheckout();
  // Select the list (a stable value), then find the refund: a selector returning a new object would loop
  const payments = useAccount((s) => s.account?.payments);
  const found = payments && allRefunds(payments).find((x) => x.r.id === viewRefund);
  if (!found) return <h2 className="title">Refund not found</h2>;
  const { p, r } = found;
  const row = (ic: string, label: string, value: React.ReactNode, cls = "") => (
    <div className="receipt-row"><span className="r-ic"><Raw html={ic} /></span><span className="r-label">{label}</span><span className={`r-value ${cls}`}>{value}</span></div>
  );
  return (
    <>
      <button className="link nav-back" id="rdBack" onClick={() => go("activity")}><Raw html={ICON.back} /> Activity</button>
      <div className="tx-hero"><span className="tx-hero-logo"><Raw html={storeLogo(p.merchant, 48)} /></span><div className="tx-hero-amt" id="rdAmount"><MoneyU minor={r.amount} currency={p.currency} /></div><div className="tx-hero-sub">Refund · {p.merchant}</div></div>
      <div className="receipt-card" id="rdReceipt">
        {row(ACCT_ICON.check, "Status", "Refunded", "st")}
        {row(ACCT_ICON.cal, "Date", <Raw html={receiptDate(r.at)} />, "nowrap")}
        {row(ACCT_ICON.card, "Refunded to", <>{r.to === "method" && <Raw html={pmMini(p)} />}{refundDest(p, r)}</>, "pm")}
        {p.order && row(ACCT_ICON.bag, "Order", p.order, "mono")}
        {row(ACCT_ICON.hash, "Reference", <button type="button" className="ref-chip" id="rdCopy" onClick={() => { try { navigator.clipboard?.writeText(r.id).catch(() => {}); } catch { /* no clipboard */ } showToast("Reference copied"); }}>{r.id} <Raw html={ACCT_ICON.copy} /></button>)}
      </div>
      <div className="infobox" id="rdNote">{refundNote(p, r)}</div>
    </>
  );
}

/** warnBox(title, body, tone). */
function WarnBox({ title, body, tone }: { title: string; body: string; tone?: "err" }) {
  return <div className={`warnbox ${tone === "err" ? "err" : ""}`}><span className="wb-ic"><Raw html={ALERT_ICON} /></span><span><b>{title}</b><br />{body}</span></div>;
}

/** SCREENS['dispute']: the same stages as the wallet's tDispute; a refund returns to the card or bank used. */
export function AccountDisputeScreen() {
  const { viewPay, go, showToast } = useCheckout();
  const p = useAccount((s) => s.account?.payments.find((x) => x.id === viewPay));
  const email = useAccount((s) => s.account?.email) ?? "";
  const [stage, setStage] = useState<"start" | "form" | "submitting" | "done">("start");
  const [d, setD] = useState<DisputeForm>(NEW_DISPUTE);
  const [dateTouched, setDateTouched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!p) return <h2 className="title">Payment not found</h2>;
  const patch = (x: Partial<DisputeForm>) => setD((y) => ({ ...y, ...x }));
  const back = (onClick: () => void) => <button className="link nav-back" id="dispBack" onClick={onClick}><Raw html={ICON.back} /> Back</button>;

  if (stage === "start") {
    if (disputeStrikes() >= DISPUTE_STRIKE_LIMIT) return (
      <>
        {back(() => go("pay-detail"))}
        <h2 className="title">You can&apos;t raise a dispute right now</h2>
        <p className="sub">Your account has been restricted from raising further disputes after repeated dispute activity that violated our terms of use.</p>
        <WarnBox title="Account restricted" body="Contact support if you think this is a mistake." tone="err" />
      </>
    );
    return (
      <>
        {back(() => go("pay-detail"))}
        <h2 className="title">Dispute this payment?</h2>
        <div className="disp-pay"><span className="tx-ic out"><Raw html={ACCT_ICON.pay} /></span><span className="tx-main"><span className="tx-title">{p.merchant}</span><span className="tx-sub">{fmtDate(p.at)} · {p.method}</span></span><span className="tx-amt">{amount(p)}</span></div>
        <div className="settings-list" style={{ marginBottom: "12px" }}>
          <div className="settings-row"><span className="settings-row-ic"><Raw html={ACCT_ICON.cal.replace(/14/g, "16")} /></span><div className="settings-row-text"><div className="settings-row-title">Up to 14 days to resolve</div><div className="settings-row-sub">We review it with {p.merchant} and update you by email.</div></div></div>
          <div className="settings-row"><span className="settings-row-ic"><Raw html={ACCT_ICON.card.replace(/14/g, "16")} /></span><div className="settings-row-text"><div className="settings-row-title">Refunds go to {p.method}</div><div className="settings-row-sub">If it&rsquo;s resolved in your favor. It may not be.</div></div></div>
        </div>
        <WarnBox title="False claims can close your account" body="Fraudulent disputes break our terms of use." />
        <button className="btn" id="dispStart" style={{ marginTop: "12px" }} onClick={() => setStage("form")}>Start dispute</button>
        <p className="disp-tip">Tip: have your receipt and any messages with the store ready.</p>
        <div className="center"><button className="btn ghost" id="dispContact" style={{ paddingTop: "14px" }} onClick={() => showToast("Messages aren’t ported yet")}>Message {p.merchant} first</button></div>
      </>
    );
  }

  if (stage === "form") {
    const problem = d.contacted && d.date ? dateProblem(d.date, p.at) : null;
    const showBad = !!problem && (dateTouched ? maskDate(d.date).complete : true);
    const reasons = DISPUTE_REASONS.filter((r) => r !== SUBSCRIPTION_REASON);
    const n = addedCount(d);
    const submit = () => {
      setStage("submitting");
      timer.current = setTimeout(() => { openDispute(p.id, d.reason!, "checkout"); setStage("done"); }, 1300);
    };
    return (
      <div className="disp-form">
        {back(() => setStage("start"))}
        <h2 className="title">Tell us what happened</h2>
        <label className="lbl">Why are you disputing it?</label>
        <div className={`chips ${reasons.length % 2 ? "odd" : ""}`} role="radiogroup" aria-label="Reason">
          {reasons.map((r) => <button key={r} type="button" className={`chip-opt ${d.reason === r ? "on" : ""}`} role="radio" aria-checked={d.reason === r} data-dreason={r} title={r} onClick={() => patch({ reason: r })}>{REASON_SHORT[r]}</button>)}
        </div>
        {d.reason === NOT_MINE_REASON && <div className="infobox">If you don&rsquo;t recognise this payment, also remove the card from Methods and contact Poket support so we can secure your account.</div>}
        <button type="button" className="more-toggle" id="dispMore" aria-expanded={d.more} onClick={() => patch({ more: !d.more })}>
          Add more detail <span className="opt">{!d.more && n ? `${n} added` : "Optional"}</span><span className={`chev ${d.more ? "up" : ""}`}><Raw html={ACCT_ICON.chev} /></span>
        </button>
        {d.more && (
          <div className="more-body">
            <div className="toggle-row"><span className="m1">I&rsquo;ve contacted {p.merchant}</span>
              <button type="button" className={`toggle ${d.contacted ? "on" : ""}`} id="dispContacted" role="switch" aria-checked={d.contacted} aria-label={`I’ve contacted ${p.merchant}`} onClick={() => patch({ contacted: !d.contacted })} /></div>
            {d.contacted && (
              <>
                <label className="lbl" htmlFor="dispDate">When did you last contact them?</label>
                <input className={`field mono ${showBad ? "bad" : ""}`} id="dispDate" placeholder="MM / DD / YYYY" inputMode="numeric" maxLength={14} value={d.date} aria-describedby="dispDateMsg" aria-invalid={showBad}
                  onChange={(e) => { setDateTouched(true); patch({ date: maskDate(e.target.value).shown }); }} />
                <p className={`hint ${showBad ? "bad" : ""}`} id="dispDateMsg">{showBad ? problem : dateTouched ? `Between ${fmtLong(p.at)} (when you paid) and today.` : ""}</p>
              </>
            )}
            <label className="lbl" style={{ marginBottom: "2px" }}>Evidence{d.reason ? ` of ${EVIDENCE_LABEL[d.reason] ?? "the issue"}` : ""}</label>
            <p className="ev-help">Attach any of these: messages with {p.merchant}, your receipt or order confirmation, the product listing or photos.</p>
            <div className={`method ${d.evidence ? "sel" : ""}`} id="dispAttach" role="button" tabIndex={0} style={{ marginBottom: "14px" }} onClick={() => patch({ evidence: !d.evidence })}>
              <span className="settings-row-ic" style={{ width: "30px", height: "30px" }}><Raw html={ACCT_ICON.copy} /></span>
              <span className="m1">{d.evidence ? "evidence.pdf attached" : "Attach a file"}<small>{d.evidence ? "Tap to remove" : "PDF or image"}</small></span>
            </div>
            <label className="lbl" htmlFor="dispDetails">Anything else?</label>
            <textarea className="field" id="dispDetails" rows={3} style={{ height: "auto" }} value={d.details} onChange={(e) => patch({ details: e.target.value })} />
          </div>
        )}
        {d.editContact && <input className="field" id="dispEmail" type="email" value={d.contact || email} placeholder="you@example.com" aria-label="Email for updates" style={{ marginTop: "12px" }} onChange={(e) => patch({ contact: e.target.value.trim() })} />}
        <div className="disp-foot">
          <p className="contact-line">We&rsquo;ll email updates to <b>{d.contact || email}</b> · <button className="link" id="dispChange" onClick={() => patch({ editContact: !d.editContact })}>{d.editContact ? "Done" : "Change"}</button></p>
          <button className="btn" id="dispSubmit" disabled={!d.reason || (d.contacted && !!d.date && !!problem)} onClick={submit}>{d.reason ? "Submit dispute" : "Choose a reason to continue"}</button>
        </div>
      </div>
    );
  }

  if (stage === "submitting") return <div className="center" style={{ paddingTop: "50px" }}><div className="sending-dots"><span /><span /><span /></div><h2 className="title" style={{ marginTop: "18px" }}>Submitting dispute…</h2></div>;
  return (
    <>
      <div className="center" style={{ paddingTop: "30px" }} id="dispDoneScreen"><div className="badge ok"><Raw html={CHECK_DRAW} /></div>
        <h2 className="title">Dispute submitted</h2>
        <p className="sub">If resolved in your favor, the money returns to {p.method}.</p></div>
      <button className="btn" id="dispDone" style={{ marginTop: "18px" }} onClick={() => go("activity")}>Back to activity</button>
    </>
  );
}
