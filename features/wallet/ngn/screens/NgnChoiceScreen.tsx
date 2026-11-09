"use client";
import { WICON } from "@/lib/icons";
import { NGN_TEMP_MINUTES } from "@/lib/mock-api";
import { useNgn } from "../useNgn";
import { SelectRow } from "./SelectRow";
import { VaBack } from "./VaBack";

/** tVaNgn stage 'ngnChoice' (Tier 1+). The temporary row uses icons.clock || icons.bank; the reference has no clock icon. */
export function NgnChoiceScreen() {
  const { ngnId, go, pickDedicated } = useNgn();
  return (
    <>
      <VaBack />
      <div className="step-title">Bank transfer</div>
      <SelectRow id="ngnPickTemp" icon={WICON.bank} t1="Temporary account" t2={`For this transfer only, valid ${NGN_TEMP_MINUTES} minutes [time]`} onClick={() => go("tempAmount")} />
      <SelectRow id="ngnPickDedicated" icon={WICON.bank} t1="Your own NGN account" t2={ngnId ? "Reuse it for every transfer" : "Needs your BVN or NIN"} onClick={pickDedicated} />
    </>
  );
}
