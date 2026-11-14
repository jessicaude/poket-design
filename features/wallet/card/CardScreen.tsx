"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { TIERS, tierName } from "../limits";
import { holderName, useNgn, type Tier } from "../ngn/useNgn";
import { fmtCurrency } from "../payout/payoutMath";
import { BackRow, Grey, SpinButton } from "../payout/parts";
import { STEP_LINE, StepUpIntro } from "../StepUpIntro";
import { TierLimitsCard } from "../settings/SettingsScreens";
import { CASH_CURRENCIES, COIN_ASSETS, NETWORKS, useHoldings, type CoinAsset, type Network } from "../useHoldings";
import { useWalletNav } from "../useWalletNav";
import { useWalletToast } from "../useWalletToast";
import { DetailRow, ReferenceRow, formatTxDate } from "../withdrawals/TxDetail";
import { CURRENCY_ICON, CURRENCY_NAME } from "../home/homeData";
import { cardAvail, cardBalanceLabel, fmtSource, sameSource, useCards, type CardPurchase, type CardSource } from "./useCards";

const ASSET_ICON: Record<CoinAsset, "usdc" | "usdt"> = { USDC: "usdc", USDT: "usdt" };
const NET_ICON: Record<Network, "base" | "polygon"> = { Base: "base", Polygon: "polygon" };
const MASK = "•••• •••• •••• ";

/** The card's face (.vcard): the Poket mark, VIRTUAL, the number, the cardholder and expiry. */
function CardFace({ children, num, bottom, style }: { children?: React.ReactNode; num: string; bottom: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="vcard" style={style}>
      <div className="vcard-top">
        <div className="vcard-brand"><span className="brand-mark-16"><Raw html={WICON.poketMark} /></span>Poket</div>
        {children ?? <div className="vcard-badge">VIRTUAL</div>}
      </div>
      <div className="vcard-num" id="cardNumber">{num}</div>
      <div className="vcard-bottom">{bottom}</div>
    </div>
  );
}

/** Below Tier 3: why, what it takes to get there, and "Increase my limits". */
function CardLocked({ tier }: { tier: number }) {
  const next = Math.min(3, tier + 1) as 1 | 2 | 3;
  const set = useCards((s) => s.set);
  const steps = ([1, 2, 3] as const).filter((t) => t > tier);
  return (
    <div className="center-col" style={{ paddingTop: "24px" }}>
      <div className="check-circle" style={{ background: "var(--surface)", color: "var(--txt2)" }}><Raw html={WICON.lockIc} /></div>
      <div className="step-title">Virtual cards need {TIERS[3].name}</div>
      <p className="step-sub">Per Poket&rsquo;s certified controls, virtual cards and wire transfers unlock at {TIERS[3].name}. You&rsquo;re currently at {tierName(tier)}.</p>
      <div className="info-card" id="cardNeeds" style={{ width: "100%", textAlign: "left" }}>
        {steps.map((t) => <div className="info-row" key={t}><span>{TIERS[t].name.split(":")[0]}</span><span>{STEP_LINE[t]}</span></div>)}
      </div>
      <SpinButton id="unlockTier3FromCard" delay={400} onClick={() => set({ stepUp: true })}>Increase my limits ({TIERS[next].name})</SpinButton>
    </div>
  );
}

/** A balance the card can spend from (data-cardcash, or data-cardasset and data-cardnet). */
function SourceRow({ source, sel, onPick }: { source: CardSource; sel: boolean; onPick: () => void }) {
  const avail = cardAvail(source);
  if (source.k === "cash") return (
    <div className={`select-row ${sel ? "sel" : ""}`} data-cardcash={source.cur} role="button" tabIndex={0} onClick={onPick}>
      <div className="badge"><Raw html={WICON[CURRENCY_ICON[source.cur]]} /></div>
      <div className="meta"><div className="t1">{CURRENCY_NAME[source.cur]}</div><div className="t2"><Grey>{`Available ${fmtCurrency(avail, source.cur)}`}</Grey></div></div>
      <div className="radio" />
    </div>
  );
  return (
    <div className={`select-row ${sel ? "sel" : ""}`} data-cardasset={source.asset} data-cardnet={source.net} role="button" tabIndex={0} onClick={onPick}>
      <div className="asset-icon-wrap"><div className="badge"><Raw html={WICON[ASSET_ICON[source.asset]]} /></div><span className="badge-network"><Raw html={WICON[NET_ICON[source.net]]} /></span></div>
      <div className="meta"><div className="t1">{source.asset} · {source.net}</div><div className="t2"><Grey>{`Available ${fmtSource(avail, source)}`}</Grey></div></div>
      <div className="radio" />
    </div>
  );
}

