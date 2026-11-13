"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { VendorHandoff } from "@/features/checkout/screens/IdentityScreens";
import { NGN_MAX_ATTEMPTS, useNgn } from "../../ngn/useNgn";
import { BackRow } from "../parts";
import { usePayout } from "../usePayout";

/**
 * The selfie check before a send's PIN, in place of the step-up placeholder: over ₦[step-up] (STEP_UP_DEMO_USD_CENTS)
 * or when the demo's "Flag as unusual" is on. Checkout's identity screens: the vendor handoff (Plaid's selfie, the QR
 * code, then "Continue on your phone"; demo bar: Open on phone, Finish on phone) and "Checking your ID".
 */
export function SelfieScreen() {
  const { selfiePhone, selfieCancel } = usePayout();
  return (
    <>
      <BackRow id="selfieCancel" label="Cancel" onClick={selfieCancel} />
      <VendorHandoff plaid phone={selfiePhone} />
    </>
  );
}

/** SCREENS['verifying'] (Checkout), in the wallet's classes. */
export function SelfieCheckingScreen() {
  return (
    <div className="center-col" style={{ paddingTop: "40px" }}>
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Checking your ID</div>
    </div>
  );
}

/**
 * A failed selfie check with tries left (of the 3 ID check attempts). Needs retry: Checkout's retry screen (tVfRetry)
 * with the reference's selfie reasons. Declined: Checkout's "We couldn’t verify your identity", here with tries left.
 */
export function SelfieRetryScreen() {
  const { selfieFail, selfieTryAgain, selfieCancel } = usePayout();
  const attempts = useNgn((s) => s.attempts);
  const left = NGN_MAX_ATTEMPTS - attempts;
  if (!selfieFail) return null;
  const declined = selfieFail.kind === "declined";
  return (
    <>
      <div className="center-col" style={{ paddingTop: "22px" }}>
        <div className="check-circle" style={declined ? { background: "var(--err-50)", color: "var(--err-600)" } : { background: "var(--warn-50, #FFF7E6)", color: "var(--warn-600, #B45309)" }}>
          <Raw html={declined ? WICON.closeIc : WICON.alert} />
        </div>
        <div className="step-title">{declined ? "We couldn’t verify your identity" : "We couldn’t read your ID"}</div>
        {!declined && <p className="step-sub" id="selfieReason">{selfieFail.reason}</p>}
        <p className="step-sub" id="selfieTriesLeft" style={{ fontSize: "12px", marginTop: "-4px" }}>{left} {left === 1 ? "try" : "tries"} left</p>
      </div>
      <button className="btn-primary" id="selfieTryAgain" onClick={selfieTryAgain}>Try again</button>
      <div style={{ textAlign: "center", marginTop: "12px" }}><span className="btn-ghost" id="selfieLater" role="button" tabIndex={0} onClick={selfieCancel}>Finish later</span></div>
    </>
  );
}
