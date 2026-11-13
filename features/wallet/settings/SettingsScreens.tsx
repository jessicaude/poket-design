"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { formatNaira } from "@/lib/money";
import { listPayoutRecipients } from "@/lib/mock-api";
import { useAccount } from "@/store/account";
import { StepUpIntro } from "../StepUpIntro";
import { TIERS, spentThisMonth, spentToday, tierName } from "../limits";
import { holderName, useNgn, type Tier } from "../ngn/useNgn";
import { BackRow, Grey, Keypad } from "../payout/parts";
import { fmtCurrency } from "../payout/payoutMath";
import { showNotPorted } from "../useWalletToast";
import { useWalletNav } from "../useWalletNav";
import { turnOnInstantTransfers } from "./instant";
import { COOLING_OFF_PLACEHOLDER, INSTANT_TIER_MAX_DEMO_KOBO, TIER_MAX_PLACEHOLDER, effectiveLimit, useSettings } from "./useSettings";
import { useKeypadOnDemand } from "../payout/useKeypadOnDemand";
import { usePayout } from "../payout/usePayout";
import { useWalletToast } from "../useWalletToast";
import { cvBadgeHtml, cvParse } from "../convert/convertMath";

/*
 * The wallet's Settings (the reference's tSettings with extSettingsRows), Security (tSecurity) and Compliance
 * (tAccountTier), plus WGT-09's Instant transfers (NEW: not in the reference) in the same classes.
 */

/** extIc(svg, size): an icon at another size. */
const sized = (svg: string, size: number) => svg.replace(/<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, `<svg$1 width="${size}" height="${size}"`);
/** "₦50,000.00 NGN" with the grey code, as HTML. */
const nairaHtml = (kobo: number) => { const s = formatNaira(kobo), i = s.lastIndexOf(" "); return `${s.slice(0, i)} <span class="cur-code">${s.slice(i + 1)}</span>`; };

/**
 * extSettingsRow(id, icon, title, sub). The HTML is set on the row itself, so the chevron is its last child <svg>
 * (.settings-row>svg:last-child); `sub` is HTML.
 */
function SettingsRow({ id, icon, title, sub, onClick }: { id: string; icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <div className="settings-row" id={id} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      dangerouslySetInnerHTML={{ __html:
        `<span class="settings-row-ic">${sized(icon, 18)}</span>` +
        `<div class="settings-row-text"><div class="settings-row-title">${title}</div><div class="settings-row-sub">${sub}</div></div>` +
        WICON.chevron }} />
  );
}

/** "On · ₦50,000.00 NGN a day" or "Off" (Settings row subtitle). */
export function instantSummaryHtml(on: boolean, limit: number, tier: number) {
  return on ? `On · ${nairaHtml(effectiveLimit(limit, tier))} a day` : "Off";
}

