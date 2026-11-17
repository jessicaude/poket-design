"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Raw } from "@/components/ui/Raw";
import { cvBadgeHtml, cvParse } from "./convert/convertMath";
import { Keypad } from "./payout/parts";
import { usePanelDock } from "./panelDock";

/**
 * The wallet's one amount entry (Send's You send, Convert's From, the daily limit, the card top-up, Add naira): a box
 * with its label (and what's on the right of it: Available and Max, the tier's maximum...), the currency chip with
 * its flag, and the amount in the wallet's large amount style; tapping the amount opens the keypad under it, with
 * Done. Done, or a click anywhere outside the field (composedPath() sees through the shadow root), closes the keypad;
 * on click, not pointerdown, so the tapped control acts first. `children` follow the box: what the screen adds (They
 * get, Convert's To box, a limit line, a hint) and its fee or quote card; `action` (the screen's button) comes right
 * under them. While the keypad is open, the button and the keypad dock at the bottom of the panel, just above the tab
 * bar (panelDock.ts): the button directly above the keypad, nothing to scroll to; the amounts and the fee card stay
 * at the top and scroll if they need to. Closed, the button is back under the fee card. Each screen keeps its own ids: `id` (the box), `amountId`, `keypadId`,
 * `doneId`, and the keys' data-`dataKey`.
 */
export function AmountField({ id, label, right, chip, amountId, ariaLabel, text, error, dataKey, keypadId, doneId, onKey, children, action, style }: {
  id: string;
  label: string;
  right?: ReactNode;
  /** The currency chip: AmountChip, or a picker button (Send's Pay from, Convert's From). */
  chip: ReactNode;
  amountId: string;
  ariaLabel: string;
  /** The amount as shown ("25,000.00"). */
  text: string;
  /** Over a balance or a limit: the amount in red. */
  error?: boolean;
  dataKey: string;
  keypadId: string;
  doneId: string;
  onKey: (k: string) => void;
  children?: ReactNode;
  /** The screen's button (Review, Continue, Save...): under the fee card, or docked above the keypad. */
  action?: ReactNode;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null), docked = useRef<HTMLDivElement>(null), box = useRef<HTMLDivElement>(null);
  const dock = usePanelDock((s) => s.el);
  // Docking shrinks the body: keep the amount being typed in view above the keypad
  useEffect(() => { if (open) box.current?.scrollIntoView({ block: "nearest" }); }, [open]);
  useEffect(() => {
    if (!open) return;
    // Outside the field: not the box and not the dock (the keypad and the button are portalled there)
    const close = (e: MouseEvent) => {
      const path = e.composedPath();
      if ((!ref.current || !path.includes(ref.current)) && (!docked.current || !path.includes(docked.current))) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div ref={ref} style={style}>
      <div className="cv-box" id={id} ref={box} style={open ? { borderColor: "var(--brand-500)", boxShadow: "0 0 0 3px var(--brand-100)" } : undefined}>
        <div className="cv-box-top"><span>{label}</span>{right !== undefined && <span>{right}</span>}</div>
        <div className="cv-box-row">
          {chip}
          <span className={`cv-amt mono ${error ? "err" : ""}`} id={amountId} role="button" tabIndex={0} aria-label={ariaLabel}
            aria-expanded={open} style={{ cursor: "text" }} onClick={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter") setOpen(true); }}>{text}</span>
        </div>
      </div>
      {children}
      {!(open && dock) && action}
      {open && (() => {
        const keypad = (
          <div id={keypadId} style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
              <button type="button" className="cv-max" id={doneId} onClick={() => setOpen(false)}>Done</button>
            </div>
            <Keypad dataKey={dataKey} onKey={onKey} />
          </div>
        );
        // Docked above the tab bar, the button directly above the keypad; with no panel to dock to, under the field
        return dock ? createPortal(<div ref={docked} className="amount-dock">{action}{keypad}</div>, dock) : keypad;
      })()}
    </div>
  );
}

/** A currency chip that isn't a picker: the cash currency's flag and code (the daily limit, top-ups). */
export function AmountChip({ cur }: { cur: string }) {
  return <span className="cv-pick" aria-disabled="true"><Raw html={cvBadgeHtml(cvParse(`cash:${cur}:open`), 28)} /><span className="cv-pick-name">{cur}</span></span>;
}

/** Minor units as the amount shows them: 2500000 → "25,000.00". */
export const amountPlain = (minor: number) => (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A keypad key on an amount in minor units: a digit appends, back removes the last; capped at `cap`. */
export const keyAmount = (minor: number, k: string, cap = 1e12) => (k === "back" ? Math.floor(minor / 10) : minor >= cap ? minor : minor * 10 + Number(k));
