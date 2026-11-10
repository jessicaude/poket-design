"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { NGN_MAX_ATTEMPTS, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/** tVaNgn stage 'ngnLocked': all attempts (shared with Veriff) used. A temporary account still works. */
export function NgnLockedScreen() {
  const go = useNgn((s) => s.go);
  return (
    <>
      <VaBack />
      <div className="center-col" style={{ paddingTop: "20px" }}>
        <div className="check-circle" style={{ background: "var(--err-50)", color: "var(--err-600)" }}><Raw html={WICON.lockIc} /></div>
        <div className="step-title">We couldn&apos;t confirm your ID</div>
        <p className="step-sub">You&apos;ve used all {NGN_MAX_ATTEMPTS} attempts. Contact support to continue. You can still add naira with a temporary account.</p>
      </div>
      <a className="btn-secondary vf-support" href="https://poketwallet.com/support" target="_blank" rel="noopener">Contact support</a>
      <div style={{ textAlign: "center", marginTop: "12px" }}>
        <button type="button" className="btn-ghost" id="ngnUseTemp" onClick={() => go("tempAmount")}>Use a temporary account</button>
      </div>
    </>
  );
}