/** tSettings: Name and Email, then Compliance, Instant transfers, Payment methods, Subscriptions, Security, Log out. */
export function SettingsScreen() {
  const { back, push } = useWalletNav();
  const tier = useNgn((s) => s.tier);
  const { instantOn, instantLimit, devices } = useSettings();
  const { name, email } = useProfile();
  const own = listPayoutRecipients().filter((r) => r.isSelf);
  const cards = own.filter((r) => r.methodType === "card").length, banks = own.filter((r) => r.methodType === "bank").length;
  return (
    <>
      <BackRow id="backFromSettings" label="Wallet" onClick={back} />
      <div className="step-title">Settings</div>
      <div className="info-card">
        <div className="info-row"><span>Name</span><span>{name || NOT_ADDED}</span></div>
        <div className="info-row"><span>Email</span><span>{email || NOT_ADDED}</span></div>
      </div>
      <div className="settings-list">
        <SettingsRow id="openCompliance" icon={WICON.tierIc} title="Compliance" sub={`${tierName(tier)} · limits, verification level`} onClick={() => push({ name: "compliance" })} />
        {/* WGT-09 (NEW) */}
        <SettingsRow id="openInstantTransfers" icon={WICON.send} title="Instant transfers" sub={instantSummaryHtml(instantOn, instantLimit, tier)} onClick={() => push({ name: "instant-transfers" })} />
        <SettingsRow id="openMethods" icon={WICON.card} title="Payment methods" sub={`${cards} card${cards === 1 ? "" : "s"} · ${banks} bank account${banks === 1 ? "" : "s"}`} onClick={() => showNotPorted("Payment methods aren’t ported yet.")} />
        <SettingsRow id="openSubscriptions" icon={WICON.calendar} title="Subscriptions" sub="None yet" onClick={() => showNotPorted("Subscriptions aren’t ported yet.")} />
        <SettingsRow id="openSecurity" icon={WICON.shieldIc} title="Security" sub={`Passcode delivery · ${devices.length} signed-in device${devices.length === 1 ? "" : "s"}`} onClick={() => push({ name: "security" })} />
        <SettingsRow id="settingsLogOut" icon={WICON.back} title="Log out" sub="Log back in with a passcode" onClick={() => showNotPorted("Logging out isn’t ported yet.")} />
      </div>
    </>
  );
}

/** A missing name or email (docs/copy.md: words, not a dash). NEW copy. */
export const NOT_ADDED = "Not added";
/**
 * The signed-in account's name and email, as they are (empty when missing). Before the demo has signed Ada in, the
 * reference's demo person.
 */
function useProfile() {
  const signedIn = useAccount((s) => !!s.account);
  const first = useAccount((s) => s.account?.first ?? ""), last = useAccount((s) => s.account?.last ?? "");
  const email = useAccount((s) => s.account?.email ?? "");
  if (!signedIn) return { name: holderName(), email: "ada@osun.co" };
  return { name: [first, last].filter(Boolean).join(" ").trim(), email: email.trim() };
}

/** tSecurity: passcode delivery (email or text) and signed-in devices. */
export function SecurityScreen() {
  const back = useWalletNav((s) => s.back);
  const { channel, setChannel, devices, signOutDevice } = useSettings();
  const { email } = useProfile();
  const phone = ""; // no phone number in the demo: Text message needs one first
  const row = (val: "email" | "text", title: string, sub: string, disabled: boolean) => (
    <div className={`select-row ${channel === val ? "sel" : ""}`} data-channel={val} role="radio" aria-checked={channel === val} aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0} style={disabled ? { opacity: 0.45, cursor: "default" } : undefined}
      onClick={() => { if (!disabled) setChannel(val); }}>
      <div className="meta"><div className="t1">{title}</div><div className="t2">{sub}</div></div><span className="radio" />
    </div>
  );
  return (
    <>
      <BackRow id="extBackSettings" label="Settings" onClick={back} />
      <div className="step-title">Security</div>
      <div className="section-title">Passcode delivery</div>
      {row("email", "Email", email || NOT_ADDED, false)}
      {row("text", "Text message", phone || "Add a phone number first", !phone)}
      <div className="section-title" style={{ marginTop: "18px" }}>Signed-in devices</div>
      {devices.length ? (
        <div className="settings-list">
          {devices.map((d) => (
            <div className="settings-row" key={d.id} data-device={d.id} style={{ cursor: "default" }}>
              <span className="settings-row-ic"><Raw html={WICON.lockIc} /></span>
              <div className="settings-row-text"><div className="settings-row-title">{d.label}</div><div className="settings-row-sub">{d.meta === "Now" ? "Active now" : `Last active ${d.meta}`}</div></div>
              {d.id !== "d1" && <span className="btn-ghost" data-signout={d.id} role="button" tabIndex={0} onClick={() => signOutDevice(d.id)}>Sign out</span>}
            </div>
          ))}
        </div>
      ) : <p className="step-sub">No other devices.</p>}
    </>
  );
}

