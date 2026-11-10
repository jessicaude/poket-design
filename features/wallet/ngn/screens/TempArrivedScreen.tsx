"use client";
import { Naira } from "../Naira";
import { useNgn } from "../useNgn";

/** tVaNgn stage 'tempArrived': the transfer reached the temporary account and is being credited. */
export function TempArrivedScreen() {
  const temp = useNgn((s) => s.temp);
  return (
    <div className="center-col" style={{ paddingTop: "40px" }}>
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Transfer received</div>
      {temp && <p className="step-sub">Adding <Naira kobo={temp.amount} /> to your balance.</p>}
    </div>
  );
}
