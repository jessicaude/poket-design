import { create } from "zustand";
import { GEO_COUNTRY, accountKey, registerAccount } from "@/lib/mock-api";
import type { Account } from "@/store/account";
import { useEvents } from "@/store/events";
import type { SignupDetails, SignupResult } from "@/features/auth/SignupForm";
import { signInWallet } from "../session";

/**
 * The wallet's onboarding. The welcome screen (Sign Up, Log In) is reference/poket-unified.html's tOnboardWelcome. Both
 * buttons open Checkout's sign-up screen (reference/poket-widgets.html SCREENS['signup'], features/auth/SignupForm.tsx):
 * the email or phone, legal name and terms, and the 6-digit code in place. An email or phone that already has an
 * account logs in there. After the code, a new account gets the location check (onboard-geo, onboard-geo-blocked) and
 * is made once it passes: Tier 0, empty balances, on the wallet home. The date of birth is asked for at identity
 * verification (features/wallet/identity), not here. Logging in checks the location each time (login-geo,
 * login-geo-blocked). Accounts are the shared directory (lib/mock-api.ts), so Checkout's accounts log in here and back.
 *
 * Identity verification signs an under-18 account out to its blocked screen: age-blocked (tAgeBlocked, by the date of
 * birth given) or doc-age-blocked (tDocAgeBlocked, the ID shows under 18). The block stays on the account, so logging
 * back in shows it again.
 */
export type OnboardScreen =
  | "onboard-welcome" | "signup"
  | "onboard-geo" | "onboard-geo-blocked" | "age-blocked" | "doc-age-blocked"
  | "login-geo" | "login-geo-blocked";

/** How long the location check takes (the reference's 1100 ms). */
export const GEO_CHECK_MS = 1100;

const FORM = { pending: null as SignupDetails | null };

type State = typeof FORM & {
  screen: OnboardScreen;
  /** Demo bar "Location: Not supported": the next location check fails (the reference's simulateGeoBlock). */
  geoBlocked: boolean;
  set: (p: { geoBlocked: boolean }) => void;
  go: (screen: OnboardScreen) => void;
  /** The sign-up screen's code was right: log in, or check a new account's location and make it. */
  verified: (r: SignupResult) => void;
  /** "Back to start": the welcome screen, with sign-up's answers cleared. */
  backToStart: () => void;
};

/** An account blocked for its age (Checkout's or the wallet's identity verification): its blocked screen. */
const ageBlockScreen = (a: Pick<Account, "idBlocked">): OnboardScreen | null =>
  a.idBlocked === "age" ? "age-blocked" : a.idBlocked === "doc_age" ? "doc-age-blocked" : null;

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
        const blocked = ageBlockScreen(r.account);
        if (blocked) { set({ ...FORM, screen: blocked }); return; }
        const key = accountKey(r.account);
        geoCheck("login-geo", () => { signInWallet(key); set({ ...FORM, screen: "onboard-welcome" }); });
        return;
      }
      set({ pending: r.details });
      geoCheck("onboard-geo", () => {
        const pending = get().pending;
        if (!pending) return;
        // The location passed: the account exists now (Tier 0), shared with Checkout
        const account = { ...pending, tier: 0 as const, country: GEO_COUNTRY, methods: [], payments: [] };
        registerAccount(account);
        useEvents.getState().emit("user.account_created", { widget: "wallet" });
        signInWallet(accountKey(account));
        set({ ...FORM, screen: "onboard-welcome" });
      });
    },
    backToStart: () => {
      if (geoTimer) { clearTimeout(geoTimer); geoTimer = null; }
      set({ ...FORM, screen: "onboard-welcome" });
    },
  };
});
