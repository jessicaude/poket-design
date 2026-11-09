"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { Naira } from "../Naira";
import { useNgn } from "../useNgn";

/** tVaNgn stage 'tempDone'. ngnDone leaves the flow (S.va = null; go('home')). */
export function TempDoneScreen() {
  const { temp, close } = useNgn();
  return (
    <>
      <div className="center-col" style={{ paddingTop: "30px" }}>
        <div className="check-circle"><Raw html={WICON.check} /></div>
        <div className="step-title">{temp && <Naira kobo={temp.amount} />} added</div>
        <p className="step-sub">It&apos;s in your NGN balance.</p>
      </div>
      <button className="btn-primary" id="ngnDone" onClick={close}>Done</button>
    </>
  );
}
