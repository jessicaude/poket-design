"use client";
import { NgnBody } from "./ngn/NgnBody";
import { useNgn } from "./ngn/useNgn";
import { NgnBalanceEntry } from "./payout/NgnBalanceEntry";
import { PayoutBody } from "./payout/PayoutBody";
import { usePayout } from "./payout/usePayout";

/** WalletShell's default #panelBody: the open payout or NGN flow, else the home entry (NGN balance + Withdraw). */
export function WalletBody() {
  const payout = usePayout((s) => s.stage);
  const ngn = useNgn((s) => s.stage);
  if (payout) return <PayoutBody />;
  if (ngn) return <NgnBody />;
  return <NgnBalanceEntry />;
}
