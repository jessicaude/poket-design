import { create } from "zustand";
import { GEO_COUNTRY } from "@/lib/mock-api";
import { useAccount } from "@/store/account";
import { useEvents } from "@/store/events";
import { idShowsUnder18, underAgeByDob, usesSsn, type IdentityDetails } from "@/features/auth/identity";
import { useNgn, type Tier } from "../ngn/useNgn";
import { signOutWallet } from "../session";
import { useOnboarding } from "../onboarding/useOnboarding";

/**
 * The wallet's Tier 1 identity verification, from the step-up (StepUpIntro at Tier 0). The reference's KYC: "Verify
 * your identity" (tKycDetails, the screen Checkout shares: features/auth/IdentityDetailsForm.tsx), then the ID
 * check's handoff (Checkout's vendor screen: Plaid's selfie with a US SSN, else Veriff's ID and selfie; demo bar: Open
 * on phone, Finish on phone), "Checking your ID", and "Identity verified" (tOnboardVerified) at Tier 1.
 *
 * Under 18 by the date of birth given (or the demo's "Under 18 at date of birth"): age-blocked. An ID that shows under
 * 18 (a last name containing "minor", or the demo's "ID shows under 18"): doc-age-blocked. Both keep the block on the
 * account and sign the wallet out to the blocked screen (onboarding), as the reference leaves no usable account. The
 * demo's other ID check outcomes (review, retry, declined, sanctions) are Checkout's; here the ID check passes.
 */
export type IdentityStage = "details" | "vendor" | "verifying" | "verified";

/** "Checking your ID" (Checkout's 1.4 s). */
export const ID_CHECK_MS = 1400;

type State = {
  stage: IdentityStage | null;
  det: IdentityDetails | null;
  /** The handoff moved to the phone (Continue on your phone). */
  phone: boolean;
  /** What the step-up does once verified (its Continue). */
  onDone: (() => void) | null;
  start: (onDone: () => void) => void;
  submit: (det: IdentityDetails) => void;
  /** Back from the handoff to the details. */
  back: () => void;
  openOnPhone: () => void;
  finishOnPhone: () => void;
  /** "Identity verified": Continue. */
  done: () => void;
  reset: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;
const CLEAR = { stage: null, det: null, phone: false, onDone: null };

/** Under 18: kept on the account (Checkout won't take its payments either), then signed out to the blocked screen. */
function blockForAge(reason: "age" | "doc_age") {
  useAccount.getState().update((a) => ({ ...a, idBlocked: reason }));
  useEvents.getState().emit("user.blocked", { widget: "wallet", reason });
  useIdentity.getState().reset();
  signOutWallet();
  useOnboarding.setState({ screen: reason === "age" ? "age-blocked" : "doc-age-blocked" });
}

export const useIdentity = create<State>((set, get) => ({
  ...CLEAR,
  start: (onDone) => {
    const a = useAccount.getState().account;
    set({ stage: "details", phone: false, onDone,
      det: { first: a?.first ?? "", last: a?.last ?? "", country: a?.country ?? GEO_COUNTRY, d: "", m: "", y: "", ssn: "", noSsn: false } });
  },
  submit: (det) => {
    useAccount.getState().update((a) => ({ ...a, first: det.first, last: det.last, country: det.country }));
    if (underAgeByDob(det)) { blockForAge("age"); return; }
    set({ det, stage: "vendor", phone: false });
  },
  back: () => set({ stage: "details", phone: false }),
  openOnPhone: () => set({ phone: true }),
  finishOnPhone: () => {
    set({ stage: "verifying" });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { stage, det } = get();
      if (stage !== "verifying" || !det) return;
      // The ID passed: its date of birth is what counts now (computeDocDob)
      if (idShowsUnder18(det.last)) { blockForAge("doc_age"); return; }
      useAccount.getState().update((a) => ({ ...a, tier: Math.max(a.tier, 1) as 1 | 2 }));
      useNgn.getState().set({ tier: Math.max(useNgn.getState().tier, 1) as Tier });
      useEvents.getState().emit("user.verified", { widget: "wallet", tier: 1 });
      set({ stage: "verified" });
    }, ID_CHECK_MS);
  },
  done: () => { const f = get().onDone; set(CLEAR); f?.(); },
  reset: () => { if (timer) { clearTimeout(timer); timer = null; } set(CLEAR); },
}));

/** The handoff's vendor: Plaid's selfie for a US SSN, else Veriff. */
export const plaidFor = (det: IdentityDetails | null) => !!det && usesSsn(det);