/** tierLimitsCardHtml(tier): the tier's per-transaction, daily and monthly limits (USD). */
function TierLimitsCard({ tier }: { tier: 1 | 2 | 3 }) {
  const t = TIERS[tier];
  return (
    <div className="info-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: "9px 14px", borderBottom: "1px solid var(--bdr2)" }}>{t.name} limits</div>
      <div style={{ padding: "2px 14px 4px" }}>
        <div className="info-row"><span>Per transaction</span><span className="mono">{fmtCurrency(t.txLimit * 100, "USD")}</span></div>
        <div className="info-row"><span>Per day</span><span className="mono">{fmtCurrency(t.dayLimit * 100, "USD")}</span></div>
        <div className="info-row"><span>Per month</span><span className="mono">{fmtCurrency(t.monthLimit * 100, "USD")}</span></div>
      </div>
    </div>
  );
}

/**
 * tAccountTier ("Compliance"): the current level, its limits and what's been spent, and "Increase my limits". The
 * reference's demo-only "Reset demo spend history" and admin compliance log aren't shown.
 */
export function ComplianceScreen() {
  const { back, push } = useWalletNav();
  const tier = useNgn((s) => s.tier);
  const next = tier < 3 ? tier + 1 : null;
  return (
    <>
      <BackRow id="backFromAccountTier" label="Settings" onClick={back} />
      <div className="step-title">Compliance</div>
      <p className="step-sub">Your verification level sets how much you can move with Poket.</p>
      <div className="info-card"><div className="info-row"><span>Current level</span><span id="currentLevel">{tierName(tier)}</span></div></div>
      {tier > 0 ? <TierLimitsCard tier={tier as 1 | 2 | 3} /> : <div className="info-card"><div className="info-row"><span>Status</span><span>Verify your identity to raise your limits.</span></div></div>}
      <div className="info-card">
        <div className="info-row"><span>Spent today</span><span className="mono">{fmtCurrency(Math.round(spentToday() * 100), "USD")}</span></div>
        <div className="info-row"><span>Spent this month</span><span className="mono">{fmtCurrency(Math.round(spentThisMonth() * 100), "USD")}</span></div>
      </div>
      {next
        ? <button className="btn-primary" id="startStepupFromAccount" onClick={() => push({ name: "compliance-stepup" })}>Increase my limits ({TIERS[next as 1 | 2 | 3].name})</button>
        : <div className="alert success"><Raw html={WICON.check} /><span>You&rsquo;re at Poket&rsquo;s highest verification level.</span></div>}
    </>
  );
}

/**
 * The step-up from Compliance (tStepupIntro, then back to Compliance). Demo stand-in: Continue raises the tier by
 * one in place of the verification steps, which aren’t ported yet.
 */
export function ComplianceStepUpScreen() {
  const back = useWalletNav((s) => s.back);
  const tier = useNgn((s) => s.tier);
  return <StepUpIntro current={tier} target={tier + 1} onCancel={back}
    onContinue={() => { useNgn.getState().set({ tier: Math.min(3, tier + 1) as Tier }); back(); }} />;
}

