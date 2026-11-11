"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";

/** button.back-row with the reference's icons.back. */
export function BackRow({ id, label = "Back", onClick }: { id: string; label?: string; onClick: () => void }) {
  return <button className="back-row" id={id} onClick={onClick}><Raw html={WICON.back} /> {label}</button>;
}

/**
 * greyCurrencyCodes(): "₦50,000.00 NGN" → "₦50,000.00 <span class=cur-code>NGN</span>", for any amount followed by a code.
 * Use it on text the reference renders into #panelBody.
 */
export function Grey({ children }: { children: string }) {
  const parts = children.split(/([\d.,]+)\s?(USD|NGN|EUR|GBP|GHS)\b/);
  if (parts.length === 1) return <>{children}</>;
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    out.push(<Fragment key={i}>{parts[i]}</Fragment>);
    if (i + 2 < parts.length) out.push(<Fragment key={i + 1}>{parts[i + 1]} <span className="cur-code">{parts[i + 2]}</span></Fragment>);
  }
  return <>{out}</>;
}

/**
 * withSpinner(btn, delay, cb): the button shows .btn-spinner and is disabled, then cb runs after `delay` ms.
 */
export function SpinButton({ id, className = "btn-primary", style, disabled, delay, onClick, children }: {
  id: string; className?: string; style?: React.CSSProperties; disabled?: boolean; delay: number; onClick: () => unknown; children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  return (
    <button className={className} id={id} style={style} disabled={disabled || busy} onClick={() => {
      if (disabled || busy) return;
      setBusy(true);
      setTimeout(async () => { await onClick(); if (alive.current) setBusy(false); }, delay);
    }}>
      {busy && <span className={`btn-spinner${className.includes("btn-primary") ? "" : " dark"}`} />}
      {children}
    </button>
  );
}


/** The amount keypad: 1-9, a hidden spacer, 0 and backspace. */
export function Keypad({ dataKey, onKey }: { dataKey: string; onKey: (k: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
  return (
    <div className="keypad">
      {[0, 1, 2, 3].map((rw) => (
        <div className="keypad-row" key={rw}>
          {keys.slice(rw * 3, rw * 3 + 3).map((k, i) => {
            const data = { [`data-${dataKey}`]: k };
            if (k === "back") return <button key={i} className="keypad-key" {...data} aria-label="Delete" onClick={() => onKey(k)} dangerouslySetInnerHTML={{ __html: WICON.backspace }} />;
            if (k === "") return <span key={i} className="keypad-key" style={{ visibility: "hidden" }} />;
            return <button key={i} className="keypad-key" {...data} onClick={() => onKey(k)}>{k}</button>;
          })}
        </div>
      ))}
    </div>
  );
}
