"use client";
import { useEffect, useRef } from "react";
import { backToWallet } from "../session";
import { WaitingScreen } from "../WaitingScreen";

/** How long the completed tracker shows before the account details. */
export const SETUP_DONE_MS = 1200;

/**
 * "Setting up your {cur} account": account details waiting for the partner bank's review (USD today; the same screen
 * for any currency whose account is pending). The waiting state (WaitingScreen): Details submitted (done), Bank review
 * (current, "Usually 1 to 2 business days"), Account ready. Once `ready` (the bank approved; demo: "Account
 * approved"), the tracker completes, then `onDone` shows the account details. "Back to wallet"; "Deposit by card"
 * opens the card top-up, where there is one (`onCard`; NGN has none).
 */
export function AccountSetup({ cur, flag, ready, onDone, onCard }: { cur: string; flag: string; ready: boolean; onDone: () => void; onCard?: () => void }) {
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => done.current(), SETUP_DONE_MS);
    return () => clearTimeout(t);
  }, [ready]);
  return (
    <WaitingScreen id="vaPending" graphic={flag} title={`Setting up your ${cur} account`} line="We’ll let you know when it’s ready."
      current={ready ? 3 : 1}
      steps={[{ label: "Details submitted" }, { label: "Bank review", sub: "Usually 1 to 2 business days" }, { label: "Account ready" }]}>
      <button className="btn-primary" id="vaPendingHome" onClick={backToWallet}>Back to wallet</button>
      {onCard && <button className="btn-secondary" id="vaPendingCard" style={{ width: "100%", marginTop: "10px" }} onClick={onCard}>Deposit by card</button>}
    </WaitingScreen>
  );
}
