"use client";
import type { ComponentType } from "react";
import { useConvert, type ConvertStage } from "./useConvert";
import {
  ConvertDoneScreen, ConvertFormScreen, ConvertPickerScreen, ConvertProcessingScreen, ConvertReviewScreen,
} from "./ConvertScreens";

const SCREENS: Record<ConvertStage, ComponentType> = {
  form: ConvertFormScreen,
  pickFrom: ConvertPickerScreen,
  pickTo: ConvertPickerScreen,
  review: ConvertReviewScreen,
  processing: ConvertProcessingScreen,
  done: ConvertDoneScreen,
};

/** The current Convert stage, for WalletShell's #panelBody, with the reference's .screen-fade entry. */
export function ConvertBody() {
  const stage = useConvert((s) => s.stage);
  if (!stage) return null;
  const C = SCREENS[stage];
  return <div className="screen-fade" key={stage}><C /></div>;
}
