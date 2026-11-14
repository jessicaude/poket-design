"use client";
import { depositFee } from "@/lib/fees";
import { useState } from "react";
import { formatNaira } from "@/lib/money";
import { NGN_MIN_TOPUP, parseNairaInput, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/** tVaNgn stage 'tempAmount': the amount for a temporary account. The limits are placeholders until the partner sets them. */
export function TempAmountScreen() {
  const { tier, tempCents, setTempCents, createTemp } = useNgn();
  const fmt = (k: number) => formatNaira(k).replace(" NGN", "");
  const [text, setText] = useState(tempCents ? fmt(tempCents) : "");
  const ok = tempCents >= NGN_MIN_TOPUP;

  return (
    <>
      <VaBack />
      <div className="step-title">Add naira</div>
      <p className="step-sub">We&rsquo;ll create a temporary account for this amount.</p>
      <label className="field-label" htmlFor="ngnAmt">Amount</label>
      <input
        className="field-input mono" id="ngnAmt" inputMode="decimal" placeholder={"₦0.00"} value={text}
        onChange={(e) => { setText(e.target.value); setTempCents(parseNairaInput(e.target.value)); }}
        onBlur={() => { if (tempCents) setText(fmt(tempCents)); }}
      />
      <p className="step-sub" style={{ fontSize: "11.5px", marginTop: "-6px" }}>
        {tier < 1 ? "Tier 0: up to ₦[limit] per top-up and ₦[limit] in total" : "Up to ₦[limit] per top-up"}
      </p>
      {tempCents > 0 && (
        // The deposit fee comes out of what arrives (lib/fees.ts)
        <div className="receipt-card" id="ngnTempFee" style={{ marginTop: "4px" }}>
          <div className="receipt-row"><span className="r-label">Fee</span><span className="r-value mono">{formatNaira(depositFee(tempCents, "NGN"))}</span></div>
          <div className="receipt-row"><span className="r-label">You get</span><span className="r-value mono">{formatNaira(tempCents - depositFee(tempCents, "NGN"))}</span></div>
        </div>
      )}
      <button className="btn-primary" id="ngnTempGo" disabled={!ok} onClick={() => createTemp(tempCents)}>Create temporary account</button>
    </>
  );
}
