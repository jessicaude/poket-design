"use client";
import { NairaPausedBanner } from "../NairaPausedBanner";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { NGN_VA, useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { useWithdrawals } from "../payout/useWithdrawals";
import { useWalletNav } from "../useWalletNav";
import { useConvert } from "../convert/useConvert";
import { useSend } from "../send/useSend";
import { OnHoldLink, WithdrawalRow } from "./parts";
import { ConversionRow } from "./ConversionRow";

/**
 * The NGN balance: the reference's tHoldingDetail for a cash balance, with "₦X on hold" under the balance when
 * anything is reserved. Actions: Deposit, Send (with this balance as the source) and Convert.
 */
export function NgnBalanceScreen() {
  const balance = useNgn((s) => s.ngnBalance);
  const reserved = useNgn((s) => s.ngnReserved);
  const openDeposit = useNgn((s) => s.open);
  const back = useWalletNav((s) => s.back);
  const withdrawals = useWithdrawals((s) => s.list).filter((w) => (w.sourceKey ? w.sourceKey.startsWith("cash:NGN:") : w.currency === "NGN"));
  // Conversions from or to naira, newest first with the sends.
  const conversions = useConvert((s) => s.conversions).filter((c) => c.from.startsWith("cash:NGN:") || c.to.startsWith("cash:NGN:"));
  const list = [
    ...withdrawals.map((w) => ({ at: w.createdAt, el: <WithdrawalRow key={w.id} w={w} /> })),
    ...conversions.map((c) => ({ at: c.createdAt, el: <ConversionRow key={c.id} c={c} /> })),
  ].sort((a, b) => b.at - a.at);
  return (
    <>
      {/* WGT-13: while the naira partner is down */}
      <NairaPausedBanner />
      <BackRow id="backFromDetail" label="Cash" onClick={back} />
      <div className="center-col" style={{ padding: "2px 0 4px" }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "10px" }}>
          <div className="badge" style={{ width: "44px", height: "44px" }} dangerouslySetInnerHTML={{ __html: WICON.ngFlag }} />
        </div>
        <p className="step-sub" style={{ marginBottom: "2px" }}>Nigerian Naira</p>
        <div className="step-title" id="ngnBalanceAmount" style={{ fontSize: "28px", letterSpacing: "-.02em" }}><Grey>{fmtCurrency(balance, "NGN")}</Grey></div>
        {reserved > 0 && <OnHoldLink id="ngnOnHold" reserved={reserved} line />}
      </div>
      <div className="action-row" style={{ marginTop: "14px" }}>
        <button className="action-btn" id="detailDeposit" onClick={() => openDeposit("deposit-method")}><span className="ic"><Raw html={WICON.add} /></span>Deposit</button>
        {/* Send replaces Transfer and Withdraw (docs/decisions.md), with the NGN balance as the source. */}
        <button className="action-btn" id="detailSend" onClick={() => useSend.getState().open("cash:NGN:open")}><span className="ic"><Raw html={WICON.send} /></span>Send</button>
        <button className="action-btn" id="detailConvert" onClick={() => useConvert.getState().start({ from: "cash:NGN:open" })}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
      </div>
      {NGN_VA.supported && <NgnAccountCard />}
      <div className="section-title">Transaction history</div>
      {list.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No activity yet.</div>
        : <div className="section-card">{list.map((x) => x.el)}</div>}
    </>
  );
}

/**
 * vaCardHtml('NGN'): with no dedicated account, "Get NGN account details" (Tier 0: "Verify your identity to get account
 * details", and it opens the step-up, not a top-up: top-ups stay under Deposit); once there's one, its details: the
 * status chip and the account number's last 4. Rejected: "Not approved" with Try again, which restarts the flow.
 * Tapping opens the account flow from here (useNgn.openAccountDetails).
 */
function NgnAccountCard() {
  const dedicated = useNgn((s) => s.dedicated);
  const tier = useNgn((s) => s.tier);
  const open = useNgn((s) => s.openAccountDetails);
  const keys = { role: "button" as const, tabIndex: 0, onClick: open, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } };
  if (dedicated?.status === "rejected") {
    // NEW copy: the reference's "Card deposits are still available" doesn't apply to naira
    return (
      <div className="va-card" id="vaOpen" data-vacur="NGN" style={{ cursor: "default" }}>
        <div className="va-ic"><Raw html={WICON.bank} /></div>
        <div className="va-meta">
          <div className="t1">NGN account details <span className="va-status err">Not approved</span></div>
          <div className="t2">We couldn&apos;t open your account. Try again or contact support.</div>
        </div>
        <button type="button" className="va-copy" id="vaRetry" onClick={open}>Try again</button>
      </div>
    );
  }
  if (!dedicated) {
    return (
      <div className="va-card va-empty" id="vaOpen" data-vacur="NGN" {...keys}>
        <div className="va-ic"><Raw html={WICON.bank} /></div>
        <div className="va-meta">
          <div className="t1">Get NGN account details</div>
          <div className="t2">{tier < 1 ? "Verify your identity to get account details" : `Receive NGN by ${NGN_VA.rails}. Free to receive.`}</div>
        </div>
        <span className="va-chev">›</span>
      </div>
    );
  }
  const status = ({ ready: ["", "Ready"], pending: ["warn", "Setting up"], frozen: ["muted", "Frozen"] } as const)[dedicated.status];
  const first = dedicated.status === "ready" || dedicated.status === "frozen" ? NGN_VA.fields(dedicated.num)[0] : null;
  return (
    <div className="va-card" id="vaOpen" data-vacur="NGN" {...keys}>
      <div className="va-ic"><Raw html={WICON.bank} /></div>
      <div className="va-meta">
        <div className="t1">NGN account details <span className={`va-status ${status[0]}`}>{status[1]}</span></div>
        <div className="t2">{first ? <>{first[0]} <span className="mono">••{first[1].replace(/\s/g, "").slice(-4)}</span> · {NGN_VA.bank}</> : "Usually ready within 1-2 business days"}</div>
      </div>
      <span className="va-chev">›</span>
    </div>
  );
}