/** No card yet, or adding another: the greyed card, a nickname, the balance it spends from. */
function CardCreate() {
  const { cards, draftNickname, draftSource, set, issue } = useCards();
  const isFirst = cards.length === 0;
  const sources: CardSource[] = [
    ...CASH_CURRENCIES.map((cur) => ({ k: "cash" as const, cur })),
    ...COIN_ASSETS.flatMap((asset) => NETWORKS.map((net) => ({ k: "coin" as const, asset, net }))),
  ];
  return (
    <>
      {!isFirst && <BackRow id="cancelCreateCard" onClick={() => set({ creating: false })} />}
      <div className="step-title">{isFirst ? "Virtual card" : "Add a card"}</div>
      <p className="step-sub">{isFirst ? "Activate a virtual card that spends directly from a balance. No separate top-up needed." : "Create another card tied to a different balance."}</p>
      <CardFace style={{ opacity: 0.5, filter: "grayscale(1)" }} num={MASK + "••••"}
        bottom={<><div>Cardholder<b>{holderName().toUpperCase()}</b></div><div>Expires<b>••/••</b></div></>} />
      <label className="field-label" htmlFor="cardNicknameInput">Nickname</label>
      <input className="field-input" id="cardNicknameInput" placeholder="e.g. Personal, Subscriptions" value={draftNickname} onChange={(e) => set({ draftNickname: e.target.value })} />
      <label className="field-label">Fund card from</label>
      {sources.map((s) => <SourceRow key={JSON.stringify(s)} source={s} sel={sameSource(draftSource, s)} onPick={() => set({ draftSource: s })} />)}
      <SpinButton id="issueCard" delay={1000} style={{ marginTop: "6px" }} disabled={!draftSource} onClick={issue}>{isFirst ? "Activate virtual card" : "Create card"}</SpinButton>
    </>
  );
}

/** The card: details behind the eye (and Copy), freeze, the demo purchase, its limits and its activity. */
function CardView() {
  useHoldings((s) => s.cash); useHoldings((s) => s.coins); useNgn((s) => s.ngnBalance);
  const { cards, activeId, freezeConfirm, authorizing, purchases, select, toggleReveal, freeze, confirmFreeze, simulatePurchase, startAdd, set } = useCards();
  const card = cards.find((c) => c.id === activeId) ?? cards[0];
  const mine = purchases.filter((p) => p.cardId === card.id);
  const copy = () => {
    try { navigator.clipboard?.writeText(card.pan.replace(/\s/g, "")).catch(() => {}); } catch { /* no clipboard */ }
    useWalletToast.getState().showToast("Card number copied");
  };
  return (
    <>
      {cards.length > 1 && (
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "14px", paddingBottom: "2px" }}>
          {cards.map((c) => <button key={c.id} className={`seg-opt ${c.id === card.id ? "sel" : ""}`} data-cardswitch={c.id} style={{ flex: "none", padding: "8px 16px" }} onClick={() => select(c.id)}>{c.nickname}</button>)}
        </div>
      )}
      <div className="step-title" id="cardTitle">{card.nickname}</div>
      <p className="step-sub"><Grey>{`Spends live from ${cardBalanceLabel(card.source)} balance of ${fmtSource(cardAvail(card.source), card.source)}.`}</Grey></p>
      <CardFace num={card.revealed ? card.pan : MASK + card.pan.slice(-4)}
        bottom={<>
          <div>Cardholder<b>{holderName().toUpperCase()}</b></div>
          {card.revealed && <div>CVV<b id="cardCvv">{card.cvv}</b></div>}
          <div>Expires<b id="cardExpiry">{card.revealed ? card.expiry : "••/••••"}</b></div>
        </>}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* NEW: copy the number once it's showing */}
          {card.revealed && <span className="vcard-eye" id="cardCopyNumber" role="button" tabIndex={0} aria-label="Copy card number" onClick={copy}><Raw html={WICON.copy} /></span>}
          <span className="vcard-eye" id="cardEyeToggle" role="button" tabIndex={0} aria-label={card.revealed ? "Hide card details" : "Show card details"} onClick={toggleReveal}>
            <Raw html={card.revealed ? WICON.eyeOpen : WICON.eyeClosed} /></span>
          <div className="vcard-badge">VIRTUAL</div>
        </div>
      </CardFace>
      <div className="action-row">
        <button className="btn-secondary" id="freezeCard" onClick={freeze}>{card.frozen ? "Unfreeze card" : "Freeze card"}</button>
      </div>
      {freezeConfirm && (
        <div className="alert warn" id="freezeConfirm" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
          <div>Freeze this card? New transactions will be declined until you unfreeze it.</div>
          <div className="action-row" style={{ marginBottom: 0 }}>
            <button className="btn-secondary" id="cancelFreeze" onClick={() => set({ freezeConfirm: false })}>Cancel</button>
            <button className="btn-primary" id="confirmFreeze" style={{ width: "auto", flex: 1 }} onClick={confirmFreeze}>Freeze</button>
          </div>
        </div>
      )}
      {card.frozen && <div className="alert warn" id="cardFrozen">This card is frozen. New transactions will be declined.</div>}
      <button className="btn-secondary" id="simulatePurchase" style={{ width: "100%", marginBottom: "10px" }} disabled={card.frozen || authorizing} onClick={() => simulatePurchase()}>
        {authorizing ? "Authorizing…" : "Simulate purchase"}</button>
      <button className="btn-secondary" id="addAnotherCardBtn" style={{ width: "100%", marginBottom: "16px" }} onClick={startAdd}>+ Add another card</button>
      {/* NEW: the card spends within the account's limits (Tier 3) */}
      <div className="section-title">Card limits</div>
      <div id="cardLimits"><TierLimitsCard tier={3} /></div>
      <div className="section-title">Card activity</div>
      {mine.length === 0
        ? <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0" }}>No card spend yet.</div>
        : <div className="section-card" id="cardActivity">{mine.map((p) => <CardPurchaseRow key={p.id} p={p} />)}</div>}
    </>
  );
}

