"use client";
import { useEffect, useState } from "react";
import { WalletShell, type WalletTab } from "@/features/wallet/WalletShell";
import { NgnDemoBar } from "@/components/demo/NgnDemoBar";
import { isNgnStage, useNgn } from "@/features/wallet/ngn/useNgn";

/** The body is the current NGN screen. Open one with ?ngn=<stage>, e.g. /demo/wallet?ngn=deposit-method. */
export function WalletDemo({ css }: { css: string }) {
  const [tab, setTab] = useState<WalletTab>("home");
  const open = useNgn((s) => s.open);
  useEffect(() => {
    // Demo/test hook: e2e tests set NGN state (tier, dedicated account...) through window.__ngn.
    (window as unknown as { __ngn: typeof useNgn }).__ngn = useNgn;
    const s = new URLSearchParams(window.location.search).get("ngn");
    if (isNgnStage(s)) open(s);
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
