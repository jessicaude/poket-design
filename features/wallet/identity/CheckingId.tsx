"use client";
import { IDCARD_ICON } from "@/lib/icons";
import { WaitingScreen } from "../WaitingScreen";

/** The ID check's waiting steps: the ID (or selfie) submitted, being checked, then the result. */
export const ID_CHECK_STEPS = [{ label: "Submitted" }, { label: "Checking" }, { label: "Result" }];

/**
 * "Checking your ID" (Checkout's SCREENS['verifying']), as the wallet's waiting state: after the handoff's "Finish on
 * phone", until the result (identity verification, and the selfie check before a send).
 */
export function CheckingIdScreen({ id }: { id?: string }) {
  return <WaitingScreen id={id ?? "idChecking"} icon graphic={IDCARD_ICON} title="Checking your ID" steps={ID_CHECK_STEPS} current={1} />;
}
