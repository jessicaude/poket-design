"use client";
import { useEffect, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { WELCOME_MARK, WICON } from "@/lib/icons";
import { useAccountLock } from "@/store/lock";
import { AccountLockedScreen } from "../AccountLockedScreen";
import { CodeBoxes } from "../CodeBoxes";
import { BackRow, SpinButton } from "../payout/parts";
import { useWalletToast } from "../useWalletToast";
import { MIN_AGE, useOnboarding } from "./useOnboarding";

/** Poket's documents (docs/decisions.md), as the reference's .consent-link opens them. */
const TERMS = "https://onepoket.com/terms-and-conditions";
const PRIVACY = "https://onepoket.com/privacy-policy";
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
/** The reference's maskEmail: "ada@osun.co" → "ad***@osun.co". */
const maskEmail = (email: string) => { const at = email.indexOf("@"); return at < 2 ? email : email.slice(0, 2) + "***" + email.slice(at); };
/** Phone sign-up and log-in aren't ported (as in Checkout). */
const phoneNotPorted = () => useWalletToast.getState().showToast("Phone sign-up isn’t ported yet");

/** #panelBody while signed out: the current onboarding screen. */
export function OnboardingBody() {
  const screen = useOnboarding((s) => s.screen);
  const locked = useAccountLock((s) => s.until) !== null;
  // Too many wrong codes: the code screen shows the lock; Close goes back to the start
  if (locked && screen === "onboard-phone-otp") return <AccountLockedScreen onClose={() => useOnboarding.getState().backToStart()} />;
  return (
    <div className="screen-fade" key={screen}>
      {screen === "onboard-welcome" && <WelcomeScreen />}
      {screen === "onboard-email" && <SignupScreen />}
      {screen === "onboard-login" && <LoginScreen />}
      {screen === "onboard-phone-otp" && <CodeScreen />}
      {screen === "onboard-geo" && <Checking id="onboardGeo" sub="Poket confirms your location matches where account services are allowed." />}
      {screen === "login-geo" && <Checking id="loginGeo" sub="This only takes a moment." />}
      {screen === "onboard-geo-blocked" && (
        <Blocked id="onboardGeoBlocked" icon={WICON.pin} title="Location Not Supported" btnId="onboardGeoBlockedClose" btn="Back to start"
          sub="Poket confirms your location before opening an account. We couldn’t verify that your current location is one where Poket is available, so we can’t create your account from here." />
      )}
      {screen === "login-geo-blocked" && (
        <Blocked id="loginGeoBlocked" icon={WICON.pin} title="Poket isn’t available here" btnId="loginGeoBlockedClose" btn="Back to log in"
          sub="We check your location each time you log in. Poket isn’t available where you are right now, so we can’t log you in."
          onClick={() => useOnboarding.getState().go("onboard-login")} />
      )}
      {screen === "onboard-age" && <AgeScreen />}
      {screen === "age-blocked" && (
        <Blocked id="ageBlocked" icon={WICON.closeIc} title="We can’t create this account" btnId="ageBlockedClose" btn="Back to start"
          sub={`Poket accounts require the account holder to be at least ${MIN_AGE} years old. Based on the date of birth entered, this account can’t be created.`} />
      )}
    </div>
  );
}

/** tOnboardWelcome. */
function WelcomeScreen() {
  const go = useOnboarding((s) => s.go);
  return (
    <>
      <div className="welcome-hero"><Raw html={WELCOME_MARK} /></div>
      <div className="step-title" style={{ textAlign: "center" }}>Welcome to Poket</div>
      <p className="step-sub" style={{ textAlign: "center" }}>One account to hold, convert, and spend stablecoins.</p>
      <div className="welcome-features">
        <div className="welcome-feature-row"><span className="feature-ic"><Raw html={WICON.coins} /></span>Hold and convert stablecoins</div>
        <div className="welcome-feature-row"><span className="feature-ic"><Raw html={WICON.card} /></span>Spend anywhere with a virtual card</div>
        <div className="welcome-feature-row"><span className="feature-ic"><Raw html={WICON.transfer} /></span>Send and receive instantly</div>
      </div>
      <button className="btn-primary" id="goSignup" onClick={() => go("onboard-email")}>Sign Up</button>
      <button className="btn-secondary" id="goLogin" style={{ width: "100%", marginTop: "10px" }} onClick={() => go("onboard-login")}>Log In</button>
    </>
  );
}

/** tOnboardEmail (before the code is sent): email, legal name, terms. */
function SignupScreen() {
  const { email, first, last, terms, notice, set, go, signUp } = useOnboarding();
  const ready = emailOk(email) && terms && first.trim() !== "" && last.trim() !== "";
  return (
    <>
      <div className="center-col" style={{ paddingTop: "8px", paddingBottom: 0 }}>
        <div className="check-circle" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}>
          <Raw html={'<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M3 8l9 6 9-6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'} />
        </div>
      </div>
      <div className="step-title" style={{ textAlign: "center" }}>Create account</div>
      <p className="step-sub" style={{ textAlign: "center" }}>Hold balances, send stablecoins, and spend with virtual card.</p>
      {notice && <div className="alert info" id="signupNotice" style={{ marginBottom: "14px" }}>{notice}</div>}
      <label className="field-label" htmlFor="signupEmailInput">Email address</label>
      <div className="id-field">
        <span className="id-ic"><Raw html={WICON.mail} /></span>
        <input className="id-input" id="signupEmailInput" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
          value={email} onChange={(e) => set({ email: e.target.value })} />
        <button type="button" className="id-switch" id="signupSwitchMethod" onClick={phoneNotPorted}>Use phone</button>
      </div>
      <div className="field-row" style={{ marginBottom: "14px" }}>
        <div><label className="field-label" htmlFor="signupFirst">Legal first name</label><input className="field-input" id="signupFirst" autoComplete="given-name" value={first} onChange={(e) => set({ first: e.target.value })} style={{ marginBottom: 0 }} /></div>
        <div><label className="field-label" htmlFor="signupLast">Legal last name</label><input className="field-input" id="signupLast" autoComplete="family-name" value={last} onChange={(e) => set({ last: e.target.value })} style={{ marginBottom: 0 }} /></div>
      </div>
      <div className="consent-row">
        <input type="checkbox" id="signupTermsCheck" checked={terms} onChange={(e) => set({ terms: e.target.checked })} />
        <label htmlFor="signupTermsCheck">Accept <a className="consent-link" data-doc="terms" href={TERMS} target="_blank" rel="noopener">Terms of Service</a> and the <a className="consent-link" data-doc="privacy" href={PRIVACY} target="_blank" rel="noopener">Privacy Policy</a></label>
      </div>
      <SpinButton id="continueEmail" delay={800} disabled={!ready} onClick={signUp}>Sign Up</SpinButton>
      <div style={{ textAlign: "center", marginTop: "14px", fontSize: "12.5px", color: "var(--txt2)" }}>
        Already have an account? <span className="btn-ghost" id="goLoginFromSignup" role="button" tabIndex={0} onClick={() => go("onboard-login")}>Log in</span>
      </div>
    </>
  );
}

