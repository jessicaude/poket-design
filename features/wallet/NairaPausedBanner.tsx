"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { usePayout, type PayoutStage } from "./payout/usePayout";
import type { NgnStage } from "./ngn/useNgn";
import { useSettings } from "./settings/useSettings";

/**
 * WGT-13, partner downtime: while the naira partner is down (demo bar "Naira partner: Up / Down"), this banner tops
 * the wallet home, the NGN balance screen and the naira screens that move naira by bank transfer. It goes as soon as
 * the partner is back. The wallet's .alert warn style.
 */
export function NairaPausedBanner() {
  const down = useSettings((s) => s.nairaPartnerDown);
  if (!down) return null;
  return (
    <div className="alert warn" id="nairaPaused" role="status">
      <Raw html={WICON.alert} />
      <span>Naira bank transfers are paused. Your balance is safe, and sending to Poket users, converting and card payments still work.</span>
    </div>
  );
}

/** Deposit stages that bring naira in by bank transfer (not ID checks or results). */
export const NGN_PAUSED_STAGES: readonly NgnStage[] = ["deposit-method", "ngnChoice", "tempAmount", "tempCreating", "temp", "tempExpired", "intro", "creating", "details"];

/** Send stages for a Nigerian bank: adding one, and the amount and review of a send to one. */
export function payoutPausedStage(stage: PayoutStage | null): boolean {
  if (stage === "ngn-account" || stage === "ngn-bank") return true;
  if (stage !== "amount" && stage !== "review") return false;
  const r = usePayout.getState().recipient;
  return !!r && r.methodType === "bank" && r.currency === "NGN";
}
