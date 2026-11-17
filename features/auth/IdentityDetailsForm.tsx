"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { ID_COUNTRIES, MONTHS, ageFrom, fmtSsn, ssnOk, usesSsn, type IdentityDetails } from "./identity";

const LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7"/></svg>';

/** The two steps of verifying from the wallet (the reference's kycStepper; Checkout shows its own journey instead). */
export function IdentitySteps({ now }: { now: 0 | 1 | 2 }) {
  return (
    <div className="steps two" role="list" aria-label="Verification progress">
      {["Your details", "ID verification"].map((l, i) => (
        <div key={l} role="listitem" className={i < now ? "done" : i === now ? "now" : ""} aria-current={i === now ? "step" : undefined}><i />{l}</div>
      ))}
    </div>
  );
}

/**
 * "Verify your identity", the Tier 1 details screen (reference/poket-widgets.html tKycDetails), shared by Checkout
 * and the wallet so they can't drift: Country, the legal first and last name (prefilled from sign-up), the date of
 * birth (DD, a Month picker, YYYY), and for the US the Social Security number (Show, "I don’t have an SSN"). In
 * Checkout's classes; the wallet renders it inside .su (styles/wallet-signup.css). The host decides what Continue
 * leads to (under 18 by this date of birth: its age-blocked screen).
 */
export function IdentityDetailsForm({ initial, steps, onSubmit, onLater }: {
  initial: IdentityDetails;
  /** Show "Your details / ID verification" (the wallet). */
  steps?: boolean;
  onSubmit: (det: IdentityDetails) => void;
  onLater: () => void;
}) {
  const [det, setDet] = useState(initial);
  const [showSsn, setShowSsn] = useState(false);
  const set = (p: Partial<IdentityDetails>) => setDet((x) => ({ ...x, ...p }));
  const us = det.country === "United States";
  const ssn = usesSsn(det);
  const ssnBad = ssn && det.ssn.replace(/\D/g, "").length === 9 && !ssnOk(det.ssn);
  const ready = !!det.first.trim() && !!det.last.trim() && ageFrom(det.d, det.m, det.y) !== null && (!ssn || ssnOk(det.ssn));
  // The reference's input rules: digits only, a day up to 31, a year in the last 120
  const day = (v: string) => { const x = v.replace(/\D/g, "").slice(0, 2); return +x > 31 ? "31" : x; };
  const year = (v: string) => {
    let x = v.replace(/\D/g, "").slice(0, 4);
    const now = new Date().getFullYear();
    if (x.length === 4) { if (+x > now) x = String(now); else if (+x < now - 120) x = String(now - 120); }
    return x;
  };
  return (
    <>
      {steps && <IdentitySteps now={0} />}
      <h2 className="title">Verify your identity</h2>
      <p className="sub">Enter your name and date of birth exactly as they appear on your government-issued ID.</p>
      <label className="lbl" htmlFor="dCountry">Country</label>
      <select className="field" id="dCountry" autoComplete="country-name" value={det.country} onChange={(e) => set({ country: e.target.value, noSsn: false })}>
        {ID_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <div className="row c2">
        <div><label className="lbl" htmlFor="dFirst">Legal first name</label><input className="field" id="dFirst" autoComplete="given-name" value={det.first} onChange={(e) => set({ first: e.target.value.trimStart() })} /></div>
        <div><label className="lbl" htmlFor="dLast">Legal last name</label><input className="field" id="dLast" autoComplete="family-name" value={det.last} onChange={(e) => set({ last: e.target.value.trimStart() })} /></div>
      </div>
      <label className="lbl">Date of birth</label>
      <div className="row c3">
        <input className="field" id="dD" inputMode="numeric" autoComplete="bday-day" maxLength={2} placeholder="DD" aria-label="Day" value={det.d} onChange={(e) => set({ d: day(e.target.value) })} />
        {/* An empty choice reads grey; the chosen month shows short ("Mar"), the list in full */}
        <select className="field" id="dM" autoComplete="bday-month" aria-label="Month" value={det.m} style={det.m ? undefined : { color: "var(--txt3)" }} onChange={(e) => set({ m: e.target.value })}>
          <option value="" disabled>Month</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{det.m === String(i + 1) ? m.slice(0, 3) : m}</option>)}
        </select>
        <input className="field" id="dY" inputMode="numeric" autoComplete="bday-year" maxLength={4} placeholder="YYYY" aria-label="Year" value={det.y} onChange={(e) => set({ y: year(e.target.value) })} />
      </div>
      {ssn && (
        <>
          <label className="lbl" htmlFor="dSsn">Social Security number</label>
          <div className="id-field">
            <span className="id-ic"><Raw html={LOCK} /></span>
            <input className="mono" id="dSsn" inputMode="numeric" maxLength={11} placeholder="000-00-0000" type={showSsn ? "text" : "password"} autoComplete="off"
              aria-invalid={ssnBad || undefined} value={det.ssn} onChange={(e) => set({ ssn: fmtSsn(e.target.value) })} />
            <button type="button" className="id-switch" id="dSsnShow" aria-controls="dSsn" onClick={() => setShowSsn(!showSsn)}>{showSsn ? "Hide" : "Show"}</button>
          </div>
          {ssnBad && <p className="hint bad" id="dSsnErr" role="alert">Check your SSN. This number isn’t valid.</p>}
        </>
      )}
      {us && (
        <p className="hint"><button type="button" className="link" id="dNoSsn" onClick={() => set({ noSsn: !det.noSsn })}>{det.noSsn ? "Use my SSN instead" : "I don’t have an SSN"}</button></p>
      )}
      <button className="btn" id="dGo" disabled={!ready} onClick={() => onSubmit({ ...det, first: det.first.trim(), last: det.last.trim() })}>
        {ssn ? "Continue to selfie check" : "Continue to ID verification"}
      </button>
      <div className="center"><button type="button" className="btn ghost" id="dLater" onClick={onLater}>Finish later</button></div>
    </>
  );
}
