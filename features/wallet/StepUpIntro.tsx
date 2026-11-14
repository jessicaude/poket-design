"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { TIERS, tierName } from "./limits";
import { BackRow, Grey } from "./payout/parts";

/** What each tier takes, in a line (the step-up and the Card tab's "What you need"). */
export const STEP_LINE: Record<1 | 2 | 3, string> = { 1: "Scan your ID and take a selfie", 2: "Add proof of address", 3: "Add a source of funds declaration" };

/**
 * Step-up (the reference's tStepupIntro, shortened): why, as a warning ("Over your Tier 0 limit of ₦[limit] per
 * transaction."), "Verify your identity", one line on what it takes, then Continue. `limit` is the current tier's
 * limit as shown and `per` its period; `reason` replaces the warning when it isn't a limit (e.g. NGN account
 * details); none when the user asked to raise their tier. Continue stands in for the verification steps (not ported).
 */
export function StepUpIntro({ current, target, limit, per = "transaction", reason, onCancel, onContinue }: {
  current: number; target: number; limit?: string; per?: "transaction" | "day" | "month"; reason?: string; onCancel: () => void; onContinue: () => void;
}) {
  const t = Math.min(Math.max(target, current + 1), 3) as 1 | 2 | 3;
  return (
    <>
      <BackRow id="stepupCancel" label="Cancel" onClick={onCancel} />
      {(reason || limit) && (
        <div className="alert warn" id="stepupWarning"><Raw html={WICON.alert} />
          <span>{reason ?? <>Over your {tierName(current).split(":")[0]} limit of <Grey>{limit ?? ""}</Grey> per {per}.</>}</span></div>
      )}
      <div className="step-title">Verify your identity</div>
      <p className="step-sub" id="stepupLine">{STEP_LINE[t]} to reach {TIERS[t].name.split(":")[0]}.</p>
      <button className="btn-primary" id="stepupIntroContinue" onClick={onContinue}>Continue</button>
    </>
  );
}
