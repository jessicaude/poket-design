"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { LOCK_COPY, fmtLockLeft, useAccountLock, useLockLeft } from "@/store/lock";
import { useEffect } from "react";
import { useCheckout } from "../useCheckout";

/**
 * "Account locked" in Checkout (NEW): too many wrong sign-up or log-in codes (counted with the wallet's device
 * codes). A live countdown; when it ends (or the demo's "Skip lock time"), back to signing in. Checkout's blocked
 * screen layout (center, badge err, title, sub, a quiet button back to the merchant).
 */
export function LockedScreen() {
  const { order, close, unlocked } = useCheckout();
  const until = useAccountLock((s) => s.until);
  const left = useLockLeft();
  useEffect(() => { if (until === null) unlocked(); }, [until, unlocked]);
  if (!order) return null;
  return (
    <>
      <div className="center" id="accountLocked">
        <div className="badge err"><Raw html={WICON.lockIc.replace(/width="16" height="16"/, 'width="22" height="22"')} /></div>
        <h2 className="title">{LOCK_COPY.title}</h2>
        <p className="sub">{LOCK_COPY.body}</p>
        <p className="title mono" id="lockCountdown" role="timer" style={{ fontSize: "24px", margin: "4px 0 18px" }}>{fmtLockLeft(left)}</p>
      </div>
      <button className="btn quiet" id="lockedBack" onClick={() => close("locked")}>Back to {order.merchant}</button>
    </>
  );
}
