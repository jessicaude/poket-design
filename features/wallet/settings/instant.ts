import { getInstantSentToday, type PayoutRecipient } from "@/lib/mock-api";
import { useNgn } from "../ngn/useNgn";
import { effectiveLimit } from "./useSettings";
import { usePayout } from "../payout/usePayout";
import { useSend } from "../send/useSend";
import { useWalletNav } from "../useWalletNav";
import { useWalletToast } from "../useWalletToast";
import { useSettings } from "./useSettings";

/**
 * WGT-09: turning instant transfers on asks for the PIN (created first if there isn't one), then confirms; from the
 * Settings screen or the amount screen's "Turn on" (the send comes back as it was).
 */
export function turnOnInstantTransfers() {
  usePayout.getState().approveWithPin("Turns on instant transfers.", () => {
    useSettings.getState().setInstantOn(true);
    useWalletToast.getState().showToast("Instant transfers are on.");
  });
}

/**
 * While instant transfers are off, sends to Nigerian bank accounts don't go: naira to a Nigerian bank, whatever pays
 * it. Poket users, other banks, cards, wallets, Convert and Checkout aren't affected.
 */
export const blockedByInstantOff = (r: PayoutRecipient | null, instantOn: boolean) =>
  !instantOn && !!r && r.methodType === "bank" && r.currency === "NGN";

/**
 * The daily limit in Send (WGT-09): a send to a Nigerian bank can't take today's total over the limit. `cents` is the
 * naira the bank would receive. Returns null when it fits (or the send isn't to a Nigerian bank).
 */
export function overDailyLimit(r: PayoutRecipient | null, cents: number): { limit: number; left: number } | null {
  if (!r || r.methodType !== "bank" || r.currency !== "NGN") return null;
  const { instantLimit } = useSettings.getState();
  const limit = effectiveLimit(instantLimit, useNgn.getState().tier);
  const left = Math.max(0, limit - getInstantSentToday());
  return cents > left ? { limit, left } : null;
}

/** The amount screen's "Change limit": leave the send for Settings → Instant transfers → Daily limit. */
export function openDailyLimit() {
  usePayout.getState().close();
  useSend.getState().close();
  const nav = useWalletNav.getState();
  nav.home();
  nav.push({ name: "settings" });
  nav.push({ name: "instant-transfers" });
  nav.push({ name: "instant-limit" });
}
