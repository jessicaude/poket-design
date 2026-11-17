"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useAccount } from "@/store/account";
import { maskAccount } from "@/features/auth/identifier";
import { useWalletToast } from "../../useWalletToast";
import { BackRow } from "../parts";
import { CodeBoxes } from "@/features/auth/CodeBoxes";
import { usePayout } from "../usePayout";

/**
 * WGT-10 'device': "Confirm this device", the first time money moves on a new device (a send, or turning on instant
 * transfers). The code entry is Checkout's sign-up design (SignupScreen: id-summary, "Enter the 6-digit code we sent
 * you", six boxes that verify themselves, Resend code); its classes are copied into styles/wallet-overrides.css.
 * A correct code binds the device and the action carries on; 000000 is a wrong code in the demo.
 */

export function DeviceScreen() {
  const { deviceCode, cancelDevice } = usePayout();
  const account = useAccount((s) => s.account);
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
      <p className="step-sub" style={{ textAlign: "center" }}>It&rsquo;s the first time money moves from this device. {account && !account.email.trim() ? "We texted a code to your phone." : "We sent a code to your email."}</p>
      <div className="id-summary">
        <span className="id-ic"><Raw html={WICON.mail} /></span>
        <span className="id-val" id="deviceEmail">{account ? maskAccount(account) : maskAccount({ email: "ada@osun.co" })}</span>
      </div>
      <label className="lbl">Enter the 6-digit code we sent you</label>
      <CodeBoxes id="deviceOtp" statusId="deviceStatus" onComplete={deviceCode} />
      <div style={{ textAlign: "center" }}>
        <span className="btn-ghost" id="deviceResend" role="button" tabIndex={0} onClick={() => useWalletToast.getState().showToast("Code sent again")}>Resend code</span>
      </div>
    </>
  );
}
