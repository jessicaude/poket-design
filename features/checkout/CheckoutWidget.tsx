"use client";
import { AccountActivityScreen, AccountDisputeScreen, AccountTabbar, PayDetailScreen } from "./screens/AccountScreens";
import { useEffect, type ComponentType } from "react";
import { Raw } from "@/components/ui/Raw";
import { CLOSE_ICON, POKET_WORDMARK } from "@/lib/icons";
import { useCheckout, type Screen } from "./useCheckout";
import { SignupScreen } from "./screens/SignupScreen";
import { PayScreen } from "./screens/PayScreen";
import { AddMethodScreen } from "./screens/AddMethodScreen";
import { AddCardScreen } from "./screens/AddCardScreen";
import { BankTransferScreen } from "./screens/BankTransferScreen";
import { LockedScreen } from "./screens/LockedScreen";
import { DeclinedScreen, DoneScreen, ProcessingScreen } from "./screens/StatusScreens";
import { BlockedScreen, DetailsScreen, IdDoneScreen, IdRetryScreen, IdReviewScreen, VendorScreen, VerifyingScreen } from "./screens/IdentityScreens";

/**
 * One component per screen; `step` is the stepper position as in the prototype's stepper(): Account 0, Identity 1,
 * Payment 2. null hides the stepper.
 */
const SCREENS: Record<Screen, { C: ComponentType; step: number | null; account?: true }> = {
  signup: { C: SignupScreen, step: 0 },
  details: { C: DetailsScreen, step: 1 },
  vendor: { C: VendorScreen, step: 1 },
  verifying: { C: VerifyingScreen, step: 1 },
  "id-review": { C: IdReviewScreen, step: 1 },
  "id-retry": { C: IdRetryScreen, step: 1 },
  "id-done": { C: IdDoneScreen, step: 1 },
  blocked: { C: BlockedScreen, step: null },
  locked: { C: LockedScreen, step: null },
  pay: { C: PayScreen, step: 2 },
  "add-method": { C: AddMethodScreen, step: 2 },
  "add-card": { C: AddCardScreen, step: 2 },
  "bank-transfer": { C: BankTransferScreen, step: 2 },
  processing: { C: ProcessingScreen, step: 2 },
  declined: { C: DeclinedScreen, step: 2 },
  done: { C: DoneScreen, step: null },
  // WGT-12: the Poket account (the reference's account:true screens: the taller .wg.acct frame and the tab bar)
  activity: { C: AccountActivityScreen, step: null, account: true },
  "pay-detail": { C: PayDetailScreen, step: null, account: true },
  dispute: { C: AccountDisputeScreen, step: null, account: true },
};
/** Under $500 there's no identity step, so the stepper shows two steps (Payment moves to position 1). */
const STEPS_ID = ["Account", "Identity", "Payment"];
const STEPS_NO_ID = ["Account", "Payment"];

/** The widget frame: .scrim > .wg with header, stepper and the current screen. Markup from reference/poket-widgets.html. */
export function CheckoutWidget() {
  const { open, screen, onboarding, close, toast, skipId } = useCheckout();

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("wg-open");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("wg-open"); window.removeEventListener("keydown", onKey); };
  }, [open, close]);

  const { C, step: rawStep, account } = SCREENS[screen];
  const labels = skipId ? STEPS_NO_ID : STEPS_ID;
  const step = rawStep === null ? null : skipId && rawStep === 2 ? 1 : rawStep;
  return (
    <>
      <div className={`scrim ${open ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        {open && (
          <div className={`wg ${account ? "acct" : ""}`} role="dialog" aria-modal="true" aria-label="Poket checkout" data-testid="checkout-widget">
            <div className="wg-head">
              <span className="centry-lock" role="img" aria-label="CentryOS" />
              <Raw html={POKET_WORDMARK} />
              <span className="head-actions" />
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => close()}><Raw html={CLOSE_ICON} /></button>
            </div>
            <div className="wg-body" key={screen}>
              {onboarding && step !== null && (
                <div className={`steps ${labels.length === 2 ? "two" : ""}`} role="list" aria-label="Progress">
                  {labels.map((l, i) => (
                    <div key={l} role="listitem" className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}><i />{l}</div>
                  ))}
                </div>
              )}
              <C />
            </div>
            {account && <AccountTabbar />}
          </div>
        )}
      </div>
      <div className={`toast ${toast ? "on" : ""}`} role="status">{toast}</div>
    </>
  );
}
