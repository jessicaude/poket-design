"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useConvert } from "../../convert/useConvert";
import type { NgnStage } from "../useNgn";
import { VaBack } from "./VaBack";

/** The stages a paused naira partner replaces (WGT-13), with the title each one has. */
export const NGN_PAUSED_SCREENS: Partial<Record<NgnStage, string>> = {
  ngnChoice: "Bank transfer",
  tempAmount: "Add naira",
  ngnRoute: "Get your own NGN account",
  intro: "Get NGN account details",
};

/**
 * WGT-13: while the naira partner is down, Deposit NGN's Bank transfer and getting NGN account details stop here: no
 * temporary account or account details are created. The screen keeps its title; Convert (as Deposit NGN's) tops up
 * from USD instead. When the partner is back, the step it replaced shows again.
 */
export function NgnPausedScreen({ stage }: { stage: NgnStage }) {
  return (
    <>
      <VaBack />
      <div className="step-title">{NGN_PAUSED_SCREENS[stage]}</div>
      <div className="alert warn" id="ngnPaused" role="status">
        <Raw html={WICON.alert} /><span>Bank transfers into naira are paused. Try again later, or convert from USD.</span>
      </div>
      <button className="btn-primary" id="ngnPausedConvert" onClick={() => useConvert.getState().start({ to: "cash:NGN:open" })}>Convert</button>
    </>
  );
}
