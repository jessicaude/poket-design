"use client";
import { useNairaPartner } from "@/store/partner";
import { useEffect, useState } from "react";
import { WICON, sizedIcon } from "@/lib/icons";
import { useWalletToast } from "../../useWalletToast";
import { NGN_VA, holderName, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/**
 * tVa stage 'details' for NGN: the dedicated account's details, with copy, share, confirmation letter,
 * freeze and close (v.confirmClose). Bindings: data-vacopy, vaShare, vaLetter (vaLetter()), vaFreeze, vaClose*.
 */
export function AccountDetailsScreen() {
  const { dedicated, confirmClose, toggleFreeze, askClose, closeDedicated } = useNgn();
  const partnerDown = useNairaPartner((s) => s.down);
  const showNotice = useWalletToast((s) => s.showNotice);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (copied === null) return;
    const id = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  if (!dedicated) return <VaBack />;
  const name = holderName();
  const fields: [string, string][] = [["Account name", name], ...NGN_VA.fields(dedicated.num)];
  const frozen = dedicated.status === "frozen";
  const paused = partnerDown; // WGT-13: the details stay; transfers to them may arrive late

  if (confirmClose) return (
    <>
      <VaBack />
      <div className="step-title">Close NGN account details?</div>
      <p className="step-sub">Your NGN balance stays in your wallet. Transfers sent to these details after closing are returned to the sender. You can create new details later, with a different account number.</p>
      <button className="btn-primary btn-danger" id="vaCloseConfirm" onClick={async () => {
        await closeDedicated();
        showNotice("NGN account details closed", "Your balance is still in your wallet.", 2600);
      }}>Close account details</button>
      <button className="btn-muted" id="vaCloseCancel" onClick={() => askClose(false)}>Keep account</button>
    </>
  );

  const copy = (i: number) => {
    try { navigator.clipboard?.writeText(fields[i][1]).catch(() => {}); } catch {}
    setCopied(i);
  };
  const share = () => {
    const text = fields.map(([k, x]) => `${k}: ${x}`).join("\n");
    if (navigator.share) { navigator.share({ title: "My NGN account details", text }).catch(() => {}); return; }
    try { navigator.clipboard?.writeText(text).catch(() => {}); } catch {}
    showNotice("Details copied", "Paste them into a message or email.", 2400);
  };
  const letter = () => {
    const rows = fields.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join("");
    const html = `<!doctype html><meta charset="utf-8"><title>NGN account confirmation</title><body style="font-family:system-ui;max-width:640px;margin:40px auto;color:#111"><h2>Account confirmation</h2><p>This confirms that the account below is held in the name of <b>${name}</b> with ${NGN_VA.bank}, provided through Poket.</p><table cellpadding="8" style="border-collapse:collapse">${rows}</table><p style="color:#666;font-size:13px">Issued ${new Date().toLocaleDateString()}.</p></body>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = "poket-ngn-account-confirmation.html";
    a.click();
    showNotice("Confirmation letter downloaded", `NGN account in ${name}’s name.`, 2600);
  };

  return (
    <>
      <VaBack />
      <div className="step-title">NGN account details {frozen && <span className="va-status muted">Frozen</span>}{paused && <> <span className="va-status warn" id="vaPaused">Paused</span></>}</div>
      <p className="step-sub">{frozen ? "Transfers to these details are returned while the account is frozen." : paused ? <span id="pausedLate">Transfers may arrive late.</span> : `Send NGN by ${NGN_VA.rails}. ${NGN_VA.arrives}.`}</p>
      <div className={`va-details ${frozen ? "is-frozen" : ""}`}>
        {fields.map(([k, val], i) => (
          <div className="va-field" key={k}>
            <div><div className="va-k">{k}</div><div className={`va-v ${/number|IBAN|BIC|code/i.test(k) ? "mono" : ""}`}>{val}</div></div>
            {!/type|Branch/i.test(k) && (
              <button type="button" className="va-copy" data-vacopy={i} aria-label={`Copy ${k}`} onClick={() => copy(i)}>{copied === i ? "Copied" : "Copy"}</button>
            )}
          </div>
        ))}
      </div>
      <div className="va-actions">
        <button className="btn-secondary" id="vaShare" onClick={share}>Share details</button>
        <button className="btn-secondary" id="vaLetter" onClick={letter}>Confirmation letter</button>
      </div>
      <div className="va-note">Transfers from someone else are checked before they&rsquo;re added to your balance.</div>
      <div className="settings-list" style={{ marginTop: "14px" }}>
        <SettingsRow id="vaFreeze" icon={WICON.lockIc} title={frozen ? "Unfreeze account" : "Freeze account"} sub={frozen ? "Start receiving transfers again" : "Return incoming transfers until you unfreeze"} onClick={toggleFreeze} />
        <SettingsRow id="vaClose" icon={WICON.closeIc} title="Close account details" sub="Your balance stays in your wallet" onClick={() => askClose(true)} />
      </div>
    </>
  );
}

/** The reference's extSettingsRow(id, icon, title, sub). Only constant strings go into the HTML. */
function SettingsRow({ id, icon, title, sub, onClick }: { id: string; icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    // Inner HTML set directly on the row, so the chevron is its last child <svg> (.settings-row>svg:last-child).
    <div className="settings-row" id={id} onClick={onClick} dangerouslySetInnerHTML={{ __html:
      `<span class="settings-row-ic">${sizedIcon(icon, 18)}</span>` +
      `<div class="settings-row-text"><div class="settings-row-title">${title}</div><div class="settings-row-sub">${sub}</div></div>` +
      WICON.chevron }} />
  );
}
