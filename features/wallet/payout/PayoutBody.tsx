"use client";
import type { ComponentType } from "react";
import { usePayout, type PayoutStage } from "./usePayout";
import { RecipientScreen } from "./screens/RecipientScreen";
import { AddOtherDetailsScreen, AddOtherMethodScreen, AddSelfScreen } from "./screens/AddRecipientScreens";
import { AmountScreen, ReviewScreen } from "./screens/AmountReviewScreens";
import { PinLockedScreen, PinResetOtpScreen, PinScreen, PinUpdatedScreen } from "./screens/PinScreens";
import { DoneScreen, ProcessingScreen } from "./screens/ProcessingDoneScreens";
import { NgnAccountScreen, NgnBankScreen } from "./screens/NgnAccountScreens";
import { WithdrawUnavailableScreen } from "./screens/WithdrawUnavailableScreen";
import { StepUpScreen } from "./screens/StepUpScreen";

/** One component per payout stage. */
const SCREENS: Record<PayoutStage, ComponentType> = {
  recipient: RecipientScreen,
  "add-recipient": AddSelfScreen,
  "add-recipient-details": AddOtherDetailsScreen,
  "add-recipient-method": AddOtherMethodScreen,
  amount: AmountScreen,
  review: ReviewScreen,
  pin: PinScreen,
  pinLocked: PinLockedScreen,
  pinResetOtp: PinResetOtpScreen,
  moneyDone: PinUpdatedScreen,
  processing: ProcessingScreen,
  done: DoneScreen,
  "ngn-account": NgnAccountScreen,
  "ngn-bank": NgnBankScreen,
  unavailable: WithdrawUnavailableScreen,
  stepup: StepUpScreen,
};

/** The current payout stage, for WalletShell's #panelBody, with the reference's .screen-fade entry. */
export function PayoutBody() {
  const stage = usePayout((s) => s.stage);
  const pinKey = usePayout((s) => (s.stage === "pin" ? s.pinStage : ""));
  if (!stage) return null;
  const C = SCREENS[stage];
  return <div className="screen-fade" key={stage + pinKey}><C /></div>;
}
