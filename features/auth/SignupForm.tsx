"use client";
import { useEffect, useRef, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { EDIT_ICON, ID_ICON, USER_ICON } from "@/lib/icons";
import { lookupAccount, verifyCode } from "@/lib/mock-api";
import type { Account } from "@/store/account";
import { handleCodeError } from "@/store/lock";
import { CodeBoxes } from "./CodeBoxes";
import { DialSheet } from "./DialSheet";
import { DEFAULT_DIAL, dialCode, dialIso, flag, fmtPhone, idValid, isPhone, maskId, type Identifier } from "./identifier";

const TERMS = "https://onepoket.com/terms-and-conditions";
const PRIVACY = "https://onepoket.com/privacy-policy";
const CHEVRON = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
/** How long Resend stays "Code sent" (the reference's 30 s). */
const RESEND_WAIT_MS = 30000;

/** A new account's details, once the code is right (the widget makes the account). */
export type SignupDetails = { email: string; phone?: { dial: string; num: string }; first: string; last: string };
/** The code was right: log in to the account the email or phone already has, or sign up with these details. */
export type SignupResult = { account: Account } | { details: SignupDetails };

/**
 * reference/poket-widgets.html SCREENS['signup'], shared by Checkout and the wallet. One screen: the email or phone
 * (with a switch and, for a phone, a country code), the legal first and last name and the terms, then Continue. The
 * 6-digit code is entered in place, with Edit and Resend. An email or phone that already has a Poket account is
 * spotted as it's typed: the names and terms hide and the button reads "Continue to log in".
 *
 * In the wallet it sits in .su, where styles/wallet-signup.css has Checkout's rules.
 */
export function SignupForm({ widget, prefill, showToast, onVerified, onLocked }: {
  widget: "checkout" | "wallet";
  /** Details the store shared (Checkout's order customer). */
  prefill?: { email?: string; first?: string; last?: string };
  showToast: (msg: string) => void;
  onVerified: (r: SignupResult) => void;
  /** Too many wrong codes: the widget shows "Account locked". */
  onLocked: () => void;
}) {
  const [id, setId] = useState<Identifier>({ method: "email", email: prefill?.email ?? "", dial: DEFAULT_DIAL, phone: "" });
  const [first, setFirst] = useState(prefill?.first ?? "");
  const [last, setLast] = useState(prefill?.last ?? "");
  const [terms, setTerms] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resent, setResent] = useState(false);
  /** The open country-code sheet covers this element (Checkout's .wg, the wallet's .panel). */
  const [dialHost, setDialHost] = useState<HTMLElement | null>(null);
  const [focusId, setFocusId] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialBtn = useRef<HTMLButtonElement>(null);
  const resendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resendTimer.current) clearTimeout(resendTimer.current); }, []);
  // After Edit, a switch or a new country code: the cursor goes back to the end of the email or number
  useEffect(() => {
    const f = input.current;
    if (!focusId || !f) return;
    f.focus();
    try { f.setSelectionRange(f.value.length, f.value.length); } catch { /* type=email has no selection */ }
  }, [focusId]);

  const phone = isPhone(id);
  const known = idValid(id) && !!lookupAccount(id);
  const ready = known || (terms && idValid(id) && first.trim() !== "" && last.trim() !== "");
  const switchMethod = () => { setId({ ...id, method: phone ? "email" : "phone" }); setCodeSent(false); setFocusId((n) => n + 1); };

  async function verify(code: string) {
    // Too many wrong codes (counted with the wallet's device codes) lock the account
    try { await verifyCode(code); }
    catch (e) { if (handleCodeError(e, widget)) { onLocked(); return; } throw e; }
    const existing = lookupAccount(id);
    if (existing) { onVerified({ account: structuredClone(existing) }); return; }
    const num = id.phone.replace(/\D/g, "");
    onVerified({ details: phone
      ? { email: prefill?.email?.trim() ?? "", phone: { dial: id.dial, num }, first: first.trim(), last: last.trim() }
      : { email: id.email.trim(), first: first.trim(), last: last.trim() } });
  }

  return (
    <div className="su" ref={root}>
      <div className="badge info"><Raw html={(phone ? ID_ICON.phone : ID_ICON.email).replace(/16/g, "20")} /></div>
      <h2 className="title center">{phone ? "Verify your phone number" : "Verify your email"}</h2>
      {codeSent ? (
        <>
          <div className="id-summary">
            <span className="id-ic"><Raw html={phone ? ID_ICON.phone : ID_ICON.email} /></span>
            <span className="id-val">{maskId(id)}</span>
            <button type="button" className="id-edit" id="idEdit" aria-label={`Edit ${phone ? "phone number" : "email"}`} onClick={() => { setCodeSent(false); setFocusId((n) => n + 1); }}><Raw html={EDIT_ICON} /></button>
            <button type="button" className="id-switch" id="idSwitch" onClick={switchMethod}>{phone ? "Use email" : "Use phone"}</button>
          </div>
          <label className="lbl">Enter the 6-digit code we {phone ? "texted" : "sent"} you</label>
          <CodeBoxes onComplete={verify} />
          <div className="center">
            <button className="btn ghost" id="otpResend" style={{ paddingTop: 2 }} disabled={resent} onClick={() => {
              showToast(`New code ${phone ? "texted" : "sent"} to ${maskId(id)}`);
              setResent(true);
              resendTimer.current = setTimeout(() => setResent(false), RESEND_WAIT_MS);
            }}>{resent ? "Code sent" : "Resend code"}</button>
          </div>
        </>
      ) : (
        <>
          <label className="lbl" htmlFor="idInput">{phone ? "Phone number" : "Email address"}</label>
          <div className="id-field">
            <span className="id-ic"><Raw html={phone ? ID_ICON.phone : ID_ICON.email} /></span>
            {phone && (
              <button type="button" className="dial" id="idDialBtn" ref={dialBtn} aria-haspopup="dialog" aria-label={`Country code ${dialCode(id.dial)}, ${id.dial}. Change`} onClick={() => setDialHost(root.current?.closest<HTMLElement>(".wg, .panel") ?? null)}>
                <span className="flag">{flag(dialIso(id.dial))}</span><span className="mono">{dialCode(id.dial)}</span><Raw html={CHEVRON} />
              </button>
            )}
            {phone ? (
              <input key="phone" ref={input} id="idInput" className="mono" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="803 123 4567"
                value={fmtPhone(id.phone)} onChange={(e) => setId({ ...id, phone: e.target.value.replace(/\D/g, "") })} />
            ) : (
              <input key="email" ref={input} id="idInput" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
                value={id.email} onChange={(e) => setId({ ...id, email: e.target.value.trim() })} />
            )}
            <button type="button" className="id-switch" id="idSwitch" onClick={switchMethod}>{phone ? "Use email" : "Use phone"}</button>
          </div>
          <div className="known-note" id="suKnown" hidden={!known}>
            <span className="protect-ic"><Raw html={USER_ICON.replace(/18/g, "16")} /></span>
            <span><b id="suKnownT">{phone ? "This number already has a Poket account." : "This email already has a Poket account."}</b><br />We’ll send a code to log you in.</span>
          </div>
          <div id="suNames" hidden={known}>
            <div className="row c2">
              <div><label className="lbl" htmlFor="suFirst">Legal first name</label><input className="field" id="suFirst" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} /></div>
              <div><label className="lbl" htmlFor="suLast">Legal last name</label><input className="field" id="suLast" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} /></div>
            </div>
          </div>
          <label className="check" id="suTermsRow" hidden={known}>
            <input type="checkbox" id="suTerms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>Accept <a className="link" href={TERMS} target="_blank" rel="noopener">Terms of Service</a> and the <a className="link" href={PRIVACY} target="_blank" rel="noopener">Privacy Policy</a></span>
          </label>
          <button className="btn" id="suGo" disabled={!ready} onClick={() => { setCodeSent(true); setResent(false); }}>
            {known ? "Continue to log in" : "Continue"}
          </button>
        </>
      )}
      {dialHost && (
        <DialSheet host={dialHost} selected={id.dial}
          onPick={(dial) => { setId({ ...id, dial }); setDialHost(null); setFocusId((n) => n + 1); }}
          onClose={() => { setDialHost(null); setTimeout(() => dialBtn.current?.focus(), 0); }} />
      )}
    </div>
  );
}
