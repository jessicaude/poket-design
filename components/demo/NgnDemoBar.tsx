"use client";
import { NGN_ROUTES, useNgn, type Eligibility, type Tier } from "@/features/wallet/ngn/useNgn";

/**
 * Prototype controls for the NGN wallet demo (styles: .pbar in styles/prototype.css). Dev-only, not part of the product.
 * Stage actions follow protoActions() in reference/poket-unified.html.
 */
export function NgnDemoBar() {
  const { stage, tier, eligibility, set, transferArrives, expireTemp, go, setIdNum } = useNgn();
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
      <span className="grow" />
      {stage === "ngnId" && (
        <>
          <button className="pbtn" onClick={() => setIdNum("00000000000")}>Fill a mismatching number</button>
          <button className="pbtn" onClick={() => setIdNum("22312345678")}>Fill a matching number</button>
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
