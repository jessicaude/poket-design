import { create } from "zustand";
import { GEO_COUNTRY, accountKey, registerAccount } from "@/lib/mock-api";
import { useEvents } from "@/store/events";
import type { SignupDetails, SignupResult } from "@/features/auth/SignupForm";
import { signInWallet } from "../session";

/**
 * The wallet's onboarding. The welcome screen (Sign Up, Log In) is reference/poket-unified.html's tOnboardWelcome. Both
 * buttons open Checkout's sign-up screen (reference/poket-widgets.html SCREENS['signup'], features/auth/SignupForm.tsx):
 * the email or phone, legal name and terms, and the 6-digit code in place. An email or phone that already has an
 * account logs in there. After the code: for a new account the location check (onboard-geo, onboard-geo-blocked) and
 * the age check (onboard-age, age-blocked), and the account is made only once both pass: Tier 0, empty balances, on
 * the wallet home. Logging in checks the location each time (login-geo, login-geo-blocked). Accounts are the shared
 * directory (lib/mock-api.ts), so Checkout's accounts log in here and back.
 */
export type OnboardScreen =
  | "onboard-welcome" | "signup"
  | "onboard-geo" | "onboard-geo-blocked" | "onboard-age" | "age-blocked"
  | "login-geo" | "login-geo-blocked";

/** The reference's MIN_AGE. */
export const MIN_AGE = 18;
/** How long the location check takes (the reference's 1100 ms). */
export const GEO_CHECK_MS = 1100;

const FORM = { dobMonth: "", dobDay: "", dobYear: "", ageConfirmed: false, pending: null as SignupDetails | null };
type Form = typeof FORM;

type State = Form & {
  screen: OnboardScreen;
  /** Demo bar "Location: Not supported": the next location check fails (the reference's simulateGeoBlock). */
  geoBlocked: boolean;
  set: (p: Partial<Omit<Form, "pending"> & { geoBlocked: boolean }>) => void;
  go: (screen: OnboardScreen) => void;
  /** The sign-up screen's code was right: log in, or check a new account's location and age. */
  verified: (r: SignupResult) => void;
  /** Confirm your age: Continue. */
  ageContinue: () => void;
  /** "Back to start": the welcome screen, with sign-up's answers cleared. */
  backToStart: () => void;
};

/** The reference's ageFromDob. */
export function ageFromDob(y: number, m: number, d: number) {
  const today = new Date();
  let age = today.getFullYear() - y;
  const hadBirthday = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthday) age--;
  return age;
}

let geoTimer: ReturnType<typeof setTimeout> | null = null;

export const useOnboarding = create<State>((set, get) => {
  /** The location check, then `next` (or its blocked screen). */
  const geoCheck = (checking: "onboard-geo" | "login-geo", next: () => void) => {
    set({ screen: checking });
    if (geoTimer) clearTimeout(geoTimer);
    geoTimer = setTimeout(() => {
      geoTimer = null;
      if (get().screen !== checking) return;
      if (get().geoBlocked) { set({ screen: checking === "onboard-geo" ? "onboard-geo-blocked" : "login-geo-blocked" }); return; }
      next();
    }, GEO_CHECK_MS);
  };

  return {
    ...FORM,
    screen: "onboard-welcome",
    geoBlocked: false,
    set: (p) => set(p),
    go: (screen) => set({ screen }),
    verified: (r) => {
      // An account that exists: the location is checked each time, then the wallet home
      if ("account" in r) {
        const key = accountKey(r.account);
        geoCheck("login-geo", () => { signInWallet(key); set({ ...FORM, screen: "onboard-welcome" }); });
        return;
      }
      set({ pending: r.details });
      geoCheck("onboard-geo", () => set({ screen: "onboard-age" }));
    },
    ageContinue: () => {
      const s = get();
      const age = ageFromDob(parseInt(s.dobYear, 10), parseInt(s.dobMonth, 10), parseInt(s.dobDay, 10));
      if (!(age >= MIN_AGE)) { set({ screen: "age-blocked" }); return; }
      if (!s.pending) return;
      // Both checks passed: the account exists now (Tier 0), shared with Checkout
      const account = { ...s.pending, tier: 0 as const, country: GEO_COUNTRY, methods: [], payments: [] };
      registerAccount(account);
      useEvents.getState().emit("user.account_created", { widget: "wallet" });
      signInWallet(accountKey(account));
      set({ ...FORM, screen: "onboard-welcome" });
    },
    backToStart: () => {
      if (geoTimer) { clearTimeout(geoTimer); geoTimer = null; }
      set({ ...FORM, screen: "onboard-welcome" });
    },
  };
});
