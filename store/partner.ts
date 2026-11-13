import { create } from "zustand";
import { setNairaPartnerAvailable, type Withdrawal } from "@/lib/mock-api";

/**
 * WGT-13, partner downtime: the naira partner (Nigerian bank rails) is up or down. Shared by the wallet and Checkout
 * (both demo bars have "Naira partner: Up / Down"). While down, naira bank transfers are paused: no deposits by bank
 * transfer or new account details, no sends to Nigerian banks (and no name enquiry), sends already Sending stay
 * Sending, and Checkout's naira bank transfer is marked Paused. Poket users, Convert, cards and balances still work.
 */
type State = { down: boolean; setDown: (down: boolean) => void };
export const useNairaPartner = create<State>((set) => ({
  down: false,
  setDown: (down) => { setNairaPartnerAvailable(!down); set({ down }); },
}));

/** Resolves once the partner is up (at once if it already is). */
export function partnerUp(): Promise<void> {
  if (!useNairaPartner.getState().down) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useNairaPartner.subscribe((s) => { if (!s.down) { unsub(); resolve(); } });
  });
}

/** A send to a Nigerian bank: while the partner is down, one already Sending stays Sending. */
export const toNigerianBank = (w: Pick<Withdrawal, "kind" | "currency">) => w.kind === "bank" && w.currency === "NGN";
