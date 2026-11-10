"use client";
import type { ReactNode } from "react";
import { Raw } from "@/components/ui/Raw";
import { FILTER_ICON, WICON } from "@/lib/icons";
import { useAccount } from "@/store/account";
import { useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { usePayout } from "../payout/usePayout";
import { useWithdrawals } from "../payout/useWithdrawals";
import { useConvert } from "../convert/useConvert";
import { fmtAsset } from "../convert/convertMath";
import { useHoldings, type CashCurrency, type CoinAsset, type Network } from "../useHoldings";
import { showNotPorted, useWalletToast } from "../useWalletToast";
import { useWalletNav } from "../useWalletNav";
import { ConversionRow } from "../withdrawals/ConversionRow";
import { OnHoldLink, WithdrawalRow } from "../withdrawals/parts";
import { DetailRow, ReferenceRow, formatTxDate } from "../withdrawals/TxDetail";
import {
  ASSET_NAME, CURRENCY_ICON, CURRENCY_NAME, DEMO_TXNS, assetDelta, cashRows, stablecoinRows, totalBalanceUsd, useWalletHome,
  type CashRow, type CoinRow, type DemoTx,
} from "./homeData";

/** The reference's fmt(): "$47.86 USD". */
const fmtUsd = (c: number) => fmtCurrency(c, "USD");
const FIAT_NOTE_TEXT = "Cash added by card. You can spend it or withdraw it, but it can’t be converted to stablecoin.";
const NETWORK_ICON: Record<Network, "base" | "polygon"> = { Base: "base", Polygon: "polygon" };
const ASSET_ICON: Record<CoinAsset, "usdc" | "usdt"> = { USDC: "usdc", USDT: "usdt" };

/** Re-render on any balance change. */
function useBalances() {
  useNgn((s) => s.ngnBalance); useNgn((s) => s.ngnMerchantBalance); useNgn((s) => s.ngnReserved);
  useHoldings((s) => s.cash); useHoldings((s) => s.fiatOnly); useHoldings((s) => s.coins);
}

/** FIAT-ONLY tag: tapping it explains (data-fiatinfo). */
function FiatTag({ info = true }: { info?: boolean }) {
  return (
    <span className="fiat-tag" {...(info ? { "data-fiatinfo": "", role: "button", tabIndex: 0, title: "What does this mean?" } : {})}
      onClick={info ? (e) => { e.stopPropagation(); useWalletToast.getState().showNotice("FIAT-ONLY", FIAT_NOTE_TEXT, 5000); } : undefined}>FIAT-ONLY</span>
  );
}
function FiatNote() {
  return <div className="fiat-note"><span className="fiat-tag" style={{ margin: 0 }}>FIAT-ONLY</span><span>{FIAT_NOTE_TEXT}</span></div>;
}

/** Open a cash balance: NGN keeps its own screen; everything else uses the reference's tHoldingDetail. */
function openCash(r: { currency: CashCurrency; bucket: CashRow["bucket"] }) {
  const nav = useWalletNav.getState();
  if (r.currency === "NGN" && r.bucket === "open") nav.push({ name: "ngn-balance" });
  else nav.push({ name: "holding", holding: { k: "cash", cur: r.currency, bucket: r.bucket } });
}

/** cashRowHtml(a). NGN rows (open and merchant-held) use the naira format, open NGN with "₦X on hold" (NGN rules); other currencies the reference's quantity. */
function CashRowItem({ r }: { r: CashRow }) {
  const reserved = useNgn((s) => s.ngnReserved);
  const ngnOpen = r.currency === "NGN" && r.bucket === "open";
  const qty = r.currency === "NGN" ? fmtCurrency(r.balance, "NGN") : `${(r.balance / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency}`;
  return (
    <div className="tx-row asset-item-row" data-holdtype="cash" data-holdcur={r.currency} data-holdbucket={r.bucket} style={{ cursor: "pointer" }} role="button" tabIndex={0} onClick={() => openCash(r)}>
      <div className="asset-icon-wrap"><div className="badge" dangerouslySetInnerHTML={{ __html: WICON[CURRENCY_ICON[r.currency]] }} /></div>
      <div className="tx-main">
        <div className="tx-title">{CURRENCY_NAME[r.currency]} <span className="verified-badge"><Raw html={WICON.verified} /></span></div>
        <div className="tx-sub">
          {ngnOpen
            ? <><Grey>{fmtCurrency(r.balance, "NGN")}</Grey>{reserved > 0 && <> · <OnHoldLink id="homeOnHold" reserved={reserved} /></>}</>
            : <Grey>{qty}</Grey>}
          {r.bucket === "fiat" && <FiatTag />}
          {r.bucket === "merchant" && <span className="fiat-tag">MERCHANT-HELD</span>}
        </div>
      </div>
      <div className="asset-value"><div className="tx-amt"><Grey>{fmtCurrency(r.balance, r.currency)}</Grey></div></div>
    </div>
  );
}

/** assetRowHtml(a): coin with its network badge, quantity · network, USD value and the day's drift. */
function CoinRowItem({ r }: { r: CoinRow }) {
  const push = useWalletNav((s) => s.push);
  const d = assetDelta(r.key, r.balance);
  const pos = d ? d.amtCents >= 0 : true;
  return (
    <div className="tx-row asset-item-row" data-holdtype="crypto" data-holdasset={r.asset} data-holdnet={r.network} style={{ cursor: "pointer" }} role="button" tabIndex={0}
      onClick={() => push({ name: "holding", holding: { k: "coin", asset: r.asset, net: r.network } })}>
      <div className="asset-icon-wrap">
        <div className="badge" dangerouslySetInnerHTML={{ __html: WICON[ASSET_ICON[r.asset]] }} />
        <span className="badge-network" dangerouslySetInnerHTML={{ __html: WICON[NETWORK_ICON[r.network]] }} />
      </div>
      <div className="tx-main">
        <div className="tx-title">{ASSET_NAME[r.asset]} <span className="verified-badge"><Raw html={WICON.verified} /></span></div>
        <div className="tx-sub"><Grey>{`${fmtAsset(r.balance, r.asset)} · ${r.network}`}</Grey></div>
      </div>
      <div className="asset-value">
        <div className="tx-amt"><Grey>{fmtUsd(r.balance)}</Grey></div>
        {d && <div className={`asset-delta ${pos ? "pos" : "neg"}`}><Grey>{`${pos ? "+" : "-"}${Math.abs(d.amtCents) < 1 ? "<$0.01" : fmtUsd(Math.round(Math.abs(d.amtCents)))} (${pos ? "+" : ""}${d.pct.toFixed(2)}%)`}</Grey></div>}
      </div>
    </div>
  );
}

/** The filter button and its settings panel (Hide zero-balance …). */
function FilterButton({ id, style }: { id: string; style?: React.CSSProperties }) {
  const { walletTab, settingsOpen, hideZero, set } = useWalletHome();
  const isCash = walletTab === "cash";
  return (
    <span className={`btn-ghost asset-filter ${settingsOpen || hideZero ? "on" : ""}`} id={id} role="button" tabIndex={0}
      aria-label={`Filter ${isCash ? "currencies" : "stablecoins"}`} aria-expanded={settingsOpen} title="Filter" style={style}
      onClick={() => set({ settingsOpen: !settingsOpen })} dangerouslySetInnerHTML={{ __html: FILTER_ICON }} />
  );
}
function SettingsPanel({ id }: { id: string }) {
  const { walletTab, hideZero, set } = useWalletHome();
  return (
    <div className="settings-panel">
      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "var(--txt2)", cursor: "pointer" }}>
        <input type="checkbox" id={id} checked={hideZero} onChange={(e) => set({ hideZero: e.target.checked })} />
        Hide zero-balance {walletTab === "cash" ? "currencies" : "stablecoins"}
      </label>
    </div>
  );
}

