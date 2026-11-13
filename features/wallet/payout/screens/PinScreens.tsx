"use client";
import { useEffect, useRef, useState } from "react";
import { CHECKOUT_LOCK_MARK, CHECKOUT_TICK_MARK } from "@/lib/icons";
import { useAccount } from "@/store/account";
import { BackRow } from "../parts";
import { usePayout } from "../usePayout";

/**
 * The checkout's PIN screens (tPin, tPinLocked, tPinResetOtp, tMoneyDone), shown in the wallet panel in place of
 * tPayout's passcode 'authorize' stage. Classes the wallet stylesheet lacks (otp-hint, inline-err, center-state,
 * success-mark, fail-mark) are copied from tplCheckout into styles/wallet-overrides.css with wallet tokens.
 */

/**
 * Digit boxes as the checkout binds them: digits only, one per box, focus moves on, Backspace on an empty box
 * goes back, and when every box is filled `onComplete` runs after `delay` ms. Remount (key) to clear.
 */
function DigitBoxes({ count, password, label, delay, onComplete, style }: {
  count: number; password?: boolean; label: (i: number) => string; delay: number; onComplete: (v: string) => void; style?: React.CSSProperties;
}) {
  const [vals, setVals] = useState<string[]>(() => Array(count).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    // Focus the first box, as the reference does after 100ms, unless typing has already started in one.
    const t = setTimeout(() => {
      const first = refs.current[0];
      const active = (first?.getRootNode() as Document | ShadowRoot | undefined)?.activeElement;
      if (first && !refs.current.includes(active as HTMLInputElement)) first.focus();
    }, 100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="otp-row" style={style}>
      {vals.map((v, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} className={`otp-box${v ? " filled" : ""}`} type={password ? "password" : "text"} maxLength={1} inputMode="numeric"
          aria-label={label(i)} value={v}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            const next = vals.map((x, j) => (j === i ? d : x));
            setVals(next);
            if (d && i < count - 1) refs.current[i + 1]?.focus();
            if (next.every(Boolean)) setTimeout(() => onComplete(next.join("")), delay);
          }}
          onKeyDown={(e) => { if (e.key === "Backspace" && !v && i > 0) refs.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}

/** tPin: create, confirm or enter the 4-digit PIN. Wrong PINs show the attempts left; the third locks it. */
export function PinScreen() {
  const { pinStage, pinPurpose, pinReason, pinError, pinComplete, back, cancelApprove } = usePayout();
  const [tries, setTries] = useState(0);
  const t = {
    create: [pinPurpose === "reset" ? "Create a new PIN" : "Create your PIN", "Protects money leaving your account. 4 digits."],
    confirm: ["Confirm your PIN", "Enter it once more."],
    entry: ["Enter your PIN", pinPurpose === "approve" ? pinReason : "Approves this payment."],
  }[pinStage];
  return (
    <>
      {/* Not in tPin (the checkout closes its sheet instead); it takes the place of the wallet's backToPayoutReview. */}
      {pinPurpose === "payout" && <BackRow id="backToPayoutReview" onClick={back} />}
      {/* Approving a setting: Back cancels it */}
      {pinPurpose === "approve" && <BackRow id="pinApproveCancel" onClick={cancelApprove} />}
      <div className="step-eyebrow">{pinStage === "entry" ? "Security check" : "One-time setup"}</div>
      <div className="step-title">{t[0]}</div>
      <p className="step-sub">{t[1]}{pinError && <> <span style={{ color: "var(--err-600)" }}>{pinError}</span></>}</p>
      <DigitBoxes key={`${pinStage}-${tries}`} count={4} password label={(i) => `PIN digit ${i + 1}`} delay={180} style={{ maxWidth: "220px" }}
        onComplete={async (v) => { await pinComplete(v); setTries((n) => n + 1); }} />
      <p className="otp-hint">Different from your passcode. Never sent to you.</p>
    </>
  );
}

/** tPinLocked. */
export function PinLockedScreen() {
  const { startPinReset, close } = usePayout();
  return (
    <div className="center-state">
      <div className="success-mark fail-mark" dangerouslySetInnerHTML={{ __html: CHECKOUT_LOCK_MARK }} />
      <div className="step-title">Too many attempts</div>
      <p className="step-sub" style={{ marginBottom: 0 }}>Your PIN is locked. Reset it with a passcode sent to your email to keep sending.</p>
      <button className="btn-primary" id="pinLockedReset" onClick={startPinReset}>Reset PIN with passcode</button>
      <button className="btn-ghost" id="pinLockedClose" onClick={close}>Cancel</button>
    </div>
  );
}

/** tPinResetOtp: the 6-digit passcode emailed to you, before a new PIN. */
export function PinResetOtpScreen() {
  const { otpError, pinResetCode } = usePayout();
  const email = useAccount((s) => s.account?.email) || "ada@osun.co";
  const [sent, setSent] = useState(false);
  return (
    <>
      <div className="step-eyebrow">Reset PIN</div>
      <div className="step-title">Verify it&rsquo;s you</div>
      <p className="step-sub">Enter the 6-digit passcode sent to <strong>{email}</strong> before you can set a new PIN.</p>
      <DigitBoxes count={6} label={(i) => `Digit ${i + 1}`} delay={0} onComplete={pinResetCode} />
      {otpError && <p className="inline-err">{otpError}</p>}
      <p className="otp-hint">Didn&rsquo;t get it? <button id="resend" onClick={() => setSent(true)}>{sent ? "Sent ✓" : "Resend passcode"}</button></p>
    </>
  );
}

/** tMoneyDone after a PIN reset. */
export function PinUpdatedScreen() {
  const close = usePayout((s) => s.close);
  return (
    <div className="center-state">
      <div className="success-mark" dangerouslySetInnerHTML={{ __html: CHECKOUT_TICK_MARK }} />
      <div className="step-title">PIN updated</div>
      <p className="step-sub" style={{ marginBottom: 0 }}>Your new PIN is set. Use it next time you send.</p>
      <button className="btn-primary" id="doneToWallet" onClick={close}>Done</button>
    </div>
  );
}
