"use client";
import { DisputeRow, RaiseDispute, useDemoDisputes } from "../disputes/DisputeScreens";
import { History, useActivity } from "../history/History";
import { demoTxFields } from "../history/fields";
import { TxDetailView, TxNotFound } from "../history/TxView";
import { demoTxReceipt } from "../receipt/receipt";
import { NairaPausedBanner } from "../NairaPausedBanner";
import { Raw } from "@/components/ui/Raw";
import { FILTER_ICON, WICON } from "@/lib/icons";
import { useAccount } from "@/store/account";
import { useNgn } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey } from "../payout/parts";
import { useConvert } from "../convert/useConvert";
import { useSend } from "../send/useSend";
import { useDeposit } from "../deposit/useDeposit";
import { fmtAsset } from "../convert/convertMath";
import { useHoldings, type CashCurrency, type CoinAsset, type Network } from "../useHoldings";
import { useWalletToast } from "../useWalletToast";
import { useWalletNav } from "../useWalletNav";
import { OnHoldLink } from "../withdrawals/parts";
import {
  ASSET_NAME, CURRENCY_ICON, CURRENCY_NAME, DEMO_TXNS, assetDelta, cashRows, stablecoinRows, totalBalanceUsd, useWalletHome,
  type CashRow, type CoinRow,
} from "./homeData";

/** The reference's fmt(): "$47.86 USD". */
const fmtUsd = (c: number) => fmtCurrency(c, "USD");
const FIAT_NOTE_TEXT = "Cash added by card. You can spend it or withdraw it, but it can’t be converted to stablecoin.";
const NETWORK_ICON: Record<Network, "base" | "polygon"> = { Base: "base", Polygon: "polygon" };
const ASSET_ICON: Record<CoinAsset, "usdc" | "usdt"> = { USDC: "usdc", USDT: "usdt" };

/** Re-render on any balance change. */
function useBalances() {
  useNgn((s) => s.ngnBalance); useNgn((s) => s.ngnReserved);
  useHoldings((s) => s.cash); useHoldings((s) => s.fiatOnly); useHoldings((s) => s.coins);
}

/** FIAT-ONLY tag: tapping it explains (data-fiatinfo). */
export function FiatTag({ info = true }: { info?: boolean }) {
  return (
    <span className="fiat-tag" {...(info ? { "data-fiatinfo": "", role: "button", tabIndex: 0, title: "What does this mean?" } : {})}
      onClick={info ? (e) => { e.stopPropagation(); useWalletToast.getState().showNotice("FIAT-ONLY", FIAT_NOTE_TEXT, 5000); } : undefined}>FIAT-ONLY</span>
  );
}

/** Open a cash balance: NGN keeps its own screen; everything else uses the reference's tHoldingDetail. */
function openCash(r: { currency: CashCurrency; bucket: CashRow["bucket"] }) {
  const nav = useWalletNav.getState();
  if (r.currency === "NGN" && r.bucket === "open") nav.push({ name: "ngn-balance" });
  else nav.push({ name: "holding", holding: { k: "cash", cur: r.currency, bucket: r.bucket } });
}

/** cashRowHtml(a). The NGN row uses the naira format, open NGN with "₦X on hold" (NGN rules); other currencies the reference's quantity. */
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
      {/* WGT-13: while the naira partner is down */}
      <NairaPausedBanner />
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
        <button className="action-btn" id="actDeposit" onClick={() => useDeposit.getState().open()}><span className="ic"><Raw html={WICON.add} /></span>Deposit</button>
        {/* Send replaces the reference's Transfer and Payout actions (docs/decisions.md). */}
        <button className="action-btn" id="actSend" onClick={() => useSend.getState().open()}><span className="ic"><Raw html={WICON.send} /></span>Send</button>
        <button className="action-btn" id="actConvert" onClick={() => useConvert.getState().start()}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
      </div>
      <div className="seg">
        <div className={`seg-opt ${isCash ? "sel" : ""}`} data-wallettab="cash" role="tab" aria-selected={isCash} onClick={() => set({ walletTab: "cash" })}>Cash</div>
        <div className={`seg-opt ${isCash ? "" : "sel"}`} data-wallettab="assets" role="tab" aria-selected={!isCash} onClick={() => set({ walletTab: "assets" })}>Stablecoins</div>
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
      {settingsOpen && <SettingsPanel id="hideZeroToggle2" />}
      {rows === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>Nothing to show.</div>
        : <>{isCash ? cash.map((r) => <CashRowItem key={r.key} r={r} />) : coins.map((r) => <CoinRowItem key={r.key} r={r} />)}</>}
    </>
  );
}

