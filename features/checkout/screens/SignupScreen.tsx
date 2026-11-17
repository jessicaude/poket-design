"use client";
import { SignupForm } from "@/features/auth/SignupForm";
import { useCheckout } from "../useCheckout";

/** SCREENS['signup'] (features/auth/SignupForm.tsx, shared with the wallet), prefilled with the details the store shared. */
export function SignupScreen() {
  const { order, signedUp, loggedIn, showToast, locked } = useCheckout();
  const c = order?.customer;
  return (
    <SignupForm widget="checkout" prefill={c} showToast={showToast} onLocked={locked}
      onVerified={(r) => {
        if ("account" in r) loggedIn(r.account);
        else signedUp({ ...r.details, tier: 0, methods: [], payments: [] });
      }} />
  );
}
