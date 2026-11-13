"use client";
import { useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { useWithdrawals } from "../payout/useWithdrawals";
import { isOnHold } from "../payout/withdrawals";
import { useWalletNav } from "../useWalletNav";
import { WithdrawalRow } from "./parts";

/** The withdrawals whose money is on hold (scheduled, held for review, sending). Not in the reference; NEW copy. */
export function OnHoldScreen() {
  const reserved = useNgn((s) => s.ngnReserved);
  const back = useWalletNav((s) => s.back);
  const held = useWithdrawals((s) => s.list).filter((w) => w.currency === "NGN" && isOnHold(w.status));
  return (
    <>
      <BackRow id="backFromOnHold" onClick={back} />
      <div className="step-title"><Grey>{`${fmtCurrency(reserved, "NGN")} on hold`}</Grey></div>
      <p className="step-sub">This money isn&rsquo;t in your available balance.</p>
      {held.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>Nothing on hold.</div>
        : <><div className="section-title">Sends on hold</div><div className="section-card">{held.map((w) => <WithdrawalRow key={w.id} w={w} />)}</div></>}
    </>
  );
}
