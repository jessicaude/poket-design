"use client";
import { useEffect, useState } from "react";
import { WalletShell, type WalletTab } from "@/features/wallet/WalletShell";
import { NgnDemoBar } from "@/components/demo/NgnDemoBar";
import { isNgnStage, useNgn } from "@/features/wallet/ngn/useNgn";
import { isPayoutStage, usePayout } from "@/features/wallet/payout/usePayout";
import { useWithdrawals } from "@/features/wallet/payout/useWithdrawals";
import { useWalletNav } from "@/features/wallet/useWalletNav";

/**
 * The body is the open payout or NGN screen, else the NGN balance with Withdraw (WalletBody).
 * Open a screen with ?ngn=<stage> (e.g. ?ngn=deposit-method) or ?payout=<stage> (e.g. ?payout=recipient).
 */
export function WalletDemo({ css }: { css: string }) {
  const [tab, setTab] = useState<WalletTab>("home");
  const open = useNgn((s) => s.open);
  useEffect(() => {
    // Demo/test hooks: e2e tests set state (tier, dedicated account, PIN...) through window.__ngn and window.__payout.
    Object.assign(window, { __ngn: useNgn, __payout: usePayout, __withdrawals: useWithdrawals, __nav: useWalletNav });
    const q = new URLSearchParams(window.location.search);
    const s = q.get("ngn"), p = q.get("payout");
    if (isNgnStage(s)) open(s);
    if (isPayoutStage(p)) { usePayout.getState().open("NGN"); usePayout.getState().go(p); }
  }, [open]);
  // The prototype bar is fixed at the top: --pk-bar tells the wallet's stage to leave room for it, as in the reference.
  return (
    <>
      <NgnDemoBar />
      <div style={{ paddingTop: "var(--bar)", ["--pk-bar" as string]: "var(--bar)" }}>
        <WalletShell css={css} tab={tab} onTab={setTab} />
      </div>
    </>
  );
}
