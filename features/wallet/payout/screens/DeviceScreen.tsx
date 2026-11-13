"use client";
import { useEffect, useRef, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useAccount } from "@/store/account";
import { useWalletToast } from "../../useWalletToast";
import { BackRow } from "../parts";
import { usePayout } from "../usePayout";

/**
 * WGT-10 'device': "Confirm this device", the first time money moves on a new device (a send, or turning on instant
 * transfers). The code entry is Checkout's sign-up design (SignupScreen: id-summary, "Enter the 6-digit code we sent
 * you", six boxes that verify themselves, Resend code); its classes are copied into styles/wallet-overrides.css.
 * A correct code binds the device and the action carries on; 000000 is a wrong code in the demo.
 */
const maskEmail = (v: string) => { const [u, d] = v.split("@"); return u.length <= 2 ? `${u[0]}••••@${d}` : `${u[0]}••••${u[u.length - 1]}@${d}`; };

export function DeviceScreen() {
  const { deviceCode, cancelDevice } = usePayout();
  const email = useAccount((s) => s.account?.email) || "ada@osun.co";
  return (
    <>
      <BackRow id="deviceCancel" label="Cancel" onClick={cancelDevice} />
      {/* Checkout's sign-up: the mail badge and a centred title */}
      <div className="center-col" style={{ padding: "2px 0 0" }}>
        {/* <Raw> (a span), so the wallet's .badge>svg sizing doesn't stretch the 20px icon */}
        <div className="badge" style={{ width: "44px", height: "44px", background: "var(--brand-50)", color: "var(--brand-600)" }}>
          <Raw html={WICON.mail.replace(/width="15" height="15"/, 'width="20" height="20"')} />
        </div>
      </div>
      <div className="step-title" style={{ textAlign: "center" }}>Confirm this device</div>
      {/* NEW copy */}
      <p className="step-sub" style={{ textAlign: "center" }}>It&apos;s the first time money moves from this device. We sent a code to your email.</p>
      <div className="id-summary">
        <span className="id-ic"><Raw html={WICON.mail} /></span>
        <span className="id-val" id="deviceEmail">{maskEmail(email)}</span>
      </div>
      <label className="lbl">Enter the 6-digit code we sent you</label>
      <CodeBoxes onComplete={deviceCode} />
      <div style={{ textAlign: "center" }}>
        <span className="btn-ghost" id="deviceResend" role="button" tabIndex={0} onClick={() => useWalletToast.getState().showToast("Code sent again")}>Resend code</span>
      </div>
    </>
  );
}

/** Checkout's Otp: six boxes that verify themselves once full; paste fills all six; a wrong code clears them. */
function CodeBoxes({ onComplete }: { onComplete: (code: string) => Promise<void> }) {
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
      <div className="otp" id="deviceOtp" onPaste={(e) => {
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
      <div className={`otp-status ${status.err ? "err" : ""}`} id="deviceStatus" role="status" aria-live="polite">
        {status.busy && <span className="mini-spin" />}{status.text}
      </div>
    </>
  );
}
