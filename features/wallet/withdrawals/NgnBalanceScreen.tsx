"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { usePayout } from "../payout/usePayout";
import { useWithdrawals } from "../payout/useWithdrawals";
import { useWalletNav } from "../useWalletNav";
import { OnHoldLink, WithdrawalRow } from "./parts";

/**
 * The NGN balance: the reference's tHoldingDetail for a cash balance, with "₦X on hold" under the balance when
 * anything is reserved. Payout is labelled Withdraw, as on the home screen. Transfer and Convert aren't ported.
 */
export function NgnBalanceScreen() {
  const balance = useNgn((s) => s.ngnBalance);
  const reserved = useNgn((s) => s.ngnReserved);
  const openDeposit = useNgn((s) => s.open);
  const openPayout = usePayout((s) => s.open);
  const back = useWalletNav((s) => s.back);
  const list = useWithdrawals((s) => s.list).filter((w) => w.currency === "NGN");
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
        {/* TODO: Transfer and Convert open their flows once ported. */}
        <button className="action-btn" id="detailTransfer"><span className="ic"><Raw html={WICON.transfer} /></span>Transfer</button>
        <button className="action-btn" id="detailPayout" onClick={() => openPayout("NGN")}><span className="ic"><Raw html={WICON.bank} /></span>Withdraw</button>
        <button className="action-btn" id="detailConvert"><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
      </div>
      <div className="section-title">Transaction history</div>
      {list.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No activity yet.</div>
        : <div className="section-card">{list.map((w) => <WithdrawalRow key={w.id} w={w} />)}</div>}
    </>
  );
}
