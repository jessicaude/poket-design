"use client";
import { NGN_ROUTES, useNgn, type Eligibility, type Tier } from "@/features/wallet/ngn/useNgn";
import { DEMO_PIN, usePayout } from "@/features/wallet/payout/usePayout";
import { useWithdrawals } from "@/features/wallet/payout/useWithdrawals";
import { currentScreen, useWalletNav } from "@/features/wallet/useWalletNav";
import { WITHDRAWAL_TRANSITIONS, type WithdrawalStatus } from "@/lib/mock-api";

/**
 * Prototype controls for the NGN wallet demo (styles: .pbar in styles/prototype.css). Dev-only, not part of the product.
 * Stage actions follow protoActions() in reference/poket-unified.html.
 */
export function NgnDemoBar() {
  const { stage, tier, eligibility, set, transferArrives, expireTemp, go, setIdNum } = useNgn();
  const { pinSet, seedPin, enquiryDown, setEnquiryDown } = usePayout();
  const held = useNgn((s) => s.ngnMerchantBalance);
  const screen = currentScreen(useWalletNav((s) => s.stack));
  const { list, move, releaseHold } = useWithdrawals();
  const payoutStage = usePayout((s) => s.stage);
  const w = !payoutStage && screen?.name === "withdrawal" ? list.find((x) => x.id === screen.id) : undefined;
  const can = (to: WithdrawalStatus) => !!w && WITHDRAWAL_TRANSITIONS[w.status].includes(to);
  return (
    <div className="pbar" role="region" aria-label="Prototype controls">
      <span className="name">Poket design</span>
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
      <label className="opt-lbl"><span>Merchant-held</span>
        <select aria-label="Merchant-held balance" value={held ? "yes" : "no"} onChange={(e) => set({ ngnMerchantBalance: e.target.value === "yes" ? 1200000 : 0 })}>
          <option value="no">None</option><option value="yes">₦12,000.00</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Name enquiry</span>
        <select aria-label="Name enquiry" value={enquiryDown ? "down" : "up"} onChange={(e) => setEnquiryDown(e.target.value === "down")}>
          <option value="up">Available</option><option value="down">Unavailable</option>
        </select>
      </label>
      <span className="grow" />
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
          <button className="pbtn" onClick={() => transferArrives()}>Transfer arrives</button>
          <button className="pbtn" onClick={expireTemp}>Let it expire</button>
        </>
      )}
    </div>
  );
}
