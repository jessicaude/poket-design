"use client";
import { listPoketActivity } from "@/lib/mock-api";
import { useWithdrawals } from "@/features/wallet/payout/useWithdrawals";
import { holderName } from "@/features/wallet/ngn/useNgn";

/**
 * Demo only: what each Poket user you pay sees in their own activity (WGT-07): what they received, in their currency
 * (USD when naira converted on receipt), with its MERCHANT-HELD or FIAT-ONLY tag. The prototype's .events panel.
 */
export function RecipientActivityPanel() {
  useWithdrawals((s) => s.list); // a send (or a status change) refreshes the list
  const items = listPoketActivity();
  return (
    // On the left: the wallet sits in the middle, and the right-hand position overlaps its tab bar
    <aside className="events" aria-live="polite" aria-label="Recipient's activity" style={{ left: "16px", right: "auto" }}>
      <header><span>Recipient&apos;s activity</span><small>what Poket users you pay see</small></header>
      <ol data-testid="recipientActivity">
        {items.length === 0 ? <li className="empty">Nothing yet. Send to a Poket user.</li> : items.map((a) => (
          <li key={a.id} data-recipient={a.recipientId}>
            <code>{a.recipientName}</code>
            <pre>{`Received ${a.amountText} from ${holderName()}${a.tag ? ` · ${a.tag}` : ""}`}</pre>
          </li>
        ))}
      </ol>
    </aside>
  );
}
