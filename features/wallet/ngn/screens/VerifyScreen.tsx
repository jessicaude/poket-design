"use client";
import { StepUpIntro } from "../../StepUpIntro";
import { useNgn } from "../useNgn";

/**
 * 'verify': Tier 0 tapping the NGN balance's "Get NGN account details". The wallet's step-up (tStepupIntro), with the
 * reference's reason from tVa's 'locked' stage. Continue stands in for verification (not ported): Tier 1, then the
 * account choice. Cancel returns to the balance.
 */
export function VerifyScreen() {
  const { tier, back, verifyContinue } = useNgn();
  return <StepUpIntro current={tier} target={1}
    reason="Account details are in your verified name, so we need to confirm who you are."
    onCancel={back} onContinue={verifyContinue} />;
}