/** An activity entry: the reference's demo records, withdrawals and conversions, newest first. */
type Activity = { at: number; key: string; el: ReactNode };
function useActivity(): Activity[] {
  const withdrawals = useWithdrawals((s) => s.list);
  const conversions = useConvert((s) => s.conversions);
  return [
    ...DEMO_TXNS.map((t) => ({ at: t.ts, key: t.id, el: <DemoTxRow key={t.id} t={t} /> })),
    ...withdrawals.map((w) => ({ at: w.createdAt, key: w.id, el: <WithdrawalRow key={w.id} w={w} /> })),
    ...conversions.map((c) => ({ at: c.createdAt, key: c.id, el: <ConversionRow key={c.id} c={c} /> })),
  ].sort((a, b) => b.at - a.at);
}

/** txIcon(t) for the demo records: refund in, payment out (activity icon); deposit in (add icon). */
function demoTxIcon(t: DemoTx) {
  return { cls: t.type === "payment" ? "out" : "in", icon: t.type === "deposit" ? WICON.add : WICON.activity };
}
/** txRow(t) for a demo record. */
function DemoTxRow({ t }: { t: DemoTx }) {
  const push = useWalletNav((s) => s.push);
  const ic = demoTxIcon(t);
  return (
    <div className="tx-row" data-txid={t.id} role="button" tabIndex={0} onClick={() => push({ name: "tx", id: t.id })}>
      <div className={`tx-ic ${ic.cls}`} dangerouslySetInnerHTML={{ __html: ic.icon }} />
      <div className="tx-main"><div className="tx-title">{t.title}</div><div className="tx-sub">{t.sub}</div></div>
      <div className={`tx-amt ${t.positive ? "pos" : ""}`}><Grey>{(t.positive ? "+" : "-") + fmtUsd(t.amount)}</Grey></div>
    </div>
  );
}

