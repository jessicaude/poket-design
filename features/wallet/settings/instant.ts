import type { PayoutRecipient } from "@/lib/mock-api";
import { usePayout } from "../payout/usePayout";
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