/** tOnboardLogin (before the code is sent). */
function LoginScreen() {
  const { loginEmail, set, go, sendLoginCode } = useOnboarding();
  return (
    <>
      <BackRow id="backToWelcome" onClick={() => go("onboard-welcome")} />
      <div className="center-col" style={{ paddingTop: "8px", paddingBottom: 0 }}>
        <div className="check-circle" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}><Raw html={WICON.user} /></div>
      </div>
      <div className="step-title" style={{ textAlign: "center" }}>Log in</div>
      <p className="step-sub" style={{ textAlign: "center" }}>We’ll email you a passcode to confirm it’s you.</p>
      <label className="field-label" htmlFor="loginEmailInput">Email address</label>
      <div className="id-field">
        <span className="id-ic"><Raw html={WICON.mail} /></span>
        <input className="id-input" id="loginEmailInput" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
          value={loginEmail} onChange={(e) => set({ loginEmail: e.target.value })} />
        <button type="button" className="id-switch" id="loginSwitchMethod" onClick={phoneNotPorted}>Use phone</button>
      </div>
      <SpinButton id="sendLoginCode" delay={800} disabled={!emailOk(loginEmail)} onClick={sendLoginCode}>Send passcode</SpinButton>
      <div style={{ textAlign: "center", marginTop: "14px", fontSize: "12.5px", color: "var(--txt2)" }}>
        Don’t have an account? <span className="btn-ghost" id="goSignupFromLogin" role="button" tabIndex={0} onClick={() => go("onboard-email")}>Sign up</span>
      </div>
    </>
  );
}

