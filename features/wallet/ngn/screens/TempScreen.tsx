"use client";
import { useNairaPartner } from "@/store/partner";
import { useEffect, useState } from "react";
import { formatNaira, formatNairaShort } from "@/lib/money";
import { useWalletToast } from "../../useWalletToast";
import { Naira } from "../Naira";
import { fmtCountdown, holderName, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/**
 * tVaNgn stage 'temp': the temporary account's details, with a live countdown (ngnStartTicker).
 * Bindings: data-ngncopy (copy, "Copied" for 1.5s) and ngnTempShare (share sheet, else copy + notice).
 */
export function TempScreen() {
  const { temp, expireTemp } = useNgn();
  const paused = useNairaPartner((s) => s.down); // WGT-13: the details stay; transfers may arrive late
  const showNotice = useWalletToast((s) => s.showNotice);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (temp && temp.expiresAt - t <= 0) { clearInterval(id); expireTemp(); }
    }, 1000);
    return () => clearInterval(id);
  }, [temp, expireTemp]);

  useEffect(() => {
    if (copied === null) return;
    const id = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  if (!temp) return null;
  const name = holderName();
  const fields: [string, React.ReactNode, string][] = [
    ["Amount to send", <Naira key="a" kobo={temp.amount} />, formatNaira(temp.amount)],
    ["Account number", temp.num, temp.num],
    ["Bank", "[Partner bank]", "[Partner bank]"],
    ["Account name", "Poket / " + name, "Poket / " + name],
  ];
  const copy = (i: number) => {
    try { navigator.clipboard?.writeText(fields[i][2]).catch(() => {}); } catch {}
    setCopied(i);
  };
  const share = () => {
    const text = `Send exactly ${formatNairaShort(temp.amount)}\nAccount number: ${temp.num}\nBank: [Partner bank]\nAccount name: Poket / ${name}`;
    if (navigator.share) { navigator.share({ title: "Temporary account details", text }).catch(() => {}); return; }
    try { navigator.clipboard?.writeText(text).catch(() => {}); } catch {}
    showNotice("Details copied", "Paste them into your bank app.", 2400);
  };

  return (
    <>
      <VaBack />
      <div className="step-title">Send exactly <Naira kobo={temp.amount} />{paused && <> <span className="va-status warn" id="vaPaused">Paused</span></>}</div>
      <p className="step-sub">{paused ? <span id="pausedLate">Transfers may arrive late.</span> : "From any Nigerian bank app."} This account expires in <b className="mono" id="ngnCount">{fmtCountdown(temp.expiresAt - now)}</b>.</p>
      <div className="va-details">
        {fields.map(([k, val], i) => (
          <div className="va-field" key={k}>
            <div><div className="va-k">{k}</div><div className={`va-v ${/Amount|number/.test(k) ? "mono" : ""}`}>{val}</div></div>
            {k !== "Bank" && (
              <button type="button" className="va-copy" data-ngncopy={i} aria-label={`Copy ${k}`} onClick={() => copy(i)}>{copied === i ? "Copied" : "Copy"}</button>
            )}
          </div>
        ))}
      </div>
      <div className="va-actions"><button className="btn-secondary" id="ngnTempShare" onClick={share}>Share details</button></div>
      <div className="va-note">Use it once. A transfer for a different amount, or after it expires, is [handling].</div>
    </>
  );
}
