"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { TIERS, tierName } from "./limits";
import { BackRow, Grey } from "./payout/parts";

/**
 * The reference's tStepupIntro: "Additional verification needed", listing what each tier up to `target` needs.
 * `limit` is the current tier's per-transaction limit as shown (a placeholder such as ₦[limit] where undecided).
 * Continue stands in for the verification steps (tStepupTier2 / tStepupTier3), which aren't ported.
 */
export function StepUpIntro({ current, target, limit, onCancel, onContinue }: {
  current: number; target: number; limit: string; onCancel: () => void; onContinue: () => void;
}) {
  const t = Math.min(Math.max(target, current + 1), 3) as 1 | 2 | 3;
  const need = ([1, 2, 3] as const).filter((n) => n > current && n <= t);
  return (
    <>
      <BackRow id="stepupCancel" label="Cancel" onClick={onCancel} />
      <div className="alert warn"><Raw html={WICON.alert} /><span>This is above what {tierName(current)} allows (up to <Grey>{limit}</Grey> per transaction). A quick additional step is needed to continue.</span></div>
      <div className="step-title">Additional verification needed</div>
      <p className="step-sub">To reach {TIERS[t].name}, you&apos;ll need to provide:</p>
      <div className="info-card">{need.map((n) => <div className="info-row" key={n}><span>{TIERS[n].name}</span><span>{TIERS[n].need}</span></div>)}</div>
      <button className="btn-primary" id="stepupIntroContinue" onClick={onContinue}>Continue</button>
    </>
  );
}
