"use client";
/* eslint-disable @next/next/no-img-element -- the vendor logos are inline data URIs, as in the prototype */
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { CHECK_DRAW, ICON, IDCARD_ICON, WICON } from "@/lib/icons";
import { VENDOR_LOGOS } from "@/lib/vendor-logos";
import { useAccount } from "@/store/account";
import { GEO_COUNTRY, ID_COUNTRIES, ID_MAX_TRIES, ID_RETRY_REASONS, ageFrom, ssnOk, useCheckout } from "../useCheckout";

/** Tier 1 identity, once. Ported from SCREENS['details'], ['vendor'], ['verifying'], ['id-done'] and ['blocked'] in
 * reference/poket-widgets.html. Manual review and retry use the reference's wallet engine copy (tVfSlow, tVfRetry). */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7"/></svg>';
/** kemi.adeyemi@gmail.com -> k••••i@gmail.com */
const maskEmail = (v: string) => { const [u, d] = v.split("@"); return u.length <= 2 ? `${u[0]}••••@${d}` : `${u[0]}••••${u[u.length - 1]}@${d}`; };

/** SCREENS['details']: country, prefilled legal name, date of birth; US residents add an SSN. */
export function DetailsScreen() {
  const { idv, setIdv, submitDetails, finishLater } = useCheckout();
  const account = useAccount((s) => s.account);
  const [country, setCountry] = useState(account?.country ?? GEO_COUNTRY);
  const [first, setFirst] = useState(account?.first ?? "");
  const [last, setLast] = useState(account?.last ?? "");
  const [showSsn, setShowSsn] = useState(false);
  if (!account) return null;
  const d = idv.det;
  const setDet = (patch: Partial<typeof d>) => setIdv({ det: { ...d, ...patch } });
  const us = country === "United States" && !idv.noSsn;
  const age = ageFrom(d.d, d.m, d.y);
  const ok = !!first.trim() && !!last.trim() && age !== null && (!us || ssnOk(d.ssn));
  const fmtSsn = (v: string) => { const x = v.replace(/\D/g, "").slice(0, 9); return x.length > 5 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x.length > 3 ? `${x.slice(0, 3)}-${x.slice(3)}` : x; };
  return (
    <>
      <h2 className="title">Verify your identity</h2>
      <label className="lbl" htmlFor="dCountry">Country</label>
      <select className="field" id="dCountry" value={country} onChange={(e) => { setCountry(e.target.value); setIdv({ noSsn: false }); }}>
        {ID_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <div className="row c2">
        <div><label className="lbl" htmlFor="dFirst">Legal first name</label><input className="field" id="dFirst" value={first} onChange={(e) => setFirst(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="dLast">Legal last name</label><input className="field" id="dLast" value={last} onChange={(e) => setLast(e.target.value)} /></div>
      </div>
      <label className="lbl">Date of birth</label>
      <div className="row c3">
        <input className="field" id="dD" inputMode="numeric" maxLength={2} placeholder="DD" aria-label="Day" value={d.d} onChange={(e) => setDet({ d: e.target.value })} />
        {/* The prototype's picker shows an empty choice grey (.field.pick .ph); native select here */}
        <select className="field" id="dM" aria-label="Month" value={d.m} style={d.m ? undefined : { color: "#9ba3b5" }} onChange={(e) => setDet({ m: e.target.value })}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
        </select>
        <input className="field" id="dY" inputMode="numeric" maxLength={4} placeholder="YYYY" aria-label="Year" value={d.y} onChange={(e) => setDet({ y: e.target.value })} />
      </div>
      {us && (
        <>
          <label className="lbl" htmlFor="dSsn">Social Security number</label>
          <div className="id-field">
            <span className="id-ic"><Raw html={LOCK} /></span>
            <input className="mono" id="dSsn" inputMode="numeric" maxLength={11} placeholder="000-00-0000" type={showSsn ? "text" : "password"} autoComplete="off"
              value={d.ssn} onChange={(e) => setDet({ ssn: fmtSsn(e.target.value) })} />
            <button type="button" className="id-switch" id="dSsnShow" aria-controls="dSsn" onClick={() => setShowSsn(!showSsn)}>{showSsn ? "Hide" : "Show"}</button>
          </div>
        </>
      )}
      {country === "United States" && (
        <p className="hint"><button className="link" id="dNoSsn" onClick={() => setIdv({ noSsn: !idv.noSsn })}>{idv.noSsn ? "Use my SSN instead" : "I don’t have an SSN"}</button></p>
      )}
      <button className="btn" id="dGo" disabled={!ok} onClick={() => submitDetails({ first: first.trim(), last: last.trim(), country, age: age ?? 0 })}>
        {us ? "Continue to selfie check" : "Continue to ID check"}
      </button>
      <div className="center"><button className="btn ghost" id="dLater" onClick={() => finishLater("canceled")}>Finish later</button></div>
    </>
  );
}

/** qr(): the reference's seeded QR pattern (decorative). */
function qrSvg() {
  let r = "", s = 11;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const n = 21, c = 6;
  const fin = (x: number, y: number) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}"/>`;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const f = (i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9); if (!f && rnd() < 0.46) r += `<rect x="${i * c}" y="${j * c}" width="${c}" height="${c}"/>`; }
  return `<svg class="qr" viewBox="0 0 ${n * c} ${n * c}" role="img" aria-label="QR code" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${r}${fin(0, 0)}${fin(n - 7, 0)}${fin(0, n - 7)}</g></svg>`;
}
const QR = qrSvg();

/** SCREENS['vendor']: the ID and selfie handoff (Veriff, or Plaid for a US SSN). Demo bar: Open on phone, Finish on phone. */
export function VendorScreen() {
  const idv = useCheckout((s) => s.idv);
  return <VendorHandoff plaid={idv.vendor === "plaid"} phone={idv.vstage === "phone"} />;
}

/**
 * The vendor handoff itself (SCREENS['vendor']'s markup), shared with the wallet's selfie check: Plaid's selfie or
 * Veriff's ID and selfie, the QR code, then "Continue on your phone".
 */
export function VendorHandoff({ plaid, phone }: { plaid: boolean; phone: boolean }) {
  const brand = <div className={`vlogo ${plaid ? "plaid" : ""}`}><img src={plaid ? VENDOR_LOGOS.plaid : VENDOR_LOGOS.veriff} alt={plaid ? "Plaid" : "Veriff"} /></div>;
  if (phone) {
    return (
      <div className="vendor">{brand}<h2 className="vt">Continue on your phone</h2>
        <div className="wait"><div className="spinner" />{plaid ? "Take a short selfie video on your phone." : "Take a photo of your ID and a short selfie on your phone."} Keep this window open.</div>
      </div>
    );
  }
  return (
    <div className="vendor">{brand}<h2 className="vt">{plaid ? "Let’s confirm it’s you" : "Let’s get you verified"}</h2>
      <div className="prep"><b>{plaid ? "Take a quick selfie" : "Prepare a valid document"}</b>{plaid ? "We’ll match it to the details you entered." : "Make sure it’s not expired or damaged."}</div>
      <div className="opt"><b>Scan the QR code</b>Use your phone&rsquo;s camera app.<Raw html={QR} /></div>
    </div>
  );
}

/** SCREENS['verifying'] */
export function VerifyingScreen() {
  return <div className="center"><div className="spinner" /><h2 className="title">Checking your ID</h2></div>;
}

/** SCREENS['id-done'] (in checkout, not from the account: "Continue" goes back to paying). Tier 1 from here. */
export function IdDoneScreen() {
  const verifiedContinue = useCheckout((s) => s.verifiedContinue);
  return (
    <>
      <div className="center"><div className="badge ok"><Raw html={CHECK_DRAW} /></div><h2 className="title">You&rsquo;re verified</h2></div>
      <button className="btn" id="idGo" onClick={verifiedContinue}>Continue</button>
    </>
  );
}

/** Manual review: tVfSlow's review copy (wallet engine), in Checkout's classes. Demo bar: Approve review. */
export function IdReviewScreen() {
  const { order, finishLater } = useCheckout();
  const account = useAccount((s) => s.account);
  if (!order || !account) return null;
  return (
    <>
      <div className="center">
        <div className="badge info"><Raw html={IDCARD_ICON} /></div>
        <h2 className="title">Your ID needs a closer look</h2>
        <p className="sub">A specialist is reviewing it. This usually takes up to 24 hours. We&rsquo;ll email <b>{maskEmail(account.email)}</b> as soon as it&rsquo;s done.</p>
      </div>
      <button className="btn" id="idReviewLater" onClick={() => finishLater("id_review")}>Finish later</button>
      <p className="sub" id="idReviewCart" style={{ textAlign: "center", fontSize: "12px", marginTop: "10px" }}>Your {order.merchant} cart is saved. The email links back to it.</p>
    </>
  );
}

/** Needs retry: tVfRetry (wallet engine), in Checkout's classes. After VF_MAX_TRIES it's a decline. */
export function IdRetryScreen() {
  const { idv, tryAgain, finishLater } = useCheckout();
  const failures = useAccount((s) => s.account?.idFailures ?? 0);
  const left = ID_MAX_TRIES - failures;
  return (
    <>
      <div className="center">
        <div className="badge" style={{ background: "var(--warn-50)", color: "var(--warn)" }}><Raw html={WICON.alert} /></div>
        <h2 className="title">We couldn&rsquo;t read your ID</h2>
        <p className="sub" id="idRetryReason">{idv.retryReason ?? ID_RETRY_REASONS[0]}</p>
        <p className="sub" id="idRetryLeft" style={{ fontSize: "12px", marginTop: "-4px" }}>{left} {left === 1 ? "try" : "tries"} left</p>
      </div>
      <button className="btn" id="idTryAgain" onClick={tryAgain}>Try again</button>
      <div className="center"><button type="button" className="btn ghost" id="idRetryLater" onClick={() => finishLater("canceled")}>Finish later</button></div>
    </>
  );
}

/** SCREENS['blocked']: age and id_declined from the checkout; sanctions uses tSanctionsDeclined's copy. */
const BLOCK_COPY = {
  age: ["You must be 18 or older", "Poket accounts are for people aged 18 and over."],
  id_declined: ["We couldn’t verify your identity", "If you think this is a mistake, contact Poket support."],
  sanctions: ["We couldn’t verify this account", "Contact Poket support."],
} as const;
export function BlockedScreen() {
  const { order, blockReason, close } = useCheckout();
  if (!order || !blockReason) return null;
  const [title, body] = BLOCK_COPY[blockReason];
  return (
    <>
      <div className="center"><div className="badge err"><Raw html={ICON.x} /></div><h2 className="title">{title}</h2><p className="sub">{body} You haven’t been charged.</p></div>
      <button className="btn quiet" id="blkBack" onClick={() => close("blocked")}>Back to {order.merchant}</button>
    </>
  );
}
