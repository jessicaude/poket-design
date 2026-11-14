"use client";
import { Raw } from "@/components/ui/Raw";
import { depositFeeText } from "@/lib/fees";
import { WICON } from "@/lib/icons";
import { useConvert } from "../convert/useConvert";
import { History, useActivity } from "../history/History";
import { NairaPausedBanner } from "../NairaPausedBanner";
import { useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { useSend } from "../send/useSend";
import { useHoldings, type CashCurrency } from "../useHoldings";
import { showNotPorted } from "../useWalletToast";
import { useWalletNav } from "../useWalletNav";
import { NgnAccountCard } from "../withdrawals/NgnBalanceScreen";
import { OnHoldLink } from "../withdrawals/parts";
import { CURRENCY_ICON, CURRENCY_NAME, cashRows, type CashRow } from "./homeData";
import { FiatTag } from "./WalletHome";

/** VA_SPEC's rails, for the "Get … account details" card (vaCardHtml) on USD, EUR and GBP. */
const VA_RAILS: Partial<Record<CashCurrency, string>> = { USD: "ACH or wire", EUR: "SEPA or SEPA Instant", GBP: "Faster Payments or Bacs" };

/**
 * Every cash balance's screen, one template (the reference's tHoldingDetail): the balance (with "₦X on hold" only
 * when something is), Deposit, Send and Convert, the account card where there are account details (NGN's own flow;
 * USD, EUR and GBP not ported yet), then Transaction history (filter, day groups) with Statement. Stablecoins keep
 * HoldingDetailScreen.
 */
export function CashBalanceScreen({ cur, bucket }: { cur: CashCurrency; bucket: CashRow["bucket"] }) {
  // Re-render on any balance change
  useNgn((s) => s.ngnBalance); useHoldings((s) => s.cash); useHoldings((s) => s.fiatOnly);
  const reserved = useNgn((s) => s.ngnReserved);
  const openNgn = useNgn((s) => s.open);
  const back = useWalletNav((s) => s.back);
  const push = useWalletNav((s) => s.push);
  const key = `cash:${cur}:${bucket}`;
  const balance = cashRows(false).find((r) => r.currency === cur && r.bucket === bucket)?.balance ?? 0;
  const onHold = cur === "NGN" && bucket === "open" ? reserved : 0;
  const items = useActivity().filter((x) => x.keys.includes(key));
  const rails = VA_RAILS[cur];
  return (
    <>
      {cur === "NGN" && <NairaPausedBanner />}
      <BackRow id="backFromDetail" label="Cash" onClick={back} />
      <div className="center-col" style={{ padding: "2px 0 4px" }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "10px" }}>
          <div className="badge" style={{ width: "44px", height: "44px" }} dangerouslySetInnerHTML={{ __html: WICON[CURRENCY_ICON[cur]] }} />
        </div>
        <p className="step-sub" style={{ marginBottom: "2px" }}>{CURRENCY_NAME[cur]}{bucket === "fiat" && <FiatTag info={false} />}</p>
        <div className="step-title" id="balanceAmount" style={{ fontSize: "28px", letterSpacing: "-.02em" }}><Grey>{fmtCurrency(balance, cur)}</Grey></div>
        {onHold > 0 && <OnHoldLink id="balanceOnHold" reserved={onHold} line />}
      </div>
      <div className="action-row" style={{ marginTop: "14px" }}>
        <button className="action-btn" id="detailDeposit" onClick={() => (cur === "NGN" ? openNgn("deposit-method") : showNotPorted(`Depositing ${cur} isn’t ported yet.`))}>
          <span className="ic"><Raw html={WICON.add} /></span>Deposit</button>
        {/* Send replaces Transfer and Payout (docs/decisions.md), with this balance as the source */}
        <button className="action-btn" id="detailSend" onClick={() => useSend.getState().open(key)}><span className="ic"><Raw html={WICON.send} /></span>Send</button>
        <button className="action-btn" id="detailConvert" onClick={() => useConvert.getState().start({ from: key })}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
      </div>
      {cur === "NGN" && <NgnAccountCard />}
      {rails && (
        <div className="va-card va-empty" id="vaOpen" data-vacur={cur} role="button" tabIndex={0} onClick={() => showNotPorted(`${cur} account details aren’t ported yet.`)}>
          <div className="va-ic"><Raw html={WICON.bank} /></div>
          <div className="va-meta"><div className="t1">Get {cur} account details</div><div className="t2">Receive {cur} by {rails}. {depositFeeText(cur)}.</div></div>
          <span className="va-chev">{"›"}</span>
        </div>
      )}
      <div className="section-title">Transaction history
        <span className="btn-ghost" id="balanceStatement" role="button" tabIndex={0} style={{ textTransform: "none", letterSpacing: 0 }}
          onClick={() => push({ name: "statement", cur })} onKeyDown={(e) => { if (e.key === "Enter") push({ name: "statement", cur }); }}>Statement</span>
      </div>
      <History id="balanceHistory" items={items} empty="No activity yet." />
    </>
  );
}
