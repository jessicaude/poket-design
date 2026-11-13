"use client";
import type { ComponentType } from "react";
import { useNgn, type NgnStage } from "./useNgn";
import { DepositNgnScreen } from "./screens/DepositNgnScreen";
import { TempAmountScreen } from "./screens/TempAmountScreen";
import { TempCreatingScreen } from "./screens/TempCreatingScreen";
import { TempScreen } from "./screens/TempScreen";
import { TempArrivedScreen } from "./screens/TempArrivedScreen";
import { TempDoneScreen } from "./screens/TempDoneScreen";
import { TempExpiredScreen } from "./screens/TempExpiredScreen";
import { NgnChoiceScreen } from "./screens/NgnChoiceScreen";
import { NgnRouteScreen } from "./screens/NgnRouteScreen";
import { NgnIdScreen } from "./screens/NgnIdScreen";
import { NgnCheckingScreen } from "./screens/NgnCheckingScreen";
import { NgnLockedScreen } from "./screens/NgnLockedScreen";
import { NgnUnavailableScreen } from "./screens/NgnUnavailableScreen";
import { AccountIntroScreen } from "./screens/AccountIntroScreen";
import { AccountCreatingScreen } from "./screens/AccountCreatingScreen";
import { AccountDetailsScreen } from "./screens/AccountDetailsScreen";
import { VerifyScreen } from "./screens/VerifyScreen";
import { NGN_PAUSED_STAGES, NairaPausedBanner } from "../NairaPausedBanner";
import { NGN_PAUSED_SCREENS, NgnPausedScreen } from "./screens/NgnPausedScreen";
import { useNairaPartner } from "@/store/partner";

/** One component per NGN stage. Stages not ported yet show a visible placeholder. */
const SCREENS: Partial<Record<NgnStage, ComponentType>> = {
  "deposit-method": DepositNgnScreen,
  tempAmount: TempAmountScreen,
  tempCreating: TempCreatingScreen,
  temp: TempScreen,
  tempArrived: TempArrivedScreen,
  tempDone: TempDoneScreen,
  tempExpired: TempExpiredScreen,
  ngnChoice: NgnChoiceScreen,
  ngnRoute: NgnRouteScreen,
  ngnId: NgnIdScreen,
  ngnChecking: NgnCheckingScreen,
  ngnLocked: NgnLockedScreen,
  ngnUnavailable: NgnUnavailableScreen,
  intro: AccountIntroScreen,
  creating: AccountCreatingScreen,
  details: AccountDetailsScreen,
  verify: VerifyScreen,
};

/** The current NGN stage, for WalletShell's #panelBody. Keyed so each stage gets the reference's .screen-fade entry. */
export function NgnBody() {
  const stage = useNgn((s) => s.stage);
  const partnerDown = useNairaPartner((s) => s.down);
  if (!stage) return null;
  const C = SCREENS[stage];
  // WGT-13: while the naira partner is down, bank transfer deposits and new account details are paused
  if (partnerDown && NGN_PAUSED_SCREENS[stage]) return <div className="screen-fade" key={`${stage}-paused`}><NgnPausedScreen stage={stage} /></div>;
  return (
    <div className="screen-fade" key={stage}>
      {/* WGT-13: naira deposits by bank transfer show the paused banner on top while the naira partner is down */}
      {NGN_PAUSED_STAGES.includes(stage) && <NairaPausedBanner />}
      {C ? <C /> : <NotPorted stage={stage} />}
    </div>
  );
}

/** Design-environment placeholder, so the flow can be walked before every screen exists. */
function NotPorted({ stage }: { stage: NgnStage }) {
  const back = useNgn((s) => s.back);
  return (
    <>
      <button className="back-row" onClick={back}>Back</button>
      <div className="step-title">[Not ported yet: {stage}]</div>
      <p className="step-sub">Port tVaNgn stage &lsquo;{stage}&rsquo; from reference/poket-unified.html.</p>
    </>
  );
}
