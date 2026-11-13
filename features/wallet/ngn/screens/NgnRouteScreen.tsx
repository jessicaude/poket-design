"use client";
import { WICON } from "@/lib/icons";
import { NGN_ID, NGN_ROUTES, useNgn } from "../useNgn";
import { SelectRow } from "./SelectRow";
import { VaBack } from "./VaBack";

/**
 * tVaNgn stage 'ngnRoute': the IDs the verified ID allows (NGN_ROUTES by eligibility).
 * With none (for_out) the store goes to ngnUnavailable instead. Icon: icons.idCard || icons.user; no idCard in the reference.
 */
export function NgnRouteScreen() {
  const { eligibility, chooseRoute } = useNgn();
  return (
    <>
      <VaBack />
      <div className="step-title">Get your own NGN account</div>
      <p className="step-sub">Choose the ID you&rsquo;ll use. It must match the name and date of birth on your verified ID.</p>
      {NGN_ROUTES[eligibility].routes.map((r) => (
        <SelectRow key={r} data-ngnroute={r} icon={WICON.user} t1={NGN_ID[r].name} t2={NGN_ID[r].long} onClick={() => chooseRoute(r)} />
      ))}
    </>
  );
}