export type Holding = { k: "cash"; cur: CashCurrency; bucket: CashRow["bucket"] } | { k: "coin"; asset: CoinAsset; net: Network };

/** tHoldingDetail for a stablecoin (cash balances: CashBalanceScreen): the coin on its network, Send and Convert, its history. */
export function HoldingDetailScreen({ h }: { h: Extract<Holding, { k: "coin" }> }) {
  useBalances();
  const back = useWalletNav((s) => s.back);
  const key = `coin:${h.asset}:${h.net}`;
  const items = useActivity().filter((x) => x.keys.includes(key));
  const balance = useHoldings.getState().coins[h.asset][h.net] || 0;
  return (
    <>
      <BackRow id="backFromDetail" label="Stablecoins" onClick={back} />
      <div className="center-col" style={{ padding: "2px 0 4px" }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "10px" }}>
          <div className="badge" style={{ width: "44px", height: "44px" }} dangerouslySetInnerHTML={{ __html: WICON[ASSET_ICON[h.asset]] }} />
          <span className="badge-network" dangerouslySetInnerHTML={{ __html: WICON[NETWORK_ICON[h.net]] }} />
        </div>
        <p className="step-sub" style={{ marginBottom: "2px" }}>{ASSET_NAME[h.asset]} · {h.net}</p>
        <div className="step-title" id="balanceAmount" style={{ fontSize: "28px", letterSpacing: "-.02em" }}><Grey>{fmtUsd(balance)}</Grey></div>
        <p className="step-sub"><Grey>{fmtAsset(balance, h.asset)}</Grey></p>
      </div>
      <div className="action-row" style={{ marginTop: "14px" }}>
        <button className="action-btn" id="detailSend" onClick={() => useSend.getState().open(key)}><span className="ic"><Raw html={WICON.send} /></span>Send</button>
        <button className="action-btn" id="detailConvert" onClick={() => useConvert.getState().start({ to: key })}><span className="ic"><Raw html={WICON.convert} /></span>Convert</button>
      </div>
      <div className="section-title">Transaction history</div>
      {items.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No {h.asset} on {h.net} activity yet.</div>
        : <div className="section-card">{items.map((a) => a.el)}</div>}
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
      {/* WGT-11: grouped by day, with the filter */}
      <History id="activityHistory" items={activity} empty="No activity yet." />
    </div>
  );
}

/** A demo record's detail: the shared transaction template; a payment to a store can be disputed. */
export function DemoTxDetailScreen({ id }: { id: string }) {
  const t = DEMO_TXNS.find((x) => x.id === id);
  const disputed = useDemoDisputes((s) => !!s.open[id]);
  if (!t) return <TxNotFound />;
  return (
    <TxDetailView dir={t.positive ? "in" : "out"} amount={fmtUsd(t.amount)} title={t.title} tag={t.details.find(([k]) => k === "Funding tag")?.[1]}
      f={demoTxFields(t)} receipt={demoTxReceipt(t)} rows={disputed ? <DisputeRow /> : undefined}>
      {/* extDisputable: only a payment to a store can be disputed (not a deposit, top-up or refund) */}
      {t.type === "payment" && !disputed && <RaiseDispute at={t.ts} merchant={t.details.find(([k]) => k === "Merchant")?.[1] ?? t.title} target={{ kind: "demo", id: t.id }} />}
    </TxDetailView>
  );
}
