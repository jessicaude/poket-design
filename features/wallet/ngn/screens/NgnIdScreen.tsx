"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useWalletToast } from "../../useWalletToast";
import { NGN_ID, NGN_ID_HELP, NGN_MAX_ATTEMPTS, holderName, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/**
 * tVaNgn stage 'ngnId': enter the BVN, NIN or NRBVN (11 digits), matched to the verified name and date of birth.
 * Passport and residence permit is a document route, accepted only if the partner allows it.
 */
export function NgnIdScreen() {
  const { route, attempts, mismatch, idNum, setIdNum, checkIdNumber } = useNgn();
  const showNotice = useWalletToast((s) => s.showNotice);
  const [help, setHelp] = useState(false);
  if (!route) return null;
  const r = NGN_ID[route];

  if (route === "permit") return (
    <>
      <VaBack />
      <div className="step-title">Passport and residence permit</div>
      <p className="step-sub">We&rsquo;ll tell you if your passport and residence permit can be used.</p>
      <button className="btn-primary" id="ngnPermitGo" onClick={() => showNotice("Not available yet", "We’ll tell you if your passport and residence permit can be used.", 2400)}>Upload documents</button>
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
          The name or date of birth on this {r.name} doesn&rsquo;t match your verified ID. Check the number and try again. {left} {left === 1 ? "attempt" : "attempts"} left.
        </div>
      )}
      {/* The short line above; the full definition in "What’s this?" (docs/copy.md, Terms) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label className="field-label" htmlFor="ngnIdNum">{r.name}</label>
        <span className="btn-ghost" id="ngnIdWhat" role="button" tabIndex={0} aria-haspopup="dialog" style={{ fontSize: "12px" }}
          onClick={() => setHelp(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHelp(true); } }}>What&rsquo;s this?</span>
      </div>
      <input className="field-input mono" id="ngnIdNum" inputMode="numeric" maxLength={11} placeholder="00000000000" value={idNum} autoComplete="off" onChange={(e) => setIdNum(e.target.value)} />
      <div className="receipt-card">
        {rows.map(([ic, k, v]) => (
          <div className="receipt-row" key={k}><span className="r-ic"><Raw html={ic} /></span><span className="r-label">{k}</span><span className="r-value">{v}</span></div>
        ))}
      </div>
      <button className="btn-primary" id="ngnIdGo" disabled={idNum.length !== r.len} onClick={() => checkIdNumber()}>Check {r.name}</button>
      {help && <IdHelpSheet route={route} onClose={() => setHelp(false)} />}
    </>
  );
}

/** "What’s this?": the ID's full definition, in a sheet over the wallet (the receipt sheet's look). */
function IdHelpSheet({ route, onClose }: { route: keyof typeof NGN_ID_HELP; onClose: () => void }) {
  const h = NGN_ID_HELP[route];
  return (
    <div className="rc-backdrop" id="ngnIdHelp" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rc-sheet" role="dialog" aria-modal="true" aria-labelledby="ngnIdHelpTitle">
        <div className="rc-sheet-head"><b id="ngnIdHelpTitle">{h.title}</b>
          <button type="button" className="panel-settings-btn" id="ngnIdHelpClose" aria-label="Close" onClick={onClose}><Raw html={WICON.closeIc} /></button>
        </div>
        <p className="step-sub" id="ngnIdHelpBody" style={{ margin: "0 0 14px", color: "var(--txt)" }}>{h.body}</p>
        <button className="btn-primary" id="ngnIdHelpDone" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
