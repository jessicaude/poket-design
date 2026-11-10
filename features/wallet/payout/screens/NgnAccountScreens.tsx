"use client";
import { useEffect, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { listNgBanks, type NgBank } from "@/lib/mock-api";
import { BackRow, SpinButton } from "../parts";
import { usePayout } from "../usePayout";

/*
 * NGN withdrawal recipient: bank, 10-digit account number, then automatic name enquiry.
 * Not in the reference (its Send flow resolves a made-up name instantly), so this is built from its parts:
 * .select-row rows, .field-input / .field-label, the resolved-name line under a field (as for US routing numbers),
 * .field-err, .alert.warn and .consent-row. Copy marked NEW below isn't in the reference.
 */

/** A bank as a select-row: the reference's bank icon in a grey badge (payoutMethodBadgeHtml). */
const BANK_BADGE = `<span style="display:inline-flex;color:var(--txt2)">${WICON.bank}</span>`;

/** ngn-account: bank, account number, name enquiry. */
export function NgnAccountScreen() {
  const { account, go, back, setAccountNumber, setThirdPartyOk, lookUpName, saveNgnAccount } = usePayout();
  const { bank, number, enquiry, thirdPartyOk } = account;
  const canSave = enquiry.status === "matched" || (enquiry.status === "other" && thirdPartyOk);
  return (
    <>
      <BackRow id="backToPayoutRecipient" onClick={back} />
      {/* NEW copy */}
      <div className="step-title">Add a bank account</div>

      <label className="field-label">Bank</label>
      <div className={`select-row ${bank ? "sel" : ""}`} id="ngnBankRow" role="button" onClick={() => go("ngn-bank")}>
        <div className="badge" dangerouslySetInnerHTML={{ __html: BANK_BADGE }} />
        <div className="meta"><div className="t1" style={bank ? undefined : { color: "var(--txt3)", fontWeight: 400 }}>{bank ? bank.name : "Choose your bank"}</div></div>
        <span style={{ color: "var(--txt3)" }}>›</span>
      </div>

      <label className="field-label" htmlFor="ngnAcctInput" style={{ marginTop: "14px" }}>Account number</label>
      <div style={{ position: "relative", marginBottom: "14px" }}>
        <input className="field-input mono" id="ngnAcctInput" placeholder="10-digit account number" inputMode="numeric" maxLength={10} autoComplete="off"
          style={{ marginBottom: 0, paddingRight: "40px" }} value={number} onChange={(e) => setAccountNumber(e.target.value)}
          aria-invalid={enquiry.status === "not_found"} aria-describedby="ngnAcctStatus" />
        {enquiry.status === "resolving" && (
          <span className="btn-spinner dark" role="status" aria-label="Checking the account name"
            style={{ position: "absolute", right: "14px", top: "50%", marginTop: "-7px", marginRight: 0 }} />
        )}
      </div>

      <div id="ngnAcctStatus" aria-live="polite">
        {!bank && number.length === 10 && <div className="field-hint">Choose the bank to check the account name.</div>}
        {(enquiry.status === "matched" || enquiry.status === "other") && (
          <p style={{ margin: "-6px 0 14px", fontSize: "12.5px", color: enquiry.status === "matched" ? "var(--ok-600)" : "var(--txt2)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="badge" style={{ width: "24px", height: "24px", background: enquiry.status === "matched" ? "var(--ok-50)" : "var(--n-100)" }}>
              <span style={{ display: "inline-flex" }}><Raw html={WICON.user} /></span>
            </span>
            <b id="ngnAcctName">{enquiry.name}</b>
          </p>
        )}
        {enquiry.status === "other" && (
          <>
            {/* NEW copy */}
            <div className="alert warn"><Raw html={WICON.alert} /><span>This account isn&apos;t in your name. Only continue if you mean to pay {enquiry.name}.</span></div>
            <div className="consent-row">
              <input type="checkbox" id="ngnThirdPartyOk" checked={thirdPartyOk} onChange={(e) => setThirdPartyOk(e.target.checked)} />
              <label htmlFor="ngnThirdPartyOk">I&apos;m paying {enquiry.name}, not my own account</label>
            </div>
          </>
        )}
        {enquiry.status === "not_found" && <div className="field-err" role="alert">Check the bank and account number</div>}
        {enquiry.status === "unavailable" && (
          <div className="alert warn" role="alert" style={{ alignItems: "flex-start" }}>
            <Raw html={WICON.alert} />
            {/* NEW copy */}
            <span>We can&apos;t check account names right now.{" "}
              <span className="btn-ghost" id="ngnEnquiryRetry" role="button" tabIndex={0} onClick={() => void lookUpName()}>Try again</span>
            </span>
          </div>
        )}
      </div>

      <SpinButton id="ngnAcctSave" style={{ marginTop: "6px" }} disabled={!canSave} delay={400} onClick={saveNgnAccount}>
        {enquiry.status === "other" ? "Add recipient" : "Add account"}
      </SpinButton>
    </>
  );
}

/** ngn-bank: the searchable bank list. */
export function NgnBankScreen() {
  const { account, setAccountBank, back } = usePayout();
  const [banks, setBanks] = useState<NgBank[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { void listNgBanks().then(setBanks); }, []);
  const shown = banks.filter((b) => !q.trim() || b.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <BackRow id="backToNgnAccount" onClick={back} />
      <div className="step-title">Choose your bank</div>
      <div className="field-icon-wrap">
        <span className="field-icon"><Raw html={WICON.search} /></span>
        <input className="field-input" id="ngnBankSearch" placeholder="Search banks" aria-label="Search banks" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ maxHeight: "420px", overflowY: "auto", margin: "0 -2px" }}>
        {shown.map((b) => (
          <div key={b.code} className={`select-row ${account.bank?.code === b.code ? "sel" : ""}`} data-ngnbank={b.code} role="button" onClick={() => setAccountBank(b)}>
            <div className="badge" dangerouslySetInnerHTML={{ __html: BANK_BADGE }} />
            <div className="meta"><div className="t1">{b.name}</div></div>
            <div className="radio" />
          </div>
        ))}
        {banks.length > 0 && !shown.length && <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0 4px" }}>No matches for &ldquo;{q}&rdquo;.</div>}
      </div>
    </>
  );
}