/** The wallet's switch (the reference's inline role="switch", as on its dispute form). */
function Switch({ id, on, label, onChange }: { id: string; on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" id={id} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ position: "relative", width: "40px", height: "24px", border: 0, padding: 0, borderRadius: "999px", background: on ? "var(--brand-500)" : "var(--n-300)", flex: "none", cursor: "pointer", transition: "background .15s ease" }}>
      <span style={{ position: "absolute", left: "3px", top: "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transform: `translateX(${on ? 16 : 0}px)`, transition: "transform .15s ease" }} />
    </button>
  );
}

/**
 * WGT-09, Instant transfers (NEW copy, not in the reference): the switch for instant naira transfers to bank
 * accounts, the daily limit (formatNaira) with Change, and the tier link to raise the maximum.
 */
export function InstantTransfersScreen() {
  const { back, push } = useWalletNav();
  const tier = useNgn((s) => s.tier);
  const { instantOn, instantLimit, setInstantOn, instantPending, cancelPendingLimit } = useSettings();
  const next = tier < 3 ? tier + 1 : null;
  // On asks for the PIN first; off asks to confirm (a sheet), then takes effect at once
  const [confirmOff, setConfirmOff] = useState(false);
  const toggle = (on: boolean) => (on ? turnOnInstantTransfers() : setConfirmOff(true));
  return (
    <>
      <BackRow id="backFromInstant" label="Settings" onClick={back} />
      <div className="step-title">Instant transfers</div>
      <div className="select-row" style={{ cursor: "default" }}>
        <div className="meta">
          <div className="t1">Instant transfers to banks</div>
          <div className="t2" id="instantExplain">Send naira to Nigerian bank accounts in seconds, up to your daily limit. When it&rsquo;s off, you can&rsquo;t send to banks.</div>
        </div>
        <Switch id="instantSwitch" on={instantOn} label="Instant transfers to banks" onChange={toggle} />
      </div>
      <div className="section-title" style={{ marginTop: "18px" }}>Daily limit</div>
      <div className="info-card" id="instantLimitCard" style={instantOn ? undefined : { opacity: 0.55 }}>
        <div className="info-row" style={{ alignItems: "center" }}>
          <span>
            <span className="mono" id="instantLimit" style={{ fontSize: "16px", fontWeight: 600, color: "var(--txt)" }}><Grey>{formatNaira(effectiveLimit(instantLimit, tier))}</Grey></span>
            <span style={{ display: "block", fontSize: "12px", color: "var(--txt3)", marginTop: "2px" }} id="instantTierMax">Up to {TIER_MAX_PLACEHOLDER} at your tier</span>
          </span>
          <button type="button" className="cv-max" id="instantChange" disabled={!instantOn} onClick={() => push({ name: "instant-limit" })}>Change</button>
        </div>
        {instantPending !== null && (
          // A raised limit waiting out the cooling-off period (demo bar: Skip cooling-off)
          <div className="info-row" id="instantPending" style={{ alignItems: "center" }}>
            <span>
              <span className="mono" id="instantPendingAmt" style={{ fontWeight: 600, color: "var(--txt)" }}><Grey>{formatNaira(instantPending)}</Grey></span>
              <span style={{ display: "block", fontSize: "12px", color: "var(--txt3)", marginTop: "2px" }} id="instantPendingWhen">Starts in {COOLING_OFF_PLACEHOLDER}</span>
            </span>
            <span className="btn-ghost" id="instantCancelChange" role="button" tabIndex={0} style={{ color: "var(--brand-600)", fontWeight: 600 }} onClick={cancelPendingLimit}
              onKeyDown={(e) => { if (e.key === "Enter") cancelPendingLimit(); }}>Cancel change</span>
          </div>
        )}
      </div>
      {next
        ? <span className="btn-ghost" id="instantRaiseTier" role="button" tabIndex={0} style={{ display: "inline-block", marginTop: "12px" }}
            onClick={() => push({ name: "compliance" })}>Raise your maximum: {TIERS[next as 1 | 2 | 3].name}</span>
        : <p className="step-sub" style={{ marginTop: "12px" }}>You&rsquo;re at Poket&rsquo;s highest verification level.</p>}
      {confirmOff && (
        <div className="pk-sheet-scrim" id="instantOffSheet" onClick={(e) => { if (e.target === e.currentTarget) setConfirmOff(false); }}>
          <div className="pk-sheet" role="dialog" aria-modal="true" aria-labelledby="instantOffTitle">
            <div className="step-title" id="instantOffTitle">Turn off instant transfers?</div>
            <p className="step-sub">Sends to Nigerian banks won&rsquo;t go until you turn them back on.</p>
            <button className="btn-primary btn-danger" id="instantOffConfirm" onClick={() => { setInstantOn(false); setConfirmOff(false); }}>Turn off</button>
            <button className="btn-secondary" id="instantOffCancel" style={{ width: "100%", marginTop: "8px" }} onClick={() => setConfirmOff(false)}>Keep them on</button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Change the daily limit: Send's amount box with the keypad on demand, capped at the tier's maximum (₦[tier max]).
 * Save asks for the PIN; lower applies at once, higher starts after [cooling-off] (pending on the previous screen).
 */
export function InstantLimitScreen() {
  const back = useWalletNav((s) => s.back);
  const tier = useNgn((s) => s.tier);
  const { instantLimit, changeInstantLimit, limitDraft, setLimitDraft } = useSettings();
  const max = INSTANT_TIER_MAX_DEMO_KOBO[Math.max(0, Math.min(3, tier)) as 0 | 1 | 2 | 3];
  const current = effectiveLimit(instantLimit, tier);
  // The typed amount lives in the store, so it's still there after Back from the PIN screens
  const kobo = limitDraft ?? current;
  const setKobo = (f: (c: number) => number) => setLimitDraft(f(kobo));
  const { open: keypad, setOpen: setKeypad, ref } = useKeypadOnDemand();
  const key = (k: string) => setKobo((c) => (k === "back" ? Math.floor(c / 10) : c >= 1e12 ? c : c * 10 + Number(k)));
  const over = kobo > max;
  const save = () => {
    const raise = kobo > current;
    usePayout.getState().approveWithPin(raise ? "Raises your daily limit." : "Lowers your daily limit.", () => {
      changeInstantLimit(kobo);
      setLimitDraft(null);
      if (raise) useWalletToast.getState().showToast(`Your new limit starts in ${COOLING_OFF_PLACEHOLDER}`);
      back(); // to Instant transfers
    });
  };
  return (
    <>
      <BackRow id="backFromInstantLimit" label="Instant transfers" onClick={() => { setLimitDraft(null); back(); }} />
      <div className="step-title">Daily limit</div>
      <div ref={ref} style={{ marginTop: "14px" }}>
        <div className="cv-box" id="instantLimitBox" style={keypad ? { borderColor: "var(--brand-500)", boxShadow: "0 0 0 3px var(--brand-100)" } : undefined}>
          <div className="cv-box-top"><span>Daily limit</span><span id="instantLimitMax">Up to {TIER_MAX_PLACEHOLDER} at your tier</span></div>
          <div className="cv-box-row">
            <span className="cv-pick" aria-disabled="true"><Raw html={cvBadgeHtml(cvParse("cash:NGN:open"), 28)} /><span className="cv-pick-name">NGN</span></span>
            <span className={`cv-amt mono ${over ? "err" : ""}`} id="instantLimitAmt" role="button" tabIndex={0} aria-label="Daily limit amount" aria-expanded={keypad}
              style={{ cursor: "text" }} onClick={() => setKeypad(true)} onKeyDown={(e) => { if (e.key === "Enter") setKeypad(true); }}>
              {(kobo / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        {over && <div className="cv-hint err" id="instantLimitErr">More than your tier allows ({TIER_MAX_PLACEHOLDER}).</div>}
        {keypad && (
          <div id="limitKeypad" style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
              <button type="button" className="cv-max" id="limitKeypadDone" onClick={() => setKeypad(false)}>Done</button>
            </div>
            <Keypad dataKey="limitkey" onKey={key} />
          </div>
        )}
      </div>
      {/* NEW copy: what Save does, raise or lower */}
      {!over && kobo > 0 && kobo !== current && (
        <p className="step-sub" id="instantLimitWhen" style={{ marginTop: "12px" }}>
          {kobo > current ? `A higher limit starts in ${COOLING_OFF_PLACEHOLDER}.` : "A lower limit applies at once."}
        </p>
      )}
      <button className="btn-primary" id="instantLimitSave" style={{ marginTop: "12px" }} disabled={kobo <= 0 || over || kobo === current} onClick={save}>Save</button>
    </>
  );
}
