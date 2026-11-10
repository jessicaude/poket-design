"use client";
import { useEffect } from "react";
import { WalletShell } from "@/features/wallet/WalletShell";
import { useWalletHome } from "@/features/wallet/home/homeData";
import { NgnDemoBar } from "@/components/demo/NgnDemoBar";
import { isNgnStage, useNgn } from "@/features/wallet/ngn/useNgn";
import { isPayoutStage, usePayout } from "@/features/wallet/payout/usePayout";
import { useWithdrawals } from "@/features/wallet/payout/useWithdrawals";
import { useWalletNav } from "@/features/wallet/useWalletNav";
import { isConvertStage, useConvert } from "@/features/wallet/convert/useConvert";
import { useHoldings } from "@/features/wallet/useHoldings";

/**
 * The body is the open payout or NGN screen, else the NGN balance with Withdraw (WalletBody).
 * Open a screen with ?ngn=<stage> (e.g. ?ngn=deposit-method), ?payout=<stage> (e.g. ?payout=recipient) or
 * ?convert=<stage> (e.g. ?convert=form).
 */
export function WalletDemo({ css }: { css: string }) {
  // The tab bar: Wallet (home) and Activity; Card isn't ported, so it keeps the home.
  const tab = useWalletHome((s) => s.tab);
  const setTab = (t: "home" | "card" | "activity") => { useWalletNav.getState().home(); useWalletHome.getState().set({ tab: t }); };
  const open = useNgn((s) => s.open);
  useEffect(() => {
    // Demo/test hooks: e2e tests set state (tier, dedicated account, PIN...) through window.__ngn and window.__payout.
    Object.assign(window, { __ngn: useNgn, __payout: usePayout, __withdrawals: useWithdrawals, __nav: useWalletNav, __convert: useConvert, __holdings: useHoldings, __home: useWalletHome });
    const q = new URLSearchParams(window.location.search);
    const s = q.get("ngn"), p = q.get("payout"), c = q.get("convert");
    if (isNgnStage(s)) open(s);
    if (isPayoutStage(p)) { usePayout.getState().open("NGN"); usePayout.getState().go(p); }
    if (isConvertStage(c)) { useConvert.getState().start(); useConvert.setState({ stage: c }); }
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
