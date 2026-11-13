"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../useNgn";
import { VaBack } from "./VaBack";
import { useConvert } from "../../convert/useConvert";

/** tVaNgn stage 'ngnUnavailable': the verified ID allows no NGN ID route (foreigner living abroad). */
export function NgnUnavailableScreen() {
  const go = useNgn((s) => s.go);
  return (
    <>
      <VaBack />
      <div className="center-col" style={{ paddingTop: "20px" }}>
        <div className="check-circle" style={{ background: "var(--surface)", color: "var(--txt2)" }}><Raw html={WICON.info} /></div>
        <div className="step-title">Your own NGN account isn&rsquo;t available</div>
        <p className="step-sub">It needs a Nigerian ID (BVN or NIN), and your verified ID shows you live outside Nigeria.</p>
      </div>
      <button className="btn-primary" id="ngnUseTemp" onClick={() => go("tempAmount")}>Use a temporary account</button>
      <div style={{ textAlign: "center", marginTop: "12px" }}>
        <button type="button" className="btn-ghost" id="ngnUseConvert" onClick={() => useConvert.getState().start({ to: "cash:NGN:open" })}>Convert from USD or USDC</button>
      </div>
    </>
  );
}
