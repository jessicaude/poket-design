import { create } from "zustand";
import { GEO_COUNTRY, findAccount, registerAccount, verifyCode } from "@/lib/mock-api";
import { handleCodeError } from "@/store/lock";
import { useEvents } from "@/store/events";
import { signInWallet } from "../session";

/**
 * The wallet's onboarding, from reference/poket-unified.html: the welcome screen (Sign Up, Log In), sign-up's name,
 * email and terms (onboard-email), the 6-digit email code (onboard-phone-otp, with Checkout's code entry), the location
 * check (onboard-geo, onboard-geo-blocked) and the age check (onboard-age, age-blocked); log in (onboard-login, the same
 * code, login-geo, login-geo-blocked). A new account is made only once both checks pass: Tier 0, empty balances, on the
 * wallet home. Accounts are the shared directory (lib/mock-api.ts), so Checkout's accounts log in here and back.
 */
export type OnboardScreen =
  | "onboard-welcome" | "onboard-email" | "onboard-login" | "onboard-phone-otp"
  | "onboard-geo" | "onboard-geo-blocked" | "onboard-age" | "age-blocked"
  | "login-geo" | "login-geo-blocked";

/** The reference's MIN_AGE. */
export const MIN_AGE = 18;
/** How long the location check takes (the reference's 1100 ms). */
export const GEO_CHECK_MS = 1100;

const FORM = {
  email: "", first: "", last: "", terms: false, loginEmail: "", notice: null as string | null, preVerified: null as string | null,
  dobMonth: "", dobDay: "", dobYear: "", ageConfirmed: false,
};
type Form = typeof FORM;

type State = Form & {
  screen: OnboardScreen;
  /** Whose code the code screen checks: sign-up's email or log-in's. */
  mode: "signup" | "login";
  /** Demo bar "Location: Not supported": the next location check fails (the reference's simulateGeoBlock). */
  geoBlocked: boolean;
  set: (p: Partial<Form & { geoBlocked: boolean }>) => void;
  go: (screen: OnboardScreen) => void;
  /** Sign Up: the code is sent (or, for an email confirmed at log-in, straight to the checks). */
  signUp: () => void;
  /** Send passcode (log in). */
  sendLoginCode: () => void;
  /** The code screen's 6 digits; throws the message to show for a wrong code. */
  verify: (code: string) => Promise<void>;
  /** Confirm your age: Continue. */
  ageContinue: () => void;
  /** "Back to start": the welcome screen, with sign-up's answers cleared. */
  backToStart: () => void;
};

const norm = (v: string) => v.trim().toLowerCase();
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
  /** Log in to an account that exists: the location is checked each time, then the wallet home. */
  const logIn = (email: string) => geoCheck("login-geo", () => { signInWallet(email); set({ ...FORM, screen: "onboard-welcome" }); });

  return {
    ...FORM,
    screen: "onboard-welcome",
    mode: "signup",
    geoBlocked: false,
    set: (p) => set(p),
    go: (screen) => {
      // Leaving sign-up for log in drops the notice (goLoginFromSignup)
      set(screen === "onboard-login" ? { screen, notice: null } : { screen });
    },
    signUp: () => {
      const s = get();
      if (s.preVerified && s.preVerified === norm(s.email)) {
        set({ preVerified: null, notice: null, mode: "signup" });
        geoCheck("onboard-geo", () => set({ screen: "onboard-age" }));
        return;
      }
      set({ mode: "signup", screen: "onboard-phone-otp" });
    },
    sendLoginCode: () => set({ mode: "login", screen: "onboard-phone-otp" }),
    verify: async (code) => {
      // Wrong codes count with Checkout's and the device codes; too many lock the account (the code screen shows it)
      try { await verifyCode(code); }
      catch (e) { if (handleCodeError(e, "wallet")) return; throw e; }
      const s = get();
      const email = s.mode === "login" ? s.loginEmail : s.email;
      if (findAccount(email)) { logIn(email); return; }
      if (s.mode === "login") {
        // No account yet: the email is confirmed, so sign-up only asks for the rest (the reference's signupNotice)
        set({ screen: "onboard-email", mode: "signup", email: email.trim(), preVerified: norm(email),
          notice: "No Poket account uses this email yet. You’ve confirmed it, so just accept the terms to create your account." });
        return;
      }
      geoCheck("onboard-geo", () => set({ screen: "onboard-age" }));
    },
    ageContinue: () => {
      const s = get();
      const age = ageFromDob(parseInt(s.dobYear, 10), parseInt(s.dobMonth, 10), parseInt(s.dobDay, 10));
      if (!(age >= MIN_AGE)) { set({ screen: "age-blocked" }); return; }
      // Both checks passed: the account exists now (Tier 0), shared with Checkout
      const email = s.email.trim();
      registerAccount({ email, first: s.first.trim(), last: s.last.trim(), tier: 0, country: GEO_COUNTRY, methods: [], payments: [] });
      useEvents.getState().emit("user.account_created", { widget: "wallet" });
      signInWallet(email);
      set({ ...FORM, screen: "onboard-welcome" });
    },
    backToStart: () => {
      if (geoTimer) { clearTimeout(geoTimer); geoTimer = null; }
      set({ ...FORM, screen: "onboard-welcome" });
    },
  };
});
