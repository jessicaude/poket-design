"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { NGN_ROUTES, useNgn, type Eligibility, type Tier } from "@/features/wallet/ngn/useNgn";
import { DEMO_PIN, usePayout } from "@/features/wallet/payout/usePayout";
import { useWithdrawals } from "@/features/wallet/payout/useWithdrawals";
import { currentScreen, useWalletNav } from "@/features/wallet/useWalletNav";
import { WITHDRAWAL_TRANSITIONS, type WithdrawalStatus } from "@/lib/mock-api";
import { useConvert } from "@/features/wallet/convert/useConvert";
import { useNairaRecipients } from "@/features/wallet/send/nairaRecipients";
import { useSettings } from "@/features/wallet/settings/useSettings";
import { useAccountLock } from "@/store/lock";
import { useAccount } from "@/store/account";
import { merchantRefunds, refundLeft } from "@/lib/refunds";
import { QUEUED_ARRIVAL_DEMO_KOBO, toNigerianBank, useNairaPartner } from "@/store/partner";
import { useSend } from "@/features/wallet/send/useSend";

/**
 * Prototype controls for the NGN wallet demo (styles: .pbar in styles/prototype.css). Dev-only, not part of the product.
 * Stage actions follow protoActions() in reference/poket-unified.html.
 */
