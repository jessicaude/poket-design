"use client";
import { depositFee } from "@/lib/fees";
import { formatNaira } from "@/lib/money";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgnCredits } from "../../history/credits";
import { Naira } from "../Naira";
import { useNgn } from "../useNgn";

/**
 * tVaNgn stage 'tempDone'. ngnDone leaves the flow (S.va = null; go('home')). Like every done screen, the review's
 * rows (the fee, what you get) with the reference before the highlighted total, which is last.
 */
export function TempDoneScreen() {
  const { temp, close } = useNgn();
  // The top-up's own record (the newest temporary-account credit)
  const credit = useNgnCredits((s) => s.list.find((c) => c.kind === "temp"));
  const fee = temp ? depositFee(temp.amount, "NGN") : 0;
  return (
    <>
      <div className="center-col" style={{ paddingTop: "30px" }}>
        <div className="check-circle"><Raw html={WICON.check} /></div>
        <div className="step-title">{temp && <Naira kobo={temp.amount - fee} />} added</div>
        <p className="step-sub">It&rsquo;s in your NGN balance.</p>
      </div>
      {temp && (
        <div className="receipt-card" id="ngnTempDoneCard" style={{ marginTop: "16px" }}>
          <div className="receipt-row"><span className="r-ic"><Raw html={WICON.percent} /></span><span className="r-label">Fee</span><span className="r-value mono">{formatNaira(fee)}</span></div>
          {credit && <div className="receipt-row"><span className="r-ic"><Raw html={WICON.hash} /></span><span className="r-label">Reference</span><span className="r-value mono">{credit.ref}</span></div>}
          <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.coins} /></span><span className="r-label">You get</span><span className="r-value mono">{formatNaira(temp.amount - fee)}</span></div>
        </div>
      )}
      <button className="btn-primary" id="ngnDone" onClick={close}>Done</button>
    </>
  );
}
