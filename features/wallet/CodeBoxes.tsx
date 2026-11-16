"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Checkout's code entry (features/checkout/screens/SignupScreen.tsx Otp): six boxes that verify themselves once full;
 * paste fills all six; a wrong code clears them and says why. Its classes (.otp, .otp-status, .mini-spin) are copied
 * into styles/wallet-overrides.css. Used by "Confirm this device" and the sign-up and log-in code (onboard-phone-otp).
 */
export function CodeBoxes({ id, statusId, onComplete }: { id: string; statusId: string; onComplete: (code: string) => Promise<void> }) {
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
      <div className="otp" id={id} onPaste={(e) => {
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
      <div className={`otp-status ${status.err ? "err" : ""}`} id={statusId} role="status" aria-live="polite">
        {status.busy && <span className="mini-spin" />}{status.text}
      </div>
    </>
  );
}