/** tWalletHome. */
export function WalletHome() {
  useBalances();
  const { walletTab, masked, hideZero, settingsOpen, set } = useWalletHome();
  const email = useAccount((s) => s.account?.email) || "ada@osun.co";
  const push = useWalletNav((s) => s.push);
  const isCash = walletTab === "cash";
  const cash = isCash ? cashRows(hideZero) : [];
  const coins = isCash ? [] : stablecoinRows(hideZero);
  const activity = useActivity();
  return (
    <div className="screen-fade">
      <div className="balance-hero">
        <div className="bh-top">
          <div>
            <div className="bh-label">Total balance</div>
            <div className="bh-amount" id="totalBalance">
              {masked ? "$ ••••" : <Grey>{fmtUsd(totalBalanceUsd())}</Grey>}
              {" "}<span className="eye" id="eyeBtn" role="button" tabIndex={0} aria-label={masked ? "Show balance" : "Hide balance"}
                onClick={() => set({ masked: !masked })} dangerouslySetInnerHTML={{ __html: masked ? WICON.eyeClosed : WICON.eyeOpen }} />
            </div>
          </div>
        </div>
        <div className="bh-sub"><span className="badge-pill">{email}</span></div>
      </div>
      <div className="action-row">
        <button className="action-btn" id="actDeposit" onClick={() => showNotPorted("Use Deposit on the Nigerian Naira balance.")}><span className="ic"><Raw html={WICON.add} /></span>Deposit</button>
        <button className="action-btn" id="actTransfer" onClick={() => showNotPorted("Transfer isn't ported yet.")}><span className="ic"><Raw html={WICON.transfer} /></span>Transfer</button>
        <button className="action-btn" id="actConvert" onClick={() => useConvert.getState().start()}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
        {/* The reference opens Payout on its currency picker, which isn't ported: only NGN payouts are. */}
        <button className="action-btn" id="actPayout" onClick={() => usePayout.getState().open("NGN")}><span className="ic"><Raw html={WICON.bank} /></span>Payout</button>
      </div>
      <div className="seg">
        <div className={`seg-opt ${isCash ? "" : "sel"}`} data-wallettab="assets" role="tab" aria-selected={!isCash} onClick={() => set({ walletTab: "assets" })}>Stablecoins</div>
        <div className={`seg-opt ${isCash ? "sel" : ""}`} data-wallettab="cash" role="tab" aria-selected={isCash} onClick={() => set({ walletTab: "cash" })}>Cash</div>
      </div>
      <div className="assets-header">
        <span>{isCash ? "Cash" : "Stablecoins"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "12px" }}>
          <FilterButton id="assetSettingsGear" />
          <span className="btn-ghost" id="viewAllAssets" role="button" tabIndex={0} style={{ textTransform: "none", letterSpacing: 0 }} onClick={() => push({ name: "assets-all" })}>View all</span>
        </span>
      </div>
      {settingsOpen && <SettingsPanel id="hideZeroToggle" />}
      <div className="section-card">
        {isCash ? cash.map((r) => <CashRowItem key={r.key} r={r} />) : coins.map((r) => <CoinRowItem key={r.key} r={r} />)}
        {!(isCash ? cash.length : coins.length) && <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "12px 4px" }}>Nothing here yet.</div>}
      </div>
      {isCash && cash.some((r) => r.bucket === "fiat") && <FiatNote />}
      <div className="section-title" style={{ marginTop: "22px" }}>
        {activity.length > 0 && <>Recent activity <span className="btn-ghost" id="viewAllTx" role="button" tabIndex={0} style={{ textTransform: "none", letterSpacing: 0 }} onClick={() => set({ tab: "activity" })}>View all</span></>}
      </div>
      {activity.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No activity yet.</div>
        : <div className="section-card" id="recentActivity">{activity.slice(0, 4).map((a) => a.el)}</div>}
    </div>
  );
}

