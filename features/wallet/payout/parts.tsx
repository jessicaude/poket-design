"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { COUNTRY_OPTIONS, US_STATES, type Draft } from "./payoutMath";

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

type Option = { value: string; label: string; sub?: string; icon?: string };

/** dropdownHtml(id, options, selected, placeholder) and its data-dropdown-toggle / data-dropdown-option bindings. */
export function Dropdown({ id, options, value, placeholder, onChange }: { id: string; options: Option[]; value?: string; placeholder: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.value === value);
  return (
    <div className="dropdown" data-dropdown-root={id}>
      <div className={`dropdown-trigger ${open ? "open" : ""} ${!sel ? "placeholder" : ""}`} data-dropdown-toggle={id} role="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="dt-label">{sel?.icon && <span className="icon-16" dangerouslySetInnerHTML={{ __html: sel.icon }} />}<span>{sel ? sel.label : placeholder}</span></span>
        <span className="dt-chevron" dangerouslySetInnerHTML={{ __html: WICON.chevronDown }} />
      </div>
      {open && (
        <div className="dropdown-menu" role="listbox">
          {options.length ? options.map((o) => (
            <div key={o.value} className={`dropdown-option ${o.value === value ? "sel" : ""}`} data-dropdown-option={`${id}::${o.value}`} role="option" aria-selected={o.value === value} onClick={() => { setOpen(false); onChange(o.value); }}>
              {o.icon && <span className="icon-16" dangerouslySetInnerHTML={{ __html: o.icon }} />}
              <span className="do-meta"><span>{o.label}</span>{o.sub && <span className="do-sub">{o.sub}</span>}</span>
              <span className="do-check" dangerouslySetInnerHTML={{ __html: WICON.check }} />
            </div>
          )) : <div className="dropdown-empty">No options available.</div>}
        </div>
      )}
    </div>
  );
}

/** payoutAddressFieldsHtml(d). */
export function AddressFields({ d, edit }: { d: Draft; edit: (p: Draft) => void }) {
  return (
    <>
      <label className="field-label">Billing address</label>
      <input className="field-input" id="payoutAddressInput" placeholder="Street address" value={d.address || ""} onChange={(e) => edit({ address: e.target.value })} />
      <label className="field-label">City</label>
      <input className="field-input" id="payoutCityInput" placeholder="City" value={d.city || ""} onChange={(e) => edit({ city: e.target.value })} />
      <div style={{ display: "flex", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">State / province</label>
          {d.country === "United States"
            ? <Dropdown id="payoutState" options={US_STATES} value={d.state} placeholder="Select state" onChange={(v) => edit({ state: v })} />
            : <input className="field-input" id="payoutStateInput" placeholder="State" value={d.state || ""} onChange={(e) => edit({ state: e.target.value })} />}
        </div>
        <div style={{ flex: 1 }}><label className="field-label">ZIP / postal code</label><input className="field-input mono" id="payoutZipInput" placeholder="ZIP code" value={d.zip || ""} onChange={(e) => edit({ zip: e.target.value })} /></div>
      </div>
      <label className="field-label">Country</label>
      <Dropdown id="payoutCountry" options={COUNTRY_OPTIONS} value={d.country} placeholder="Select country"
        onChange={(v) => edit(v !== "United States" ? { country: v, state: "" } : { country: v })} />
    </>
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
