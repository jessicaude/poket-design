"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import type { PayoutStage } from "./payout/usePayout";
import type { NgnStage } from "./ngn/useNgn";
import { useNairaPartner } from "@/store/partner";

/**
 * WGT-13, partner downtime: while the naira partner is down (demo bar "Naira partner: Up / Down"), this banner tops
 * the wallet home, the NGN balance screen and the naira screens that move naira by bank transfer. It goes as soon as
 * the partner is back. The wallet's .alert warn style.
 */
export function NairaPausedBanner() {
  const down = useNairaPartner((s) => s.down);
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

/**
 * Send stages that show the banner: adding a Nigerian bank. A send to one shows only its own "Sending to banks is
 * paused." on the amount and review (SendPausedNotice), as the paused deposit screens show only theirs.
 */
export function payoutPausedStage(stage: PayoutStage | null): boolean {
  return stage === "ngn-account" || stage === "ngn-bank";
}

/** The amount and review of a send to a Nigerian bank while the naira partner is down: why it can't go. */
export function SendPausedNotice({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="alert warn" id="sendPaused" role="note" style={style}>
      <Raw html={WICON.alert} /><span>Sending to banks is paused. Try again later.</span>
    </div>
  );
}