/** tAssetsAll: every cash or stablecoin balance, with the filter. */
export function AssetsAllScreen() {
  useBalances();
  const { walletTab, hideZero, settingsOpen } = useWalletHome();
  const back = useWalletNav((s) => s.back);
  const isCash = walletTab === "cash";
  const cash = isCash ? cashRows(hideZero) : [];
  const coins = isCash ? [] : stablecoinRows(hideZero);
  const rows = isCash ? cash.length : coins.length;
  return (
    <>
      <BackRow id="backHome" label="Wallet" onClick={back} />
      <div className="step-title">{isCash ? "Cash" : "Stablecoins"}
        <FilterButton id="assetSettingsGear2" style={{ float: "right" }} />
      </div>
      <p className="step-sub">{isCash ? "All cash balances held in this wallet." : "All stablecoin balances held in this wallet."}</p>
      {settingsOpen && <SettingsPanel id="hideZeroToggle2" />}
      {rows === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>Nothing to show.</div>
        : <>{isCash ? cash.map((r) => <CashRowItem key={r.key} r={r} />) : coins.map((r) => <CoinRowItem key={r.key} r={r} />)}{isCash && cash.some((r) => r.bucket === "fiat") && <FiatNote />}</>}
    </>
  );
}

export type Holding = { k: "cash"; cur: CashCurrency; bucket: CashRow["bucket"] } | { k: "coin"; asset: CoinAsset; net: Network };
/** VA_SPEC's rails, for the "Get … account details" card (vaCardHtml) on USD, EUR and GBP. */
const VA_RAILS: Partial<Record<CashCurrency, string>> = { USD: "ACH or wire", EUR: "SEPA or SEPA Instant", GBP: "Faster Payments or Bacs" };

