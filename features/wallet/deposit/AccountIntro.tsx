"use client";
import { useEffect, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";

/**
 * "Get {cur} account details", before an account is made, for every currency (USD, EUR, GBP, GHS in Deposit; NGN in
 * its own flow). Left-aligned like the other setup screens: the currency's flag starts the title row; rows without
 * icons; the partner bank's terms, unticked, with "account terms" opening them in a sheet. Create stays disabled until
 * they're accepted.
 */
export function AccountIntro({ cur, flag, rows, bank, agree, onAgree, onCreate }: {
  cur: string;
  /** The flag's icon markup (WICON). */
  flag: string;
  /** [label, value]: the name on the account, each rail and its timing, the fee. */
  rows: [string, string][];
  /** The partner bank ("Lead Bank"; NGN's stays "[Partner bank]"). */
  bank: string;
  agree: boolean;
  onAgree: (on: boolean) => void;
  onCreate: () => void;
}) {
  const [terms, setTerms] = useState(false);
  // The link sits in the checkbox's label: opening the terms doesn't tick the box
  const openTerms = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); setTerms(true); };
  return (
    <>
      <div id="vaIntroTitle" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
        {/* The flag's svg a direct child of .badge (wallet.css .badge>svg) */}
        <div className="badge" id="vaIntroFlag" aria-hidden="true" dangerouslySetInnerHTML={{ __html: flag }} />
        <div className="step-title" style={{ margin: 0 }}>Get {cur} account details</div>
      </div>
      <p className="step-sub">Get paid by employers, clients or your bank. Money lands in your {cur} balance.</p>
      <div className="receipt-card" id="vaIntroRows">
        {rows.map(([k, v]) => (
          <div className="receipt-row" key={k}><span className="r-label">{k}</span><span className="r-value" id={k === "Fee" ? "vaFee" : undefined}>{v}</span></div>
        ))}
      </div>
      <div className="consent-row" style={{ marginTop: "12px" }}>
        <input type="checkbox" id="vaAgree" checked={agree} onChange={(e) => onAgree(e.target.checked)} />
        <label htmlFor="vaAgree">
          I accept {bank}&rsquo;s{" "}
          <span className="consent-link" id="vaTermsLink" role="link" tabIndex={0} aria-haspopup="dialog" onClick={openTerms}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openTerms(e); }}>account terms</span>
        </label>
      </div>
      <button className="btn-primary" id="vaCreate" disabled={!agree} onClick={onCreate}>Create account details</button>
      {terms && <TermsSheet bank={bank} onClose={() => setTerms(false)} />}
    </>
  );
}

/** "{Bank} account terms", in a sheet over the wallet (the receipt sheet's look). The terms themselves are a placeholder. */
function TermsSheet({ bank, onClose }: { bank: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="rc-backdrop" id="vaTerms" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rc-sheet" role="dialog" aria-modal="true" aria-labelledby="vaTermsTitle">
        <div className="rc-sheet-head"><b id="vaTermsTitle">{bank} account terms</b>
          <button type="button" className="panel-settings-btn" aria-label="Close" onClick={onClose}><Raw html={WICON.closeIc} /></button>
        </div>
        <p className="step-sub" id="vaTermsBody" style={{ margin: "0 0 14px", color: "var(--txt)" }}>[Partner bank account terms]</p>
        <button className="btn-secondary" id="vaTermsClose" style={{ width: "100%" }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
