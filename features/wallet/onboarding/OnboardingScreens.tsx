"use client";
import { Raw } from "@/components/ui/Raw";
import { SignupForm } from "@/features/auth/SignupForm";
import { WELCOME_MARK, WICON } from "@/lib/icons";
import { useAccountLock } from "@/store/lock";
import { AccountLockedScreen } from "../AccountLockedScreen";
import { BackRow, SpinButton } from "../payout/parts";
import { useWalletToast } from "../useWalletToast";
import { MIN_AGE, useOnboarding } from "./useOnboarding";

/** #panelBody while signed out: the current onboarding screen. */
export function OnboardingBody() {
  const screen = useOnboarding((s) => s.screen);
  const locked = useAccountLock((s) => s.until) !== null;
  // Too many wrong codes: sign-up shows the lock; Close goes back to the start
  if (locked && screen === "signup") return <AccountLockedScreen onClose={() => useOnboarding.getState().backToStart()} />;
  return (
    <div className="screen-fade" key={screen}>
      {screen === "onboard-welcome" && <WelcomeScreen />}
      {screen === "signup" && <SignupScreen />}
      {screen === "onboard-geo" && <Checking id="onboardGeo" sub="Poket confirms your location matches where account services are allowed." />}
      {screen === "login-geo" && <Checking id="loginGeo" sub="This only takes a moment." />}
      {screen === "onboard-geo-blocked" && (
        <Blocked id="onboardGeoBlocked" icon={WICON.pin} title="Location Not Supported" btnId="onboardGeoBlockedClose" btn="Back to start"
          sub="Poket confirms your location before opening an account. We couldn’t verify that your current location is one where Poket is available, so we can’t create your account from here." />
      )}
      {screen === "login-geo-blocked" && (
        <Blocked id="loginGeoBlocked" icon={WICON.pin} title="Poket isn’t available here" btnId="loginGeoBlockedClose" btn="Back to log in"
          sub="We check your location each time you log in. Poket isn’t available where you are right now, so we can’t log you in."
          onClick={() => useOnboarding.getState().go("signup")} />
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
      <button className="btn-primary" id="goSignup" onClick={() => go("signup")}>Sign Up</button>
      <button className="btn-secondary" id="goLogin" style={{ width: "100%", marginTop: "10px" }} onClick={() => go("signup")}>Log In</button>
    </>
  );
}

/**
 * Sign up or log in: Checkout's sign-up screen (features/auth/SignupForm.tsx). A known email or phone logs in from
 * here, so Log In opens it too.
 */
function SignupScreen() {
  const { go, verified } = useOnboarding();
  return (
    <>
      <BackRow id="backToWelcome" onClick={() => go("onboard-welcome")} />
      <SignupForm widget="wallet" showToast={(m) => useWalletToast.getState().showToast(m)} onVerified={verified}
        onLocked={() => { /* OnboardingBody shows the lock (useAccountLock) */ }} />
    </>
  );
}

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
