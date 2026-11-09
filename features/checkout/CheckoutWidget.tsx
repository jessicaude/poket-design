"use client";
import { useEffect, type ComponentType } from "react";
import { Raw } from "@/components/ui/Raw";
import { CLOSE_ICON, POKET_WORDMARK } from "@/lib/icons";
import { useCheckout, type Screen } from "./useCheckout";
import { SignupScreen } from "./screens/SignupScreen";
import { PayScreen } from "./screens/PayScreen";
import { AddMethodScreen } from "./screens/AddMethodScreen";
import { AddCardScreen } from "./screens/AddCardScreen";
import { DeclinedScreen, DoneScreen, IdNeededScreen, ProcessingScreen } from "./screens/StatusScreens";

/** One component per screen; `step` is the stepper position (null hides the stepper), as in the prototype. */
const SCREENS: Record<Screen, { C: ComponentType; step: number | null }> = {
  signup: { C: SignupScreen, step: 0 },
  "id-needed": { C: IdNeededScreen, step: 1 },
  pay: { C: PayScreen, step: 1 },
  "add-method": { C: AddMethodScreen, step: 1 },
  "add-card": { C: AddCardScreen, step: 1 },
  processing: { C: ProcessingScreen, step: 1 },
  declined: { C: DeclinedScreen, step: 1 },
  done: { C: DoneScreen, step: null },
};
/** Under $500 there's no identity step, so the stepper shows two steps. */
const STEPS = ["Account", "Payment"];

/** The widget frame: .scrim > .wg with header, stepper and the current screen. Markup from reference/poket-widgets.html. */
export function CheckoutWidget() {
  const { open, screen, onboarding, close, toast } = useCheckout();

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("wg-open");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("wg-open"); window.removeEventListener("keydown", onKey); };
  }, [open, close]);

  const { C, step } = SCREENS[screen];
  return (
    <>
      <div className={`scrim ${open ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        {open && (
          <div className="wg" role="dialog" aria-modal="true" aria-label="Poket checkout" data-testid="checkout-widget">
            <div className="wg-head">
              <span className="centry-lock" role="img" aria-label="CentryOS" />
              <Raw html={POKET_WORDMARK} />
              <span className="head-actions" />
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => close()}><Raw html={CLOSE_ICON} /></button>
            </div>
            <div className="wg-body" key={screen}>
              {onboarding && step !== null && (
                <div className="steps two" role="list" aria-label="Progress">
                  {STEPS.map((l, i) => (
                    <div key={l} role="listitem" className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}><i />{l}</div>
                  ))}
                </div>
              )}
              <C />
            </div>
          </div>
        )}
      </div>
      <div className={`toast ${toast ? "on" : ""}`} role="status">{toast}</div>
    </>
  );
}
