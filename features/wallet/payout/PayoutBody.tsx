"use client";
import type { ComponentType } from "react";
import { usePayout, type PayoutStage } from "./usePayout";
import { ReviewScreen } from "./screens/AmountReviewScreens";
import { PinLockedScreen, PinResetOtpScreen, PinScreen, PinUpdatedScreen } from "./screens/PinScreens";
import { DoneScreen, ProcessingScreen } from "./screens/ProcessingDoneScreens";
import { NgnAccountScreen, NgnBankScreen } from "./screens/NgnAccountScreens";
import { StepUpScreen } from "./screens/StepUpScreen";
import { AddressScreeningBlockedScreen, AddressScreeningScreen, PayFromScreen, SendAmountScreen } from "../send/SendAmountScreens";

/** One component per stage, from the amount on (the recipient is chosen in Send). */
const SCREENS: Record<PayoutStage, ComponentType> = {
  amount: SendAmountScreen,
  review: ReviewScreen,
  pin: PinScreen,
  pinLocked: PinLockedScreen,
  pinResetOtp: PinResetOtpScreen,
  moneyDone: PinUpdatedScreen,
  processing: ProcessingScreen,
  done: DoneScreen,
  "ngn-account": NgnAccountScreen,
  "ngn-bank": NgnBankScreen,
  stepup: StepUpScreen,
  payFrom: PayFromScreen,
  screening: AddressScreeningScreen,
  screeningBlocked: AddressScreeningBlockedScreen,
};

/** The current payout stage, for WalletShell's #panelBody, with the reference's .screen-fade entry. */
export function PayoutBody() {
  const stage = usePayout((s) => s.stage);
  const pinKey = usePayout((s) => (s.stage === "pin" ? s.pinStage : ""));
  if (!stage) return null;
  const C = SCREENS[stage];
  return <div className="screen-fade" key={stage + pinKey}><C /></div>;
}
