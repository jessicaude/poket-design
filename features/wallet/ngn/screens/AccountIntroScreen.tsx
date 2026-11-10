"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { NGN_VA, holderName, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/**
 * tVa stage 'intro' for NGN (after a matched ID): what the account is, and the partner's account terms.
 * NGN skips the reference's stablecoin line and tax ID. The Arrives row uses icons.clock || icons.info; no clock icon there.
 */
export function AccountIntroScreen() {
  const createDedicated = useNgn((s) => s.createDedicated);
  const [agree, setAgree] = useState(false);
  const rows: [string, string, string][] = [
    [WICON.user, "Name on account", holderName()],
    [WICON.bank, "Receive by", NGN_VA.rails],
    [WICON.info, "Arrives", NGN_VA.arrives.split(" · ")[0]],
    [WICON.percent, "Fees", "Free to receive"],
  ];
  const openTerms = (e: React.SyntheticEvent) => {
    e.preventDefault(); e.stopPropagation();
    window.open("https://onepoket.com/terms-and-conditions", "_blank", "noopener");
  };
  return (
    <>
      <VaBack />
      <div className="convert-visual" style={{ marginTop: "4px" }}><div className="badge" dangerouslySetInnerHTML={{ __html: WICON.ngFlag }} />{/* direct child for .badge>svg */}<span className="convert-arrow"><Raw html={WICON.bank} /></span></div>
      <div className="step-title" style={{ textAlign: "center", marginTop: "10px" }}>Get NGN account details</div>
      <p className="step-sub" style={{ textAlign: "center" }}>Share them with your bank, employer or clients. Money sent to them lands in your NGN balance.</p>
      <div className="receipt-card">
        {rows.map(([ic, k, v]) => (
          <div className="receipt-row" key={k}><span className="r-ic"><Raw html={ic} /></span><span className="r-label">{k}</span><span className="r-value">{v}</span></div>
        ))}
      </div>
      <div className="consent-row" style={{ marginTop: "12px" }}>
        <input type="checkbox" id="vaAgree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <label htmlFor="vaAgree">
          Accept the{" "}
          <span className="consent-link" data-doc="va-terms" role="link" tabIndex={0} onClick={openTerms} onKeyDown={(e) => { if (e.key === "Enter") openTerms(e); }}>account terms</span>
          {" "}of Poket&apos;s partner bank, {NGN_VA.bank}
        </label>
      </div>
      <button className="btn-primary" id="vaCreate" disabled={!agree} onClick={createDedicated}>Create account details</button>
    </>
  );
}
