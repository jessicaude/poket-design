import { create } from "zustand";
import { DEMO_USER_EMAIL } from "@/lib/mock-api";

/**
 * Who the wallet is signed in as (the reference's POKET.identity.exists / session): Ada, the demo user, by default;
 * null shows onboarding (welcome, sign up, log in). Sign in and out with ./session.ts.
 */
export const useWalletSession = create<{ email: string | null }>(() => ({ email: DEMO_USER_EMAIL }));

/** Whether the wallet is Ada's, the demo user's (her seeded records, such as the reference's S.txns, are hers only). */
export const useIsDemoUser = () => useWalletSession((s) => s.email === DEMO_USER_EMAIL);
