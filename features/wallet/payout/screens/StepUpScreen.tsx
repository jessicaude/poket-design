"use client";
import { useNgn } from "../../ngn/useNgn";
import { StepUpIntro } from "../../StepUpIntro";
import { STEP_UP_PLACEHOLDER } from "../payoutMath";
import { usePayout } from "../usePayout";

/**
 * 'stepup': the reference's tStepupIntro, shown before the PIN for amounts over ₦[step-up]. A placeholder: the limit
 * is the ₦[step-up] placeholder, and Continue goes on to the PIN in place of the verification steps.
 */
export function StepUpScreen() {
  const { back, toPin } = usePayout();
  const tier = useNgn((s) => s.tier);
  return <StepUpIntro current={tier} target={tier + 1} limit={STEP_UP_PLACEHOLDER} onCancel={back} onContinue={toPin} />;
}