/** The Card tab (tCard). */
export function CardScreen() {
  const tier = useNgn((s) => s.tier);
  const { cards, creating, stepUp, set } = useCards();
  if (stepUp) return (
    <div className="screen-fade">
      <StepUpIntro current={tier} target={tier + 1} onCancel={() => set({ stepUp: false })}
        onContinue={() => { useNgn.getState().set({ tier: Math.min(3, tier + 1) as Tier }); set({ stepUp: false }); }} />
    </div>
  );
  return (
    <div className="screen-fade">
      {tier < 3 ? <CardLocked tier={tier} /> : cards.length === 0 || creating ? <CardCreate /> : <CardView />}
    </div>
  );
}

/** txRow for a card transaction (type 'card'): the card icon, the merchant, which card. */
export function CardPurchaseRow({ p }: { p: CardPurchase }) {
  const push = useWalletNav((s) => s.push);
  return (
    <div className="tx-row" data-cardtx={p.id} role="button" tabIndex={0} onClick={() => push({ name: "card-tx", id: p.id })}>
      <div className="tx-ic out"><Raw html={WICON.card} /></div>
      <div className="tx-main"><div className="tx-title">{p.merchant}</div><div className="tx-sub">{p.cardName} ••• {p.last4}</div></div>
      <div className="tx-amt"><Grey>{"-" + fmtSource(p.amount, p.source)}</Grey></div>
    </div>
  );
}

/** A card transaction's detail: the reference's details (Merchant, Status, Currency or Asset and Network, Card). */
export function CardTxDetailScreen({ id }: { id: string }) {
  const back = useWalletNav((s) => s.back);
  const p = useCards((s) => s.purchases.find((x) => x.id === id));
  if (!p) return <><BackRow id="backFromTxDetail" onClick={back} /><div className="step-title">Transaction</div><p className="step-sub">Not found.</p></>;
  const s = p.source;
  return (
    <>
      <BackRow id="backFromTxDetail" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}><div className="tx-ic tx-ic-lg out"><Raw html={WICON.card} /></div></div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px" }}><Grey>{fmtSource(p.amount, s)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "14px" }}>{p.merchant}</p>
      <div className="info-card" id="txDetail">
        <DetailRow label="Status" value="Approved" />
        <DetailRow label="Date" value={formatTxDate(p.at)} />
        <DetailRow label="Merchant" value={p.merchant} />
        {s.k === "cash" ? <DetailRow label="Currency" value={s.cur} /> : <><DetailRow label="Asset" value={s.asset} /><DetailRow label="Network" value={s.net} /></>}
        <DetailRow label="Card" value={`${p.cardName} ••• ${p.last4}`} />
        <ReferenceRow refText={p.ref} />
      </div>
    </>
  );
}
