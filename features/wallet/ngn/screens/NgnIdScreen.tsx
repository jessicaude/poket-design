"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useWalletToast } from "../../useWalletToast";
import { NGN_ID, NGN_MAX_ATTEMPTS, holderName, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/**
 * tVaNgn stage 'ngnId': enter the BVN, NIN or NRBVN (11 digits), matched to the verified name and date of birth.
 * Passport and residence permit is a document route, accepted only if the partner allows it.
 */
export function NgnIdScreen() {
  const { route, attempts, mismatch, idNum, setIdNum, checkIdNumber } = useNgn();
  const showNotice = useWalletToast((s) => s.showNotice);
  if (!route) return null;
  const r = NGN_ID[route];

  if (route === "permit") return (
    <>
      <VaBack />
      <div className="step-title">Passport and residence permit</div>
      <p className="step-sub">Accepted only if Poket&apos;s partner allows it. [to confirm]</p>
      <button className="btn-primary" id="ngnPermitGo" onClick={() => showNotice("Not in the prototype yet", "Depends on what the partner accepts.", 2400)}>Upload documents</button>
    </>
  );

  const left = NGN_MAX_ATTEMPTS - attempts;
  // The reference shows S.dob when known; the wallet has no verified date of birth yet.
  const rows: [string, string, string][] = [[WICON.user, "Name", holderName()], [WICON.info, "Date of birth", "From your verified ID"]];
  return (
    <>
      <VaBack />
      <div className="step-title">Enter your {r.name}</div>
      <p className="step-sub">{r.long}, 11 digits.</p>
      {mismatch && (
        <div role="alert" style={{ background: "var(--err-50)", color: "var(--err-600)", borderRadius: "12px", padding: "12px 14px", fontSize: "13px", lineHeight: 1.4, margin: "2px 0 14px" }}>
          The name or date of birth on this {r.name} doesn&apos;t match your verified ID. {left} {left === 1 ? "attempt" : "attempts"} left.
        </div>
      )}
      <label className="field-label" htmlFor="ngnIdNum">{r.name}</label>
      <input className="field-input mono" id="ngnIdNum" inputMode="numeric" maxLength={11} placeholder="00000000000" value={idNum} autoComplete="off" onChange={(e) => setIdNum(e.target.value)} />
      <div className="receipt-card">
        {rows.map(([ic, k, v]) => (
          <div className="receipt-row" key={k}><span className="r-ic"><Raw html={ic} /></span><span className="r-label">{k}</span><span className="r-value">{v}</span></div>
        ))}
      </div>
      <button className="btn-primary" id="ngnIdGo" disabled={idNum.length !== r.len} onClick={() => checkIdNumber()}>Check {r.name}</button>
    </>
  );
}
