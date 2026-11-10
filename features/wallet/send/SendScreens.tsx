"use client";
import { Raw } from "@/components/ui/Raw";
import { EXPLORE_NETWORK_LOGO, WICON } from "@/lib/icons";
import { RECENT_POKET_CONTACTS, type PoketUser, type SendRecipient, type WalletNetwork } from "@/lib/mock-api";
import { fmtCurrency, payoutMethodSub } from "../payout/payoutMath";
import { BackRow, Grey, SpinButton } from "../payout/parts";
import { useNgn } from "../ngn/useNgn";
import { showNotPorted } from "../useWalletToast";
import { addressParts, formatSortCode, routingBank, sortBank, usSpeeds, validAddress } from "./sendMath";
import { sourceName, ukReady, usReady, useSend, type SendStage } from "./useSend";

/** The explore prototype's shortAddr: "0x3Fa9cE…D58e12". */
const shortAddr = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const BANK_FLAG: Record<string, "ngFlag" | "usFlag" | "gbFlag"> = { NGN: "ngFlag", USD: "usFlag", GBP: "gbFlag" };
const COIN: Record<string, "usdc" | "usdt"> = { USDC: "usdc", USDT: "usdt" };
/** A network's logo: the wallet's Base and Polygon icons, the explore prototype's Solana and Ethereum logos. */
const netLogo = (n: WalletNetwork) => (n === "Base" ? WICON.base : n === "Polygon" ? WICON.polygon : EXPLORE_NETWORK_LOGO[n === "Solana" ? "solana" : "ethereum"]);
/** Search in the list once there are more than 5 saved recipients (savedPage: all.length > 5). */
export const SEARCH_FROM = 6;

const nameOf = (r: SendRecipient) => (r.kind === "bank" ? r.bank.name : r.kind === "poket" ? r.user.name : r.wallet.name);
const subOf = (r: SendRecipient) => (r.kind === "bank" ? payoutMethodSub(r.bank) : r.kind === "poket" ? r.user.handle : shortAddr(r.wallet.address));

/** A recipient's mark: a bank's country flag, a Poket user's initials, a wallet's coin with its network. */
function Mark({ r }: { r: SendRecipient }) {
  if (r.kind === "bank") return <div className="badge" dangerouslySetInnerHTML={{ __html: WICON[BANK_FLAG[r.bank.currency] ?? "globe"] }} />;
  if (r.kind === "poket") return <div className="badge" style={{ background: "var(--brand-50)", color: "var(--brand-600)", fontWeight: 700, fontSize: "13px" }}>{r.user.initials}</div>;
  return (
    <div className="asset-icon-wrap">
      <div className="badge" dangerouslySetInnerHTML={{ __html: WICON[COIN[r.wallet.asset]] }} />
      <span className="badge-network" dangerouslySetInnerHTML={{ __html: netLogo(r.wallet.network) }} />
    </div>
  );
}

function RecipientRow({ r }: { r: SendRecipient }) {
  const choose = useSend((s) => s.choose);
  return (
    <div className="select-row" data-sendrecipient={r.id} role="button" tabIndex={0} onClick={() => choose(r)} onKeyDown={(e) => { if (e.key === "Enter") choose(r); }}>
      <Mark r={r} />
      <div className="meta"><div className="t1">{nameOf(r)}</div><div className="t2 mono">{subOf(r)}</div></div>
      <span className="va-chev">{"›"}</span>
    </div>
  );
}

/** "+ New …" at the top of the list (savedPage's newrow), as a wallet select-row with a plus badge. */
function NewRow({ id, label, onClick }: { id: string; label: string; onClick: () => void }) {
  return (
    <div className="select-row" id={id} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}>
      {/* Wrapped so .badge>svg doesn't stretch the plus to the badge's size. */}
      <div className="badge" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }} dangerouslySetInnerHTML={{ __html: `<span style="display:inline-flex">${WICON.add}</span>` }} />
      <div className="meta"><div className="t1">{label}</div></div>
      <span className="va-chev">{"›"}</span>
    </div>
  );
}

