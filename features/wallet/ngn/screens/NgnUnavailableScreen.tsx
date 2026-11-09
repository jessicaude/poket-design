"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/** tVaNgn stage 'ngnUnavailable': the verified ID allows no NGN ID route (foreigner living abroad). */
export function NgnUnavailableScreen() {
  const go = useNgn((s) => s.go);
  // TODO: ngnUseConvert opens Convert (cvStart({ to: 'cash:NGN:open' })); wire it when Convert is ported.
  return (
    <>
      <VaBack />
      <div className="center-col" style={{ paddingTop: "20px" }}>
        <div className="check-circle" style={{ background: "var(--surface)", color: "var(--txt2)" }}><Raw html={WICON.info} /></div>
        <div className="step-title">Your own NGN account isn&apos;t available</div>
        <p className="step-sub">It needs a Nigerian ID (BVN or NIN), and your verified ID shows you live outside Nigeria.</p>
      </div>
      <button className="btn-primary" id="ngnUseTemp" onClick={() => go("tempAmount")}>Use a temporary account</button>
      <div style={{ textAlign: "center", marginTop: "12px" }}>
        <button type="button" className="btn-ghost" id="ngnUseConvert">Convert from USD or USDC</button>
      </div>
    </>
  );
}