/** tHoldingDetail for every balance except open NGN (which has its own screen). */
export function HoldingDetailScreen({ h }: { h: Holding }) {
  useBalances();
  const back = useWalletNav((s) => s.back);
  const activity = useActivity();
  const isCash = h.k === "cash";
  const balance = h.k === "cash"
    ? (h.bucket === "merchant" ? useNgn.getState().ngnMerchantBalance : cashRows(false).find((r) => r.currency === h.cur && r.bucket === h.bucket)?.balance ?? 0)
    : useHoldings.getState().coins[h.asset][h.net] || 0;
  const name = h.k === "cash" ? CURRENCY_NAME[h.cur] : ASSET_NAME[h.asset];
  const icon = h.k === "cash" ? WICON[CURRENCY_ICON[h.cur]] : WICON[ASSET_ICON[h.asset]];
  const fromKey = h.k === "cash" ? `cash:${h.cur}:${h.bucket}` : `coin:${h.asset}:${h.net}`;
  // Transaction history: the reference's matching rule for the demo records (Currency, and FIAT-ONLY records only
  // under FIAT-ONLY), plus conversions from or to this balance.
  const matches = activity.filter((a) => {
    const t = DEMO_TXNS.find((x) => x.id === a.key);
    if (t) return h.k === "cash" && h.cur === "USD" && (h.bucket === "fiat" || t.type !== "deposit");
    const c = useConvert.getState().conversions.find((x) => x.id === a.key);
    if (c) return h.k === "cash" ? [c.from, c.to].some((k) => k.startsWith(`cash:${h.cur}:`)) : [c.from, c.to].includes(fromKey);
    return false;
  });
  // vaCardHtml(cur) shows for every cash balance of a currency with account details (USD, EUR, GBP), FIAT-ONLY too.
  const vaRails = h.k === "cash" && h.bucket !== "merchant" ? VA_RAILS[h.cur] : undefined;
  return (
    <>
      <BackRow id="backFromDetail" label={isCash ? "Cash" : "Stablecoins"} onClick={back} />
      <div className="center-col" style={{ padding: "2px 0 4px" }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "10px" }}>
          <div className="badge" style={{ width: "44px", height: "44px" }} dangerouslySetInnerHTML={{ __html: icon }} />
          {h.k === "coin" && <span className="badge-network" dangerouslySetInnerHTML={{ __html: WICON[NETWORK_ICON[h.net]] }} />}
        </div>
        <p className="step-sub" style={{ marginBottom: "2px" }}>
          {name}{h.k === "coin" && ` · ${h.net}`}
          {h.k === "cash" && h.bucket === "fiat" && <FiatTag info={false} />}
          {h.k === "cash" && h.bucket === "merchant" && <span className="fiat-tag">MERCHANT-HELD</span>}
        </p>
        <div className="step-title" id="holdingAmount" style={{ fontSize: "28px", letterSpacing: "-.02em" }}><Grey>{h.k === "cash" ? fmtCurrency(balance, h.cur) : fmtUsd(balance)}</Grey></div>
        {h.k === "coin" && <p className="step-sub"><Grey>{fmtAsset(balance, h.asset)}</Grey></p>}
      </div>
      <div className="action-row" style={{ marginTop: "14px" }}>
        {h.k === "cash" ? (
          <>
            <button className="action-btn" id="detailDeposit" onClick={() => showNotPorted(`Depositing ${h.cur} isn't ported yet.`)}><span className="ic"><Raw html={WICON.add} /></span>Deposit</button>
            <button className="action-btn" id="detailTransfer" onClick={() => showNotPorted("Transfer isn't ported yet.")}><span className="ic"><Raw html={WICON.transfer} /></span>Transfer</button>
            <button className="action-btn" id="detailPayout" onClick={() => h.cur === "NGN" && h.bucket === "merchant" ? usePayout.getState().open("NGN", "merchant") : showNotPorted(`${h.cur} payouts aren't ported yet.`)}><span className="ic"><Raw html={WICON.bank} /></span>Payout</button>
            <button className="action-btn" id="detailConvert" onClick={() => useConvert.getState().start({ from: fromKey })}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
          </>
        ) : (
          <>
            <button className="action-btn" id="detailPayoutCrypto" onClick={() => showNotPorted("Stablecoin payouts aren't ported yet.")}><span className="ic"><Raw html={WICON.bank} /></span>Payout</button>
            <button className="action-btn" id="detailConvert" onClick={() => useConvert.getState().start({ to: fromKey })}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
          </>
        )}
      </div>
      {vaRails && h.k === "cash" && (
        <div className="va-card va-empty" id="vaOpen" data-vacur={h.cur} role="button" tabIndex={0} onClick={() => showNotPorted(`${h.cur} account details aren't ported yet.`)}>
          <div className="va-ic"><Raw html={WICON.bank} /></div>
          <div className="va-meta"><div className="t1">Get {h.cur} account details</div><div className="t2">Receive {h.cur} by {vaRails}. Free to receive.</div></div>
          <span className="va-chev">{"›"}</span>
        </div>
      )}
      <div className="section-title">Transaction history</div>
      {matches.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No {h.k === "coin" ? `${h.asset} on ${h.net} ` : ""}activity yet.</div>
        : <div className="section-card">{matches.map((a) => a.el)}</div>}
    </>
  );
}

/** tActivity: the Activity tab. */
export function ActivityScreen() {
  useBalances();
  const activity = useActivity();
  return (
    <div className="screen-fade">
      <div className="step-title">Activity</div>
      <p className="step-sub">All wallet transactions in one place.</p>
      {activity.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No activity yet.</div>
        : activity.map((a) => a.el)}
    </div>
  );
}

/** tTxDetail for a demo record: the currency's flag, the amount, its title and the reference's detail rows. */
export function DemoTxDetailScreen({ id }: { id: string }) {
  const back = useWalletNav((s) => s.back);
  const t = DEMO_TXNS.find((x) => x.id === id);
  if (!t) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className="tx-ic tx-ic-lg tx-ic-real" dangerouslySetInnerHTML={{ __html: WICON.usFlag }} />
      </div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px", color: t.positive ? "var(--ok-600)" : "var(--n-900)" }}><Grey>{fmtUsd(t.amount)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{t.title}</p>
      <div className="info-card" id="txDetail">
        <DetailRow label="Status" value="Completed" />
        <DetailRow label="Date" value={formatTxDate(t.ts)} />
        {t.details.map(([k, v]) => <DetailRow key={k} label={k} value={v} />)}
        <ReferenceRow refText={t.ref} />
      </div>
    </>
  );
}
