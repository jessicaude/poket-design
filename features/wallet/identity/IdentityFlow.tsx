"use client";
import { Raw } from "@/components/ui/Raw";
import { CHECK_DRAW } from "@/lib/icons";
import { IdentityDetailsForm, IdentitySteps } from "@/features/auth/IdentityDetailsForm";
import { VendorHandoff } from "@/features/checkout/screens/IdentityScreens";
import { TIERS } from "../limits";
import { BackRow } from "../payout/parts";
import { plaidFor, useIdentity } from "./useIdentity";

/**
 * The wallet's identity verification screens (useIdentity), in place of the step-up while it runs. The details are
 * Checkout's own screen, inside .su (styles/wallet-signup.css). "Finish later" closes the step-up (`onLater`).
 */
export function IdentityFlow({ onLater }: { onLater: () => void }) {
  const { stage, det, phone, submit, back, done, reset } = useIdentity();
  if (!stage || !det) return null;
  if (stage === "details") return (
    <div className="su" id="idDetails">
      <IdentityDetailsForm steps initial={det} onSubmit={submit} onLater={() => { reset(); onLater(); }} />
    </div>
  );
  if (stage === "vendor") return (
    <>
      <div className="su"><IdentitySteps now={1} /></div>
      <BackRow id="idVendorBack" onClick={back} />
      <VendorHandoff plaid={plaidFor(det)} phone={phone} />
    </>
  );
  if (stage === "verifying") return (
    <div className="center-col" style={{ paddingTop: "40px" }} id="idVerifying">
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Checking your ID</div>
    </div>
  );
  // tOnboardVerified
  return (
    <div className="center-col" style={{ paddingTop: "24px" }} id="idVerified">
      <div className="check-circle"><Raw html={CHECK_DRAW} /></div>
      <div className="step-title">Identity verified</div>
      <p className="step-sub">Document, liveness, and age checks passed. You’ve unlocked <b>{TIERS[1].name}</b>.</p>
      <button className="btn-primary" id="continueVerified" onClick={done}>Continue</button>
    </div>
  );
}
