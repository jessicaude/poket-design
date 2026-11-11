"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../ngn/useNgn";
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
  // Conversions from or to naira (including merchant-held naira), newest first with the withdrawals.
  const conversions = useConvert((s) => s.conversions).filter((c) => c.from.startsWith("cash:NGN:") || c.to.startsWith("cash:NGN:"));
  const list = [
    ...withdrawals.map((w) => ({ at: w.createdAt, el: <WithdrawalRow key={w.id} w={w} /> })),
    ...conversions.map((c) => ({ at: c.createdAt, el: <ConversionRow key={c.id} c={c} /> })),
  ].sort((a, b) => b.at - a.at);
  return (
    <>
      <BackRow id="backFromDetail" label="Cash" onClick={back} />
      <div className="center-col" style={{ padding: "2px 0 4px" }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "10px" }}>
          <div className="badge" style={{ width: "44px", height: "44px" }} dangerouslySetInnerHTML={{ __html: WICON.ngFlag }} />
        </div>
        <p className="step-sub" style={{ marginBottom: "2px" }}>Nigerian Naira</p>
        <div className="step-title" id="ngnBalanceAmount" style={{ fontSize: "28px", letterSpacing: "-.02em" }}><Grey>{fmtCurrency(balance, "NGN")}</Grey></div>
        {reserved > 0 && <OnHoldLink id="ngnOnHold" reserved={reserved} />}
      </div>
      <div className="action-row" style={{ marginTop: "14px" }}>
        <button className="action-btn" id="detailDeposit" onClick={() => openDeposit("deposit-method")}><span className="ic"><Raw html={WICON.add} /></span>Deposit</button>
        {/* Send replaces Transfer and Withdraw (docs/decisions.md), with the NGN balance as the source. */}
        <button className="action-btn" id="detailSend" onClick={() => useSend.getState().open("cash:NGN:open")}><span className="ic"><Raw html={WICON.send} /></span>Send</button>
        <button className="action-btn" id="detailConvert" onClick={() => useConvert.getState().start({ from: "cash:NGN:open" })}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
      </div>
      <div className="section-title">Transaction history</div>
      {list.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No activity yet.</div>
        : <div className="section-card">{list.map((x) => x.el)}</div>}
    </>
  );
}
