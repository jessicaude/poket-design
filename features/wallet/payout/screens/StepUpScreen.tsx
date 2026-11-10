"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../../ngn/useNgn";
import { STEP_UP_PLACEHOLDER } from "../payoutMath";
import { BackRow } from "../parts";
import { usePayout } from "../usePayout";

/** The reference's TIERS and tierName(). */
const TIERS: Record<1 | 2 | 3, { name: string; need: string }> = {
  1: { name: "Tier 1: Basic", need: "a Veriff document scan and a quick liveness check" },
  2: { name: "Tier 2: Standard", need: "proof of address" },
  3: { name: "Tier 3: Enhanced", need: "a Source of Funds Declaration and additional document validation" },
};
const tierName = (t: number) => (t > 0 ? TIERS[t as 1 | 2 | 3].name : "Tier 0: Registered");

/**
 * 'stepup': the reference's tStepupIntro, shown before the PIN for amounts over ₦[step-up]. A placeholder: the limit
 * is the ₦[step-up] placeholder (not the reference's USD limits), and Continue goes on to the PIN in place of the
 * verification steps (tStepupTier2 / tStepupTier3), which aren't ported.
 */
export function StepUpScreen() {
  const { back, toPin } = usePayout();
  const tier = useNgn((s) => s.tier);
  const target = Math.min(tier + 1, 3);
  const need = ([1, 2, 3] as const).filter((t) => t > tier && t <= target);
  return (
    <>
      <BackRow id="stepupCancel" label="Cancel" onClick={back} />
      <div className="alert warn"><Raw html={WICON.alert} /><span>This is above what {tierName(tier)} allows (up to {STEP_UP_PLACEHOLDER} per transaction). A quick additional step is needed to continue.</span></div>
      <div className="step-title">Additional verification needed</div>
      <p className="step-sub">To reach {TIERS[target as 1 | 2 | 3].name}, you&apos;ll need to provide:</p>
      <div className="info-card">{need.map((t) => <div className="info-row" key={t}><span>{TIERS[t].name}</span><span>{TIERS[t].need}</span></div>)}</div>
      <button className="btn-primary" id="stepupIntroContinue" onClick={toPin}>Continue</button>
    </>
  );
}
