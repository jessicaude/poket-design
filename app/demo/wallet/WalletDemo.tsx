"use client";
import { useState } from "react";
import { WalletShell, type WalletTab } from "@/features/wallet/WalletShell";

export function WalletDemo({ css }: { css: string }) {
  const [tab, setTab] = useState<WalletTab>("home");
  return <WalletShell css={css} tab={tab} onTab={setTab} />;
}
