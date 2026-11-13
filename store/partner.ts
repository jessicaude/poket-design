import { create } from "zustand";
import { setNairaPartnerAvailable, type Withdrawal } from "@/lib/mock-api";
import type { Kobo } from "@/lib/money";

/**
 * WGT-13, partner downtime: the naira partner (Nigerian bank rails) is up or down. Shared by the wallet and Checkout
 * (both demo bars have "Naira partner: Up / Down"). While down, naira bank transfers are paused: no deposits by bank
 * transfer or new account details, no sends to Nigerian banks (and no name enquiry), sends already Sending stay
 * Sending, and Checkout's naira bank transfer is marked Paused. Poket users, Convert, cards and balances still work.
 */
type State = {
  down: boolean;
  setDown: (down: boolean) => void;
  /** Transfers into naira that arrived while down (kobo): credited when the partner is back (wallet partnerRecovery). */
  queued: Kobo[];
  /** Demo "Transfer arrived while down". */
  queueArrival: (amount: Kobo) => void;
  /** The queued credits, emptying the queue. */
  takeQueued: () => Kobo[];
};
export const useNairaPartner = create<State>((set, get) => ({
  down: false,
  setDown: (down) => { setNairaPartnerAvailable(!down); set({ down }); },
  queued: [],
  queueArrival: (amount) => set((s) => ({ queued: [...s.queued, amount] })),
  takeQueued: () => { const q = get().queued; set({ queued: [] }); return q; },
}));
/** The demo's delayed transfer: ₦25,000.00. */
export const QUEUED_ARRIVAL_DEMO_KOBO: Kobo = 2500000;


/** A send to a Nigerian bank: while the partner is down, one already Sending stays Sending. */
export const toNigerianBank = (w: Pick<Withdrawal, "kind" | "currency">) => w.kind === "bank" && w.currency === "NGN";
