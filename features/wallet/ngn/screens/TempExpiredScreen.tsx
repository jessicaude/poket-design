"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/** tVaNgn stage 'tempExpired'. The reference uses icons.clock || icons.info; it has no clock icon, so info. */
export function TempExpiredScreen() {
  const tempAgain = useNgn((s) => s.tempAgain);
  return (
    <>
      <VaBack />
      <div className="center-col" style={{ paddingTop: "20px" }}>
        <div className="check-circle" style={{ background: "var(--surface)", color: "var(--txt2)" }}><Raw html={WICON.info} /></div>
        <div className="step-title">This temporary account expired</div>
        <p className="step-sub">Create a new one to add naira. Don&rsquo;t send to the old account number.</p>
      </div>
      <button className="btn-primary" id="ngnTempAgain" onClick={tempAgain}>Create a new one</button>
    </>
  );
}