/** Send: "+ New recipient", your own bank accounts, then saved recipients; search once there are more than 5. */
export function SendRecipientsScreen() {
  const { recipients, search, setSearch, back, newRecipient, source } = useSend();
  const bucket = source?.split(":")[2];
  const yours = recipients.filter((r) => r.kind === "bank" && r.self);
  const saved = recipients.filter((r) => !(r.kind === "bank" && r.self));
  const q = search.trim().toLowerCase();
  const match = (r: SendRecipient) => !q || `${nameOf(r)} ${subOf(r)}`.toLowerCase().includes(q);
  const yoursShown = yours.filter(match), savedShown = saved.filter(match);
  return (
    <>
      <BackRow id="backFromSend" label="Wallet" onClick={back} />
      <div className="step-title">Send</div>
      {/* Opened from a balance screen: that balance is the source. NEW copy. */}
      {source && (
        <p className="step-sub" id="sendFrom">From {sourceName(source)}
          {bucket === "fiat" && <span className="fiat-tag">FIAT-ONLY</span>}
          {bucket === "merchant" && <span className="fiat-tag">MERCHANT-HELD</span>}
        </p>
      )}
      {saved.length >= SEARCH_FROM && (
        <div className="field-icon-wrap">
          <span className="field-icon"><Raw html={WICON.search} /></span>
          <input className="field-input" id="sendSearch" placeholder="Search" aria-label="Search saved recipients" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}
      <NewRow id="newRecipient" label="New recipient" onClick={newRecipient} />
      {yoursShown.length > 0 && <><label className="field-label" style={{ marginTop: "14px" }}>Your accounts</label>{yoursShown.map((r) => <RecipientRow key={r.id} r={r} />)}</>}
      {savedShown.length > 0 && <><label className="field-label" style={{ marginTop: "14px" }}>Saved</label>{savedShown.map((r) => <RecipientRow key={r.id} r={r} />)}</>}
      {q && !yoursShown.length && !savedShown.length && <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0 4px" }}>No saved recipient matches.</div>}
    </>
  );
}

/** "+ New recipient": what to send to (the explore prototype's "Send to" options for a new recipient). */
export function SendNewRecipientScreen() {
  const { back, addKind } = useSend();
  const kinds: { kind: "bank" | "poket" | "wallet"; label: string; sub: string; icon: string }[] = [
    { kind: "bank", label: "Bank account", sub: "", icon: WICON.bank },
    { kind: "poket", label: "Poket user", sub: "Email, phone or wallet address", icon: WICON.user },
    { kind: "wallet", label: "Stablecoin wallet", sub: "", icon: WICON.usdc },
  ];
  return (
    <>
      <BackRow id="backToSendRecipients" onClick={back} />
      <div className="step-title">New recipient</div>
      {kinds.map((k) => (
        <div className="select-row" key={k.kind} data-newkind={k.kind} role="button" tabIndex={0} onClick={() => addKind(k.kind)} onKeyDown={(e) => { if (e.key === "Enter") addKind(k.kind); }}>
          <div className="badge" dangerouslySetInnerHTML={{ __html: k.kind === "wallet" ? k.icon : `<span style="display:inline-flex;color:var(--txt2)">${k.icon}</span>` }} />
          <div className="meta"><div className="t1">{k.label}</div>{k.sub && <div className="t2">{k.sub}</div>}</div>
          <span className="va-chev">{"›"}</span>
        </div>
      ))}
    </>
  );
}

/** "Save recipient": every new recipient can be saved (on by default). */
function SaveRecipient({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="consent-row" style={{ marginTop: "8px" }}>
      <input type="checkbox" id="saveRecipient" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor="saveRecipient">Save recipient</label>
    </div>
  );
}

/** RCP_COUNTRIES' currencies, in the explore prototype's order. */
const CURRENCIES: { cur: "USD" | "NGN" | "GBP"; name: string; flag: "usFlag" | "ngFlag" | "gbFlag" }[] = [
  { cur: "USD", name: "US Dollar", flag: "usFlag" },
  { cur: "NGN", name: "Nigerian Naira", flag: "ngFlag" },
  { cur: "GBP", name: "British Pound", flag: "gbFlag" },
];

/** New bank account, step 1: the currency (the explore prototype's currency picker: flag, code, name). */
export function SendBankCurrencyScreen() {
  const { back, pickCurrency } = useSend();
  return (
    <>
      <BackRow id="backFromBankCurrency" onClick={back} />
      <div className="step-title">Currency</div>
      {CURRENCIES.map((c) => (
        <div className="select-row" key={c.cur} data-sendcur={c.cur} role="button" tabIndex={0} onClick={() => pickCurrency(c.cur)} onKeyDown={(e) => { if (e.key === "Enter") pickCurrency(c.cur); }}>
          <div className="badge" dangerouslySetInnerHTML={{ __html: WICON[c.flag] }} />
          <div className="meta"><div className="t1">{c.cur}</div><div className="t2">{c.name}</div></div>
          <span className="va-chev">{"›"}</span>
        </div>
      ))}
    </>
  );
}

/** New bank account in USD: the explore prototype's US fields (routing number with the bank's name, account number, holder, nickname, speed, the address for a wire). */
export function SendUsBankScreen() {
  const { us: d, back, editUs, continueUs } = useSend();
  const rb = routingBank(d.routing);
  const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);
  return (
    <>
      <BackRow id="backFromUsBank" onClick={back} />
      <div className="step-title">New bank account</div>
      <div className="select-row sel" id="sendCurRow" role="button" tabIndex={0} onClick={back}>
        <div className="badge" dangerouslySetInnerHTML={{ __html: WICON.usFlag }} />
        <div className="meta"><div className="t1">USD</div><div className="t2">US Dollar</div></div>
        <span className="va-chev">{"›"}</span>
      </div>
      <label className="field-label" htmlFor="usRouting" style={{ marginTop: "14px" }}>Routing number</label>
      <input className="field-input mono" id="usRouting" inputMode="numeric" maxLength={9} autoComplete="off" value={d.routing} onChange={(e) => editUs({ routing: digits(e.target.value, 9) })} />
      {rb ? (
        <p id="usBankName" style={{ margin: "-8px 0 14px", fontSize: "12.5px", color: "var(--ok-600)", display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="badge" style={{ width: "24px", height: "24px", background: "var(--ok-50)" }}><span style={{ display: "inline-flex", color: "var(--ok-600)" }}><Raw html={WICON.bank} /></span></span><b>{rb.full}</b>
        </p>
      ) : d.routing.length === 9 && <div className="field-err" role="alert">Check the routing number.</div>}
      <label className="field-label" htmlFor="usAcct">Account number</label>
      <input className="field-input mono" id="usAcct" inputMode="numeric" maxLength={17} autoComplete="off" value={d.acct} onChange={(e) => editUs({ acct: digits(e.target.value, 17) })} />
      <label className="field-label" htmlFor="usName">Account holder name</label>
      <input className="field-input" id="usName" autoComplete="off" value={d.name} onChange={(e) => editUs({ name: e.target.value })} />
      <label className="field-label" htmlFor="usNick">Nickname (optional)</label>
      <input className="field-input" id="usNick" autoComplete="off" value={d.nick} onChange={(e) => editUs({ nick: e.target.value })} />
      {rb && (
        <>
          <label className="field-label" style={{ marginTop: "6px" }}>Speed</label>
          {usSpeeds(rb.instant).map((x) => (
            <div key={x.id} className={`select-row ${d.speed === x.id ? "sel" : ""}`} data-speed={x.id} role="radio" aria-checked={d.speed === x.id} tabIndex={0} onClick={() => editUs({ speed: x.id })}>
              <div className="meta"><div className="t1">{x.label}</div><div className="t2">{x.eta}</div></div>
              <span className="mono" style={{ fontSize: "13px", fontWeight: 600 }}><Grey>{x.fee ? fmtCurrency(x.fee, "USD") : "Free"}</Grey></span>
              <div className="radio" />
            </div>
          ))}
        </>
      )}
      {d.speed === "wire" && (
        <>
          <label className="field-label" style={{ marginTop: "12px" }}>Recipient&rsquo;s address</label>
          <input className="field-input" id="usStreet" placeholder="Street address" value={d.street} onChange={(e) => editUs({ street: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 96px", gap: "8px" }}>
            <input className="field-input" id="usCity" placeholder="City" value={d.city} onChange={(e) => editUs({ city: e.target.value })} />
            <input className="field-input" id="usState" placeholder="State" maxLength={2} value={d.state} onChange={(e) => editUs({ state: e.target.value.toUpperCase() })} />
            <input className="field-input" id="usZip" placeholder="ZIP" inputMode="numeric" maxLength={5} value={d.zip} onChange={(e) => editUs({ zip: digits(e.target.value, 5) })} />
          </div>
        </>
      )}
      <SaveRecipient checked={d.save} onChange={(v) => editUs({ save: v })} />
      <SpinButton id="usBankContinue" disabled={!usReady(d)} delay={400} onClick={continueUs}>Continue</SpinButton>
    </>
  );
}

/** New bank account in GBP: the explore prototype's UK fields (sort code with the bank's name, account number, holder, nickname). */
export function SendUkBankScreen() {
  const { uk: d, back, editUk, continueUk } = useSend();
  const sb = sortBank(d.sort);
  return (
    <>
      <BackRow id="backFromUkBank" onClick={back} />
      <div className="step-title">New bank account</div>
      <div className="select-row sel" id="sendCurRow" role="button" tabIndex={0} onClick={back}>
        <div className="badge" dangerouslySetInnerHTML={{ __html: WICON.gbFlag }} />
        <div className="meta"><div className="t1">GBP</div><div className="t2">British Pound</div></div>
        <span className="va-chev">{"\u203a"}</span>
      </div>
      <label className="field-label" htmlFor="ukSort" style={{ marginTop: "14px" }}>Sort code</label>
      <input className="field-input mono" id="ukSort" inputMode="numeric" maxLength={8} placeholder="00-00-00" autoComplete="off" value={d.sort} onChange={(e) => editUk({ sort: formatSortCode(e.target.value) })} />
      {sb && (
        <p id="ukBankName" style={{ margin: "-8px 0 14px", fontSize: "12.5px", color: "var(--ok-600)", display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="badge" style={{ width: "24px", height: "24px", background: "var(--ok-50)" }}><span style={{ display: "inline-flex", color: "var(--ok-600)" }}><Raw html={WICON.bank} /></span></span><b>{sb.full}</b>
        </p>
      )}
      <label className="field-label" htmlFor="ukAcct">Account number</label>
      <input className="field-input mono" id="ukAcct" inputMode="numeric" maxLength={8} autoComplete="off" value={d.acct} onChange={(e) => editUk({ acct: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
      <label className="field-label" htmlFor="ukName">Account holder name</label>
      <input className="field-input" id="ukName" autoComplete="off" value={d.name} onChange={(e) => editUk({ name: e.target.value })} />
      <label className="field-label" htmlFor="ukNick">Nickname (optional)</label>
      <input className="field-input" id="ukNick" autoComplete="off" value={d.nick} onChange={(e) => editUk({ nick: e.target.value })} />
      <SaveRecipient checked={d.save} onChange={(v) => editUk({ save: v })} />
      <SpinButton id="ukBankContinue" disabled={!ukReady(d)} delay={400} onClick={continueUk}>Continue</SpinButton>
    </>
  );
}

function PoketUserRow({ u, id, sel, onClick }: { u: PoketUser; id?: string; sel?: boolean; onClick?: () => void }) {
  return (
    <div className={`select-row ${sel ? "sel" : ""}`} id={id} data-poketuser={u.handle} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}>
      <div className="badge" style={{ background: "var(--brand-50)", color: "var(--brand-600)", fontWeight: 700, fontSize: "13px" }}>{u.initials}</div>
      <div className="meta"><div className="t1">{u.name}</div><div className="t2 mono">{u.handle}</div></div>
    </div>
  );
}

/** New Poket user: @handle, email or phone with a name lookup; recent: the reference Transfer's contacts. */
export function SendPoketUserScreen() {
  const { poket: d, back, setPoketQuery, pickRecent, editPoket, continuePoket } = useSend();
  const found = d.lookup.status === "found" ? d.lookup.user : undefined;
  return (
    <>
      <BackRow id="backFromPoketUser" onClick={back} />
      <div className="step-title">Poket user</div>
      <div style={{ position: "relative", marginBottom: "14px" }}>
        <input className="field-input" id="poketQuery" placeholder="@handle, email or phone" aria-label="@handle, email or phone" autoComplete="off"
          style={{ marginBottom: 0, paddingRight: "40px" }} value={d.query} onChange={(e) => setPoketQuery(e.target.value)} />
        {d.lookup.status === "resolving" && (
          <span className="btn-spinner dark" role="status" aria-label="Looking up the name" style={{ position: "absolute", right: "14px", top: "50%", marginTop: "-7px", marginRight: 0 }} />
        )}
      </div>
      {found && (
        <>
          <PoketUserRow u={found} id="poketFound" sel />
          <label className="field-label" htmlFor="poketNick" style={{ marginTop: "8px" }}>Nickname <span style={{ color: "var(--txt3)", fontWeight: 400 }}>(optional)</span></label>
          <input className="field-input" id="poketNick" placeholder="e.g. Mom, Alex from work" value={d.nick} onChange={(e) => editPoket({ nick: e.target.value })} />
        </>
      )}
      {d.lookup.status === "notFound" && <div className="field-err" role="alert">No Poket account found.</div>}
      {!found && (
        <>
          <label className="field-label" style={{ marginTop: "8px" }}>Recent</label>
          {RECENT_POKET_CONTACTS.map((u) => <PoketUserRow key={u.handle} u={u} onClick={() => pickRecent(u)} />)}
        </>
      )}
      {found && <SaveRecipient checked={d.save} onChange={(v) => editPoket({ save: v })} />}
      <SpinButton id="poketContinue" disabled={!found} delay={400} onClick={continuePoket}>Continue</SpinButton>
    </>
  );
}

const COIN_ICON: Record<"USDC" | "USDT", "usdc" | "usdt"> = { USDC: "usdc", USDT: "usdt" };
const NETWORKS: WalletNetwork[] = ["Base", "Polygon", "Solana", "Ethereum"];
function CoinMark({ asset, net }: { asset: "USDC" | "USDT"; net: WalletNetwork }) {
  return (
    <div className="asset-icon-wrap">
      <div className="badge" dangerouslySetInnerHTML={{ __html: WICON[COIN_ICON[asset]] }} />
      <span className="badge-network" dangerouslySetInnerHTML={{ __html: netLogo(net) }} />
    </div>
  );
}

/** New stablecoin wallet: coin and network (one picker), the address (validated, start and end highlighted), an optional nickname. */
export function SendWalletScreen() {
  const { wallet: w, back, editWallet, continueWallet } = useSend();
  const a = w.address.trim(), valid = validAddress(w.net, a);
  const [start, mid, end] = addressParts(a);
  const paste = async () => { try { const t = await navigator.clipboard.readText(); if (t) editWallet({ address: t.trim() }); } catch { /* no clipboard access */ } };
  return (
    <>
      <BackRow id="backFromWallet" onClick={back} />
      <div className="step-title">New wallet</div>
      <div className="select-row sel" id="pickAsset" role="button" tabIndex={0} onClick={() => useSend.setState({ stage: "coinPicker" })}>
        <CoinMark asset={w.asset} net={w.net} />
        <div className="meta"><div className="t1">{w.asset}</div><div className="t2">{w.net}</div></div>
        <span className="va-chev">{"›"}</span>
      </div>
      <div style={{ position: "relative", margin: "14px 0" }}>
        <input className="field-input mono" id="walletAddr" placeholder={`${w.asset} address`} aria-label={`${w.asset} address`} autoComplete="off" spellCheck={false}
          style={{ marginBottom: 0, paddingRight: "64px" }} value={w.address} onChange={(e) => editWallet({ address: e.target.value })} />
        <span className="btn-ghost" id="pasteBtn" role="button" tabIndex={0} aria-label="Paste" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }} onClick={() => void paste()}>Paste</span>
      </div>
      {a && valid && (
        <div className="addr-row" id="walletAddrFull" style={{ marginBottom: "14px", wordBreak: "break-all" }}>
          <span><em>{start}</em>{mid}<em>{end}</em></span>
        </div>
      )}
      {a && !valid && a.length > 8 && <div className="field-err" role="alert">That isn&rsquo;t a {w.net} address.</div>}
      {a && valid && (
        <>
          <label className="field-label" htmlFor="walletNick">Nickname (optional)</label>
          <input className="field-input" id="walletNick" placeholder="e.g. My Ledger" autoComplete="off" value={w.nick} onChange={(e) => editWallet({ nick: e.target.value })} />
          <SaveRecipient checked={w.save} onChange={(v) => editWallet({ save: v })} />
        </>
      )}
      <SpinButton id="walletContinue" disabled={!valid} delay={400} onClick={continueWallet}>Continue</SpinButton>
    </>
  );
}

/** "Coin and network": USDC and USDT on each network, as one list. */
export function SendCoinPickerScreen() {
  const { wallet: w, back, pickCoin } = useSend();
  return (
    <>
      <BackRow id="backFromCoinPicker" onClick={back} />
      <div className="step-title">Coin and network</div>
      {(["USDC", "USDT"] as const).flatMap((c) => NETWORKS.map((n) => (
        <div key={c + n} className={`select-row ${w.asset === c && w.net === n ? "sel" : ""}`} data-cn={`${c}|${n}`} role="button" tabIndex={0} onClick={() => pickCoin(c, n)}>
          <CoinMark asset={c} net={n} />
          <div className="meta"><div className="t1">{c}</div><div className="t2">{n}</div></div>
          <div className="radio" />
        </div>
      )))}
    </>
  );
}

/** Sending to external wallets needs Tier 2 (the explore prototype's tier2Gate). */
export function SendTier2Screen() {
  const back = useSend((s) => s.back);
  const tier = useNgn((s) => s.tier);
  const steps: [string, boolean][] = [["Account", true], ["Identity", tier >= 1], ["Address and source of funds", false]];
  return (
    <>
      <BackRow id="backFromTier2" onClick={back} />
      <div className="center-col" style={{ paddingTop: "20px" }}>
        <div className="check-circle" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}><Raw html={WICON.lockIc} /></div>
        <div className="step-title" style={{ textAlign: "center" }}>Unlock sending to external wallets</div>
      </div>
      <div className="info-card" id="tier2Steps">
        {steps.map(([label, done], i) => (
          <div className="info-row" key={label}><span>{label}</span><span>{done ? <span className="va-status">{"✓"} Done</span> : <span className="va-status muted">{`Step ${i + 1}`}</span>}</span></div>
        ))}
      </div>
      <button className="btn-primary" id="tier2Go" style={{ marginTop: "14px" }} onClick={() => showNotPorted("Tier 2 verification isn't ported yet.")}>Continue verification</button>
    </>
  );
}

const STAGE_SCREEN: Record<SendStage, () => React.ReactElement> = {
  recipients: SendRecipientsScreen, new: SendNewRecipientScreen, bankCurrency: SendBankCurrencyScreen, usBank: SendUsBankScreen, ukBank: SendUkBankScreen,
  poketUser: SendPoketUserScreen, wallet: SendWalletScreen, coinPicker: SendCoinPickerScreen, tier2: SendTier2Screen,
};

/** The current Send screen, for WalletShell's #panelBody. */
export function SendBody() {
  const stage = useSend((s) => s.stage);
  if (!stage) return null;
  const C = STAGE_SCREEN[stage];
  return <div className="screen-fade" key={stage}><C /></div>;
}
