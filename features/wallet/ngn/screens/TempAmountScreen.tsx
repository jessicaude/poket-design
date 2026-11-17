"use client";
import { depositFee } from "@/lib/fees";
import { formatNaira } from "@/lib/money";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { AmountChip, AmountField, amountPlain, keyAmount } from "../../AmountField";
import { NGN_MIN_TOPUP, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/**
 * tVaNgn stage 'tempAmount': the amount for a single-use account, in the wallet's amount field (AmountField: the NGN
 * chip, the amount, the keypad on tap); the tier's limit line under it, then the fee and what arrives. The limits are
 * placeholders until the partner sets them.
 */
export function TempAmountScreen() {
  const { tier, tempCents, setTempCents, createTemp } = useNgn();
  const ok = tempCents >= NGN_MIN_TOPUP;

  return (
    <>
      <VaBack />
      <div className="step-title">Add naira</div>
      <p className="step-sub">We&rsquo;ll create a single-use account for this amount.</p>
      <AmountField action={<button className="btn-primary" id="ngnTempGo" style={{ marginTop: "12px" }} disabled={!ok} onClick={() => createTemp(tempCents)}>Create single-use account</button>}
        id="ngnAmtBox" label="Amount" chip={<AmountChip cur="NGN" />} amountId="ngnAmt" ariaLabel="Amount to add" text={amountPlain(tempCents)}
        dataKey="ngnkey" keypadId="ngnKeypad" doneId="ngnKeypadDone" onKey={(k) => setTempCents(keyAmount(tempCents, k))}>
        <p className="step-sub" id="ngnAmtLimit" style={{ fontSize: "11.5px", margin: "8px 0 0" }}>
          {tier < 1 ? "Tier 0: up to ₦[limit] per top-up and ₦[limit] in total" : "Up to ₦[limit] per top-up"}
        </p>
        {tempCents > 0 && (
          // The deposit fee comes out of what arrives (lib/fees.ts)
          <div className="receipt-card" id="ngnTempFee" style={{ marginTop: "12px" }}>
            <div className="receipt-row"><span className="r-ic"><Raw html={WICON.percent} /></span><span className="r-label">Fee</span><span className="r-value mono">{formatNaira(depositFee(tempCents, "NGN"))}</span></div>
            <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.coins} /></span><span className="r-label">You get</span><span className="r-value mono">{formatNaira(tempCents - depositFee(tempCents, "NGN"))}</span></div>
          </div>
        )}
      </AmountField>
    </>
  );
}
