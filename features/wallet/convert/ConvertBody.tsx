"use client";
import type { ComponentType } from "react";
import { useConvert, type ConvertStage } from "./useConvert";
import {
  ConvertDoneScreen, ConvertEmptyScreen, ConvertFormScreen, ConvertLimitBlockedScreen, ConvertPickerScreen, ConvertProcessingScreen,
  ConvertReviewScreen, ConvertStepUpScreen,
} from "./ConvertScreens";

const SCREENS: Record<ConvertStage, ComponentType> = {
  form: ConvertFormScreen,
  pickFrom: ConvertPickerScreen,
  pickTo: ConvertPickerScreen,
  review: ConvertReviewScreen,
  processing: ConvertProcessingScreen,
  done: ConvertDoneScreen,
  empty: ConvertEmptyScreen,
  stepup: ConvertStepUpScreen,
  limitBlocked: ConvertLimitBlockedScreen,
};

/** The current Convert stage, for WalletShell's #panelBody, with the reference's .screen-fade entry. */
export function ConvertBody() {
  const stage = useConvert((s) => s.stage);
  if (!stage) return null;
  const C = SCREENS[stage];
  return <div className="screen-fade" key={stage}><C /></div>;
}
