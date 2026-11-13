"use client";
import { useEffect, useRef, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { EDIT_ICON, ID_ICON, USER_ICON } from "@/lib/icons";
import { findAccount, verifyCode } from "@/lib/mock-api";
import { handleCodeError } from "@/store/lock";
import { useCheckout } from "../useCheckout";

const TERMS = "https://onepoket.com/terms-and-conditions";
const PRIVACY = "https://onepoket.com/privacy-policy";
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
/** kemi@example.com -> k••••i@example.com */
const maskEmail = (v: string) => { const [u, d] = v.split("@"); return u.length <= 2 ? `${u[0]}••••@${d}` : `${u[0]}••••${u[u.length - 1]}@${d}`; };

/** SCREENS['signup']: email, legal name and terms; then the 6-digit code appears in place. */
export function SignupScreen() {
  const { order, signedUp, loggedIn, showToast } = useCheckout();
  const c = order?.customer;
  const [email, setEmail] = useState(c?.email ?? "");
  const [first, setFirst] = useState(c?.first ?? "");
  const [last, setLast] = useState(c?.last ?? "");
  const [terms, setTerms] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [loginFor, setLoginFor] = useState(false);

  const known = emailOk(email) && !!findAccount(email);
  const canGo = known || (terms && emailOk(email) && first.trim() !== "" && last.trim() !== "");

  return (
    <>
      <div className="badge info"><Raw html={ID_ICON.email.replace(/16/g, "20")} /></div>
      <h2 className="title center">Verify your email</h2>
      {codeSent ? (
        <>
          <div className="id-summary">
            <span className="id-ic"><Raw html={ID_ICON.email} /></span>
            <span className="id-val">{maskEmail(email)}</span>
            <button type="button" className="id-edit" aria-label="Edit email" onClick={() => setCodeSent(false)}><Raw html={EDIT_ICON} /></button>
            <button type="button" className="id-switch" onClick={() => showToast("Phone sign-up isn’t ported yet")}>Use phone</button>
          </div>
          <label className="lbl">Enter the 6-digit code we sent you</label>
          <Otp
            onComplete={async (code) => {
              // Too many wrong codes (with the wallet's device codes) lock the account: "Account locked"
              try { await verifyCode(code); }
              catch (e) { if (handleCodeError(e, "checkout")) { useCheckout.getState().locked(); return; } throw e; }
              const existing = findAccount(email);
              if (loginFor && existing) loggedIn(structuredClone(existing));
              else signedUp({ email: email.trim(), first: first.trim(), last: last.trim(), tier: 0, methods: [], payments: [] });
            }}
          />
          <div className="center"><button className="btn ghost" style={{ paddingTop: 2 }} onClick={() => showToast("Code sent again")}>Resend code</button></div>
        </>
      ) : (
        <>
          <label className="lbl" htmlFor="idInput">Email address</label>
          <div className="id-field">
            <span className="id-ic"><Raw html={ID_ICON.email} /></span>
            <input id="idInput" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="button" className="id-switch" onClick={() => showToast("Phone sign-up isn’t ported yet")}>Use phone</button>
          </div>
          <div className="known-note" hidden={!known}>
            <span className="protect-ic"><Raw html={USER_ICON.replace(/18/g, "16")} /></span>
            <span><b>This email already has a Poket account.</b><br />We’ll send a code to log you in.</span>
          </div>
          <div hidden={known}>
            <div className="row c2">
              <div><label className="lbl" htmlFor="suFirst">Legal first name</label><input className="field" id="suFirst" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} /></div>
              <div><label className="lbl" htmlFor="suLast">Legal last name</label><input className="field" id="suLast" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} /></div>
            </div>
          </div>
          <label className="check" hidden={known}>
            <input type="checkbox" id="suTerms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>Accept <a className="link" href={TERMS} target="_blank" rel="noopener">Terms of Service</a> and the <a className="link" href={PRIVACY} target="_blank" rel="noopener">Privacy Policy</a></span>
          </label>
          <button className="btn" id="suGo" disabled={!canGo} onClick={() => { setLoginFor(known); setCodeSent(true); }}>
            {known ? "Continue to log in" : "Continue"}
          </button>
        </>
      )}
    </>
  );
}

/** Six boxes that verify themselves once full. Paste fills all six. */
function Otp({ onComplete }: { onComplete: (code: string) => Promise<void> }) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<{ text: string; err?: boolean; busy?: boolean }>({ text: "" });
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { boxes.current[0]?.focus(); }, []);

  async function verify(code: string) {
    setStatus({ text: "Verifying…", busy: true });
    try { await onComplete(code); }
    catch (e) {
      setDigits(["", "", "", "", "", ""]); setStatus({ text: (e as Error).message, err: true });
      setTimeout(() => boxes.current[0]?.focus(), 0);
    }
  }
  function setAt(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(0, 1);
    const next = digits.map((x, k) => (k === i ? d : x));
    setDigits(next);
    if (status.err) setStatus({ text: "" });
    if (d && boxes.current[i + 1]) boxes.current[i + 1]?.focus();
    if (next.every((x) => /\d/.test(x))) verify(next.join(""));
  }
  return (
    <>
      <div className="otp" id="otp" onPaste={(e) => {
        const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (d.length === 6) { e.preventDefault(); setDigits(d.split("")); verify(d); }
      }}>
        {digits.map((v, i) => (
          <input key={i} ref={(el) => { boxes.current[i] = el; }} inputMode="numeric" maxLength={1} aria-label={`Digit ${i + 1}`}
            autoComplete={i === 0 ? "one-time-code" : "off"} value={v} disabled={status.busy}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Backspace" && !v && i > 0) boxes.current[i - 1]?.focus(); }} />
        ))}
      </div>
      <div className={`otp-status ${status.err ? "err" : ""}`} role="status" aria-live="polite">
        {status.busy && <span className="mini-spin" />}{status.text}
      </div>
    </>
  );
}
