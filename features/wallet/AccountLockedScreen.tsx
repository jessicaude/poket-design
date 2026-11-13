"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { LOCK_COPY, fmtLockLeft, useLockLeft } from "@/store/lock";
import { useConvert } from "./convert/useConvert";
import { useNgn } from "./ngn/useNgn";
import { usePayout } from "./payout/usePayout";
import { useSend } from "./send/useSend";
import { useSettings } from "./settings/useSettings";
import { useWalletNav } from "./useWalletNav";
import { useWalletHome } from "./home/homeData";

/**
 * "Account locked" (NEW): too many wrong verification codes (device codes and Checkout's codes, counted together).
 * While locked, money can't move anywhere in the wallet: any open Send, Convert, Deposit or PIN step shows this
 * instead (WalletBody), with a live countdown. When the lock ends (or the demo's "Skip lock time"), the flow is back
 * where it was. Close leaves it.
 */
export function AccountLockedScreen() {
  const left = useLockLeft();
  const close = () => { useSend.getState().close(); usePayout.getState().close(); useConvert.getState().close(); useNgn.getState().close(); };
  return (
    <div className="center-col" style={{ paddingTop: "24px" }} id="accountLocked">
      <div className="check-circle" style={{ background: "var(--err-50)", color: "var(--err-600)" }}><Raw html={WICON.lockIc} /></div>
      <div className="step-title">{LOCK_COPY.title}</div>
      <p className="step-sub">{LOCK_COPY.body}</p>
      <div className="step-title mono" id="lockCountdown" role="timer" aria-live="off" style={{ fontSize: "26px", marginTop: "6px" }}>{fmtLockLeft(left)}</div>
      <button className="btn-secondary" id="lockedClose" style={{ width: "100%", marginTop: "14px" }} onClick={close}>Close</button>
    </div>
  );
}

/**
 * The account's blocked state after the 3rd failed ID check (selfie checks before sends, and NGN ID matches, counted
 * together): money can't move, so any money flow shows this. Copy from Checkout's blocked screen (id_declined).
 */
export function AccountBlockedScreen() {
  const close = () => { useSend.getState().close(); usePayout.getState().close(); useConvert.getState().close(); useNgn.getState().close(); };
  return (
    <div className="center-col" style={{ paddingTop: "24px" }} id="accountBlocked">
      <div className="check-circle" style={{ background: "var(--err-50)", color: "var(--err-600)" }}><Raw html={WICON.closeIc} /></div>
      <div className="step-title">We couldn&apos;t verify your identity</div>
      <p className="step-sub">If you think this is a mistake, contact Poket support.</p>
      <button className="btn-secondary" id="blockedClose" style={{ width: "100%", marginTop: "14px" }} onClick={close}>Close</button>
    </div>
  );
}

/**
 * "Sign in again" (NEW copy; single active device, to confirm: not in the PRD). Another device was bound, which signed
 * this one out: its next tap anywhere in the wallet shows this instead (WalletShell). Signing in starts it over on the
 * wallet home as a new device, so it confirms itself the next time money moves.
 */
export function SignedOutScreen() {
  const signIn = () => {
    useSend.getState().close(); usePayout.getState().close(); useConvert.getState().close(); useNgn.getState().close();
    useWalletNav.getState().home();
    useWalletHome.setState({ tab: "home" });
    useSettings.getState().signBackIn();
  };
  return (
    <div className="center-col" style={{ paddingTop: "24px" }} id="signedOut">
      <div className="check-circle" style={{ background: "var(--n-100)", color: "var(--n-700)" }}><Raw html={WICON.lockIc} /></div>
      <div className="step-title">You&rsquo;ve been signed out</div>
      <p className="step-sub">Your account was signed in on another device. Sign in again to use Poket here.</p>
      <button className="btn-primary" id="signInAgain" style={{ width: "100%", marginTop: "14px" }} onClick={signIn}>Sign in</button>
    </div>
  );
}