export function NgnDemoBar() {
  const { stage, tier, eligibility, set, transferArrives, expireTemp, go, setIdNum } = useNgn();
  const { pinSet, seedPin, enquiryDown, setEnquiryDown } = usePayout();
  const { ngnCoinsBlocked, setNgnCoinsBlocked } = useConvert();
  const { othersHoldNaira, setOthersHoldNaira } = useNairaRecipients();
  const { instantDefaultOn, setInstantDefault, instantPending, applyPendingLimit, deviceKnown, setDeviceKnown, singleDevice, setSingleDevice, signedOut, otherDeviceBinds, selfieOutcome, flagUnusual, setDemo } = useSettings();
  const { down: partnerDown, setDown: setPartnerDown, queued, queueArrival } = useNairaPartner();
  const selfiePhone = usePayout((s) => s.selfiePhone);
  // The locked screen shows over any open money flow (WalletBody)
  const locked = useAccountLock((s) => s.until) !== null;
  // The bar wraps onto more rows when it doesn't fit: keep --bar (the page's offset) equal to its height, as DemoBar does
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--bar", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--bar"); };
  }, []);
  const sendStage = useSend((s) => s.stage), payStage = usePayout((s) => s.stage), cvStage = useConvert((s) => s.stage);
  const flowOpen = !!sendStage || !!payStage || !!cvStage || !!stage;
  const screen = currentScreen(useWalletNav((s) => s.stack));
  const { list, move, releaseHold } = useWithdrawals();
  const payoutStage = usePayout((s) => s.stage);
  const w = !payoutStage && screen?.name === "withdrawal" ? list.find((x) => x.id === screen.id) : undefined;
  // WGT-13: while the naira partner is down, a send to a Nigerian bank that's Sending stays Sending
  const held = !!w && partnerDown && w.status === "sending" && toNigerianBank(w);
  const payment = useAccount((s) => (!payoutStage && screen?.name === "payment" ? s.account?.payments.find((p) => p.id === screen.id) : undefined));
  const can = (to: WithdrawalStatus) => !!w && !held && WITHDRAWAL_TRANSITIONS[w.status].includes(to);
  return (
    <div className="pbar wrap" ref={bar} role="region" aria-label="Prototype controls">
      {/* Demo only: to Checkout's demo page in the app (no reload; in place of the bar's "Poket design" name, for room), so both widgets share one mock account (its code count and lock) */}
      <Link className="pbtn" id="demoToCheckout" href="/demo/ile-living">To Checkout</Link>
      <label className="opt-lbl"><span>Tier</span>
        <select aria-label="Tier" value={tier} onChange={(e) => set({ tier: Number(e.target.value) as Tier })}>
          {[0, 1, 2, 3].map((t) => <option key={t} value={t}>Tier {t}</option>)}
        </select>
      </label>
      {(stage === "ngnChoice" || stage === "ngnRoute") && (
        <label className="opt-lbl"><span>Verified ID shows</span>
          <select aria-label="Verified ID shows" value={eligibility} onChange={(e) => {
            const v = e.target.value as Eligibility;
            set({ eligibility: v });
            go(NGN_ROUTES[v].routes.length ? "ngnRoute" : "ngnUnavailable"); // tVaNgn redirects at render
          }}>
            <option value="ng_in">Nigerian, lives in Nigeria</option><option value="ng_out">Nigerian, lives abroad</option>
            <option value="for_in">Foreigner, lives in Nigeria</option><option value="for_out">Foreigner, lives abroad</option>
          </select>
        </label>
      )}
      <label className="opt-lbl"><span>PIN</span>
        <select aria-label="PIN" value={pinSet ? "set" : "none"} onChange={(e) => seedPin(e.target.value === "set" ? DEMO_PIN : null)}>
          <option value="none">Not set</option><option value="set">Set ({DEMO_PIN})</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Recipient can hold naira</span>
        {/* WGT-07: Poket users other than Amara Okafor (yes) and Daniel Cho (no) */}
        <select aria-label="Recipient can hold naira" value={othersHoldNaira ? "yes" : "no"}
          onChange={(e) => { setOthersHoldNaira(e.target.value === "yes"); usePayout.getState().refreshQuote(); }}>
          <option value="yes">Recipient can hold naira: Yes</option><option value="no">Recipient can hold naira: No</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Selfie check</span>
        {/* The selfie check before a send (over ₦[step-up], or flagged as unusual) */}
        <select aria-label="Selfie check" value={selfieOutcome} onChange={(e) => setDemo({ selfieOutcome: e.target.value as typeof selfieOutcome })}>
          <option value="pass">Selfie check: passes</option><option value="retry">Selfie check: needs retry</option><option value="declined">Selfie check: declined</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Flag as unusual</span>
        <select aria-label="Flag as unusual" value={flagUnusual ? "on" : "off"} onChange={(e) => setDemo({ flagUnusual: e.target.value === "on" })}>
          <option value="off">Flag as unusual: Off</option><option value="on">Flag as unusual: On</option>
        </select>
      </label>
      <label className="opt-lbl"><span>This device</span>
        {/* WGT-10: a new device confirms itself with an email code the first time money moves */}
        <select aria-label="This device" value={deviceKnown ? "known" : "new"} onChange={(e) => setDeviceKnown(e.target.value === "known")}>
          <option value="known">This device: Known</option><option value="new">This device: New</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Naira partner</span>
        {/* WGT-13: partner downtime pauses naira bank transfers (a banner on the affected screens) */}
        <select aria-label="Naira partner" value={partnerDown ? "down" : "up"} onChange={(e) => setPartnerDown(e.target.value === "down")}>
          <option value="up">Naira partner: Up</option><option value="down">Naira partner: Down</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Single active device</span>
        {/* To confirm (not in the PRD): binding a new device signs out the other one */}
        <select aria-label="Single active device" value={singleDevice ? "on" : "off"} onChange={(e) => setSingleDevice(e.target.value === "on")}>
          <option value="off">Single active device: Off</option><option value="on">Single active device: On</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Instant transfers default</span>
        {/* WGT-09: what a new user starts with (switching starts the demo user over with it) */}
        <select aria-label="Instant transfers default" value={instantDefaultOn ? "on" : "off"} onChange={(e) => setInstantDefault(e.target.value === "on")}>
          <option value="on">Instant transfers default: On</option><option value="off">Instant transfers default: Off</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Name enquiry</span>
        <select aria-label="Name enquiry" value={enquiryDown ? "down" : "up"} onChange={(e) => setEnquiryDown(e.target.value === "down")}>
          <option value="up">Available</option><option value="down">Unavailable</option>
        </select>
      </label>
      <label className="opt-lbl"><span>NGN to stablecoins</span>
        <select aria-label="NGN to stablecoins" value={ngnCoinsBlocked ? "blocked" : "allowed"} onChange={(e) => setNgnCoinsBlocked(e.target.value === "blocked")}>
          <option value="allowed">Allowed</option><option value="blocked">Blocked</option>
        </select>
      </label>
      <span className="grow" />
      {/* The selfie check's handoff (as Checkout's DEMO pill on its vendor screen) */}
      {payStage === "selfie" && !locked && (selfiePhone
        ? <button className="pbtn" id="demoSelfieFinish" onClick={() => usePayout.getState().selfieFinish()}>Finish on phone</button>
        : <button className="pbtn" id="demoSelfieOpen" onClick={() => usePayout.getState().selfieOpenPhone()}>Open on phone</button>)}
      {/* Single active device: another device is bound, which signs this one out (its next tap asks it to sign in) */}
      {singleDevice && !signedOut && <button className="pbtn" id="demoOtherDeviceBinds" onClick={otherDeviceBinds}>Sign in on another device</button>}
      {/* WGT-13: a ₦25,000.00 transfer into naira arrives while the partner is down: queued, it's credited on recovery */}
      {partnerDown && <button className="pbtn" id="demoQueuedArrival" onClick={() => queueArrival(QUEUED_ARRIVAL_DEMO_KOBO)}>
        Transfer arrived while down{queued.length ? ` (${queued.length})` : ""}</button>}
      {/* WGT-12: on a Checkout payment's detail, the merchant refunds it (all that's left, or half of it) */}
      {payment && (
        <>
          <button className="pbtn" id="demoRefundFull" disabled={!refundLeft(payment)} onClick={() => merchantRefunds(payment.id, "full")}>Merchant refunds: full</button>
          <button className="pbtn" id="demoRefundPart" disabled={!refundLeft(payment)} onClick={() => merchantRefunds(payment.id, "part")}>Merchant refunds: part</button>
        </>
      )}
      {/* On the locked screen: end the 2-hour lock now */}
      {locked && flowOpen && <button className="pbtn" id="demoSkipLock" onClick={() => useAccountLock.getState().skip()}>Skip lock time</button>}
      {/* WGT-09: on Instant transfers with a raised limit waiting */}
      {screen?.name === "instant-transfers" && instantPending !== null && <button className="pbtn" id="demoSkipCoolingOff" onClick={applyPendingLimit}>Skip cooling-off</button>}
      {stage === "ngnId" && (
        <>
          <button className="pbtn" onClick={() => setIdNum("00000000000")}>Fill a mismatching number</button>
          <button className="pbtn" onClick={() => setIdNum("22312345678")}>Fill a matching number</button>
        </>
      )}
      {w && (
        <>
          <button className="pbtn" disabled={w.status !== "scheduled"} onClick={() => releaseHold(w.id)}>Release first-payment hold</button>
          <button className="pbtn" disabled={!can("review")} onClick={() => move(w.id, "review")}>Hold for review</button>
          <button className="pbtn" disabled={!can("paid")} onClick={() => move(w.id, "paid")}>Mark paid</button>
          <button className="pbtn" disabled={!can("failed")} onClick={() => move(w.id, "failed")}>Fail</button>
          <button className="pbtn" disabled={!can("reversed")} onClick={() => move(w.id, "reversed")}>Reverse</button>
        </>
      )}
      {stage === "temp" && (
        <>
          {/* While down, an arrival waits for the partner ("Transfer arrived while down" above), so not here */}
          {!partnerDown && <button className="pbtn" onClick={() => transferArrives()}>Transfer arrives</button>}
          <button className="pbtn" onClick={expireTemp}>Let it expire</button>
        </>
      )}
    </div>
  );
}