/** tOnboardPhoneOtp, for the email: "Enter code", with Checkout's code entry (it verifies itself once full). */
function CodeScreen() {
  const { mode, email, loginEmail, go, verify } = useOnboarding();
  const sentTo = mode === "login" ? loginEmail : email;
  const [left, setLeft] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <>
      <BackRow id="backToPasscode" onClick={() => go(mode === "login" ? "onboard-login" : "onboard-email")} />
      <div className="step-title">Enter code</div>
      <p className="step-sub" id="codeSentTo">Sent 6-digit code to {maskEmail(sentTo.trim())}.</p>
      <CodeBoxes id="phoneOtpRow" statusId="phoneOtpStatus" onComplete={verify} />
      <div style={{ textAlign: "center", marginTop: "12px" }}>
        <span className="btn-ghost" id="resendPhoneOtp" role="button" tabIndex={0} onClick={() => {
          if (left > 0) return;
          setLeft(RESEND_SECONDS);
          useWalletToast.getState().showToast("Code sent again");
        }}>{left > 0 ? `Resend (${left}s)` : "Resend code"}</span>
      </div>
    </>
  );
}
/** The reference's resend countdown (startResendTimer). */
const RESEND_SECONDS = 14;

/** tOnboardAge. */
function AgeScreen() {
  const { dobMonth, dobDay, dobYear, ageConfirmed, set, ageContinue } = useOnboarding();
  const ready = !!dobMonth && !!dobDay && dobYear.length === 4 && ageConfirmed;
  // The reference's input rules: digits only, month up to 12, day up to 31, a year in the last 120
  const two = (v: string, max: number) => { let x = v.replace(/\D/g, "").slice(0, 2); if (x.length === 2 && parseInt(x, 10) > max) x = String(max); if (x === "00") x = "0"; return x; };
  const year = (v: string) => {
    let x = v.replace(/\D/g, "").slice(0, 4);
    if (x.length === 4) { const y = parseInt(x, 10), now = new Date().getFullYear(); if (y > now) x = String(now); else if (y < now - 120) x = String(now - 120); }
    return x;
  };
  return (
    <>
      <div className="step-title">Confirm your age</div>
      <p className="step-sub">You must be at least {MIN_AGE} to use Poket. Self-attested now, verified against your ID later.</p>
      <label className="field-label">Date of birth</label>
      <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr 1.2fr", marginBottom: 0 }}>
        <input className="field-input" id="dobMonthInput" placeholder="MM" maxLength={2} inputMode="numeric" aria-label="Month" value={dobMonth} onChange={(e) => set({ dobMonth: two(e.target.value, 12) })} />
        <input className="field-input" id="dobDayInput" placeholder="DD" maxLength={2} inputMode="numeric" aria-label="Day" value={dobDay} onChange={(e) => set({ dobDay: two(e.target.value, 31) })} />
        <input className="field-input" id="dobYearInput" placeholder="YYYY" maxLength={4} inputMode="numeric" aria-label="Year" value={dobYear} onChange={(e) => set({ dobYear: year(e.target.value) })} />
      </div>
      <label className="field-label" style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "14px", cursor: "pointer" }}>
        <input type="checkbox" id="ageConfirmCheck" style={{ marginTop: "2px" }} checked={ageConfirmed} onChange={(e) => set({ ageConfirmed: e.target.checked })} />
        <span style={{ fontWeight: 400 }}>I confirm this date of birth is accurate and I’m {MIN_AGE}+.</span>
      </label>
      <SpinButton id="ageContinue" delay={600} style={{ marginTop: "16px" }} disabled={!ready} onClick={ageContinue}>Continue</SpinButton>
    </>
  );
}

/** tOnboardGeo / tLoginGeo: the location check. */
function Checking({ id, sub }: { id: string; sub: string }) {
  return (
    <div className="center-col" style={{ paddingTop: "24px" }} id={id}>
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Checking your location</div>
      <p className="step-sub">{sub}</p>
    </div>
  );
}

/** tOnboardGeoBlocked, tLoginGeoBlocked, tAgeBlocked: the red circle, why, and the way back. */
function Blocked({ id, icon, title, sub, btnId, btn, onClick }: { id: string; icon: string; title: string; sub: string; btnId: string; btn: string; onClick?: () => void }) {
  return (
    <div className="center-col" style={{ paddingTop: "24px" }} id={id}>
      <div className="check-circle" style={{ background: "var(--err-50)", color: "var(--err-600)" }}><Raw html={icon} /></div>
      <div className="step-title">{title}</div>
      <p className="step-sub">{sub}</p>
      <button className="btn-secondary" id={btnId} style={{ width: "100%" }} onClick={onClick ?? (() => useOnboarding.getState().backToStart())}>{btn}</button>
    </div>
  );
}
