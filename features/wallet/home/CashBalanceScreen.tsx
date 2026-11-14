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
import { useDeposit } from "../deposit/useDeposit";
import { VA_SPEC, isVaCurrency } from "../deposit/vaSpec";
import { useWalletNav } from "../useWalletNav";
import { NgnAccountCard } from "../withdrawals/NgnBalanceScreen";
import { OnHoldLink } from "../withdrawals/parts";
import { CURRENCY_ICON, CURRENCY_NAME, cashRows, type CashRow } from "./homeData";
import { FiatTag } from "./WalletHome";


/**
 * Every cash balance's screen, one template (the reference's tHoldingDetail): the balance (with "₦X on hold" only
 * when something is), Deposit, Send and Convert, the account card (vaCardHtml; NGN's own flow), then Transaction
 * history (filter, day groups) with Statement. Stablecoins keep
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
  const vas = useDeposit((s) => s.vas);
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
        <button className="action-btn" id="detailDeposit" onClick={() => (isVaCurrency(cur) ? useDeposit.getState().openFor(cur) : openNgn("deposit-method"))}>
          <span className="ic"><Raw html={WICON.add} /></span>Deposit</button>
        {/* Send replaces Transfer and Payout (docs/decisions.md), with this balance as the source */}
        <button className="action-btn" id="detailSend" onClick={() => useSend.getState().open(key)}><span className="ic"><Raw html={WICON.send} /></span>Send</button>
        <button className="action-btn" id="detailConvert" onClick={() => useConvert.getState().start({ from: key })}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
      </div>
      {cur === "NGN" && <NgnAccountCard />}
      {isVaCurrency(cur) && <VaCard cur={cur} va={vas[cur]} />}
      <div className="section-title">Transaction history
        <span className="btn-ghost" id="balanceStatement" role="button" tabIndex={0} style={{ textTransform: "none", letterSpacing: 0 }}
          onClick={() => push({ name: "statement", cur })} onKeyDown={(e) => { if (e.key === "Enter") push({ name: "statement", cur }); }}>Statement</span>
      </div>
      <History id="balanceHistory" items={items} empty="No activity yet." />
    </>
  );
}

/** vaCardHtml: "Get {cur} account details", or the account's status and first detail. Opens tVa. */
function VaCard({ cur, va }: { cur: Exclude<CashCurrency, "NGN">; va: { status: "pending" | "ready"; num: string } | undefined }) {
  const spec = VA_SPEC[cur];
  const open = () => useDeposit.getState().openAccount(cur);
  if (!va) return (
    <div className="va-card va-empty" id="vaOpen" data-vacur={cur} role="button" tabIndex={0} onClick={open}>
      <div className="va-ic"><Raw html={WICON.bank} /></div>
      <div className="va-meta"><div className="t1">Get {cur} account details</div><div className="t2">Receive {cur} by {spec.rails}. {depositFeeText(cur)}.</div></div>
      <span className="va-chev">{"›"}</span>
    </div>
  );
  const first = va.status === "ready" ? spec.fields(va.num)[0] : null;
  return (
    <div className="va-card" id="vaOpen" data-vacur={cur} role="button" tabIndex={0} onClick={open}>
      <div className="va-ic"><Raw html={WICON.bank} /></div>
      <div className="va-meta"><div className="t1">{cur} account details <span className={`va-status ${va.status === "pending" ? "warn" : ""}`}>{va.status === "pending" ? "Setting up" : "Ready"}</span></div>
        <div className="t2">{first ? <>{first[0]} <span className="mono">••{first[1].replace(/\s/g, "").slice(-4)}</span> · {spec.bank}</> : "Usually ready within 1-2 business days"}</div></div>
      <span className="va-chev">{"›"}</span>
    </div>
  );
}
