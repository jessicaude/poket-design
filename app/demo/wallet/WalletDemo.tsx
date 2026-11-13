"use client";
import { useEffect } from "react";
import { WalletShell } from "@/features/wallet/WalletShell";
import { useWalletHome } from "@/features/wallet/home/homeData";
import { NgnDemoBar } from "@/components/demo/NgnDemoBar";
import { RecipientActivityPanel } from "@/components/demo/RecipientActivityPanel";
import { EventsPanel } from "@/components/demo/EventsPanel";
import { useEvents } from "@/store/events";
import { isNgnStage, useNgn } from "@/features/wallet/ngn/useNgn";
import { isPayoutStage, usePayout } from "@/features/wallet/payout/usePayout";
import { useWithdrawals } from "@/features/wallet/payout/useWithdrawals";
import { useWalletNav } from "@/features/wallet/useWalletNav";
import { isConvertStage, useConvert } from "@/features/wallet/convert/useConvert";
import { useHoldings } from "@/features/wallet/useHoldings";
import { isSendStage, useSend } from "@/features/wallet/send/useSend";
import { useSettings } from "@/features/wallet/settings/useSettings";

/**
 * The body is the open flow (Send, NGN, Convert), else the wallet home (WalletBody).
 * Open a screen with ?ngn=<stage> (e.g. ?ngn=deposit-method), ?convert=<stage> (e.g. ?convert=form) or
 * ?send=<stage>: a Send stage (e.g. ?send=recipients), or a later step of a send to Ngozi Eze (e.g. ?send=review;
 * ?send=ngn-account opens a new Nigerian bank account).
 */
export function WalletDemo({ css }: { css: string }) {
  // The tab bar: Wallet (home) and Activity; Card isn't ported, so it keeps the home.
  const tab = useWalletHome((s) => s.tab);
  const setTab = (t: "home" | "card" | "activity") => { useWalletNav.getState().home(); useWalletHome.getState().set({ tab: t }); };
  const open = useNgn((s) => s.open);
  // The header gear: Settings (the reference's go('settings')), in place of any open flow
  const openSettings = () => {
    useSend.getState().close(); usePayout.getState().close(); useConvert.getState().close(); useNgn.getState().close();
    useWalletNav.getState().home(); useWalletNav.getState().push({ name: "settings" });
  };
  useEffect(() => {
    // Demo/test hooks: e2e tests set state (tier, dedicated account, PIN...) through window.__ngn and window.__payout.
    Object.assign(window, { __ngn: useNgn, __payout: usePayout, __withdrawals: useWithdrawals, __nav: useWalletNav, __convert: useConvert, __holdings: useHoldings, __send: useSend, __home: useWalletHome, __settings: useSettings, __events: useEvents });
    const q = new URLSearchParams(window.location.search);
    const s = q.get("ngn"), c = q.get("convert"), sd = q.get("send");
    if (isNgnStage(s)) open(s);
    if (isConvertStage(c)) { useConvert.getState().start(); useConvert.setState({ stage: c }); }
    if (isSendStage(sd)) { useSend.getState().open(); useSend.setState({ stage: sd }); }
    if (isPayoutStage(sd)) {
      // Every send starts in Send; later steps preview a send to a saved recipient (Ngozi Eze).
      useSend.getState().open();
      useSend.getState().choose(useSend.getState().recipients.find((r) => r.id === "bank:r6")!);
      if (sd === "ngn-account") usePayout.getState().sendToNewBank(); else usePayout.getState().go(sd);
    }
  }, [open]);
  // The prototype bar is fixed at the top: --pk-bar tells the wallet's stage to leave room for it, as in the reference.
  return (
    <>
      <NgnDemoBar />
      <div style={{ paddingTop: "var(--bar)", ["--pk-bar" as string]: "var(--bar)" }}>
        <WalletShell css={css} tab={tab} onTab={setTab} onSettings={openSettings} />
      </div>
      <RecipientActivityPanel />
      {/* What the merchant hosting the wallet receives (e.g. account.locked); bottom right, clear of the wallet */}
      <EventsPanel host="the merchant" style={{ right: "16px" }} />
    </>
  );
}
