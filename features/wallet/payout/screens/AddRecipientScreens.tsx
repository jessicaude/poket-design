"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import type { PayoutMethodType } from "@/lib/mock-api";
import { holderName } from "../../ngn/useNgn";
import { METHOD_OPTIONS, RAIL_OPTIONS, formatCardNumber, holderMatches, resolveUsBankName, type Draft } from "../payoutMath";
import { AddressFields, BackRow, Dropdown, SpinButton } from "../parts";
import { draftReady, usePayout } from "../usePayout";

/** tPayout stage 'add-recipient' (cash): link a payout method in your own name. */
export function AddSelfScreen() {
  const { draft: d, editDraft, saveDraft, back } = usePayout();
  const legalName = holderName();
  const match = holderMatches(d, legalName);
  return (
    <>
      <BackRow id="backToPayoutRecipient" onClick={back} />
      <div className="step-title">Link a payout method</div>
      <p className="step-sub">This account must be in your name.</p>
      <label className="field-label">Account holder name</label>
      <input className="field-input" id="payoutHolderNameInput" placeholder="Full legal name" value={d.holderName || ""} onChange={(e) => editDraft({ holderName: e.target.value })} />
      <div id="payoutHolderMatchHint" style={{ margin: "-8px 0 14px", fontSize: "11.5px", display: d.holderName ? "block" : "none", color: match ? "var(--ok-600)" : "var(--err-600)" }}>
        {match ? "Matches verified account holder" : `Must match account holder: ${legalName}`}
      </div>
      <label className="field-label">Nickname</label>
      <input className="field-input" id="payoutNameInput" placeholder="e.g. Personal checking" value={d.name || ""} onChange={(e) => editDraft({ name: e.target.value })} />
      <MethodFields self d={d} edit={editDraft} />
      <SpinButton id="savePayoutRecipientBtn" style={{ marginTop: "6px" }} disabled={!draftReady(d, true, legalName)} delay={500} onClick={saveDraft}>Link method</SpinButton>
    </>
  );
}

/** tPayout stage 'add-recipient-details': who the payout is for. */
export function AddOtherDetailsScreen() {
  const { draft: d, editDraft, back } = usePayout();
  return (
    <>
      <BackRow id="backToPayoutRecipient" onClick={back} />
      <div className="step-title">Add recipient</div>
      <p className="step-sub">Who are you sending this payout to?</p>
      <label className="field-label">Recipient name</label>
      <div className="field-icon-wrap">
        <span className="field-icon"><Raw html={WICON.user} /></span>
        <input className="field-input" id="payoutOtherNameInput" placeholder="e.g. Jordan Blake" value={d.name || ""} onChange={(e) => editDraft({ name: e.target.value })} />
      </div>
      <SpinButton id="payoutRecipDetailsContinue" style={{ marginTop: "6px" }} disabled={!(d.name && d.name.trim().length > 0)} delay={400}
        onClick={() => usePayout.setState({ stage: "add-recipient-method" })}>Continue</SpinButton>
    </>
  );
}

/** tPayout stage 'add-recipient-method': how they receive it. */
export function AddOtherMethodScreen() {
  const { draft: d, editDraft, saveDraft, back } = usePayout();
  return (
    <>
      <BackRow id="backToPayoutRecipDetails" onClick={back} />
      <div className="step-title">Payment method</div>
      <p className="step-sub">How should {d.name || "they"} receive this payout?</p>
      <MethodFields self={false} d={d} edit={editDraft} />
      <SpinButton id="saveOtherPayoutMethodBtn" style={{ marginTop: "6px" }} disabled={!draftReady(d, false, "")} delay={500} onClick={saveDraft}>Add recipient</SpinButton>
    </>
  );
}

/**
 * The Method dropdown and the fields for the chosen method. Bank accounts take a transfer rail, routing number and
 * account number. (NGN bank accounts use NgnAccountScreen, with name enquiry, instead of the reference's NGN branch.)
 * Field ids differ between your own method and someone else's, as in the reference.
 */
function MethodFields({ self, d, edit }: { self: boolean; d: Draft; edit: (p: Draft) => void }) {
  const p = self ? "payout" : "payoutOther";
  const method = d.methodType ?? "bank";
  const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);
  return (
    <>
      <label className="field-label">Method</label>
      <Dropdown id={self ? "payoutSelfMethod" : "payoutOtherMethod"} options={METHOD_OPTIONS} value={method} placeholder="Select method"
        onChange={(v) => edit({ methodType: v as PayoutMethodType })} />
      {method === "bank" && (
        <>
          <label className="field-label" style={{ marginTop: "14px" }}>Transfer rail</label>
          <Dropdown id="payoutRailType" options={RAIL_OPTIONS} value={d.railType} placeholder="Select rail" onChange={(v) => edit({ railType: v })} />
          <label className="field-label">Routing number</label>
          <input className="field-input mono" id={`${p}RoutingInput`} placeholder="9-digit routing number" maxLength={9} value={d.routingNumber || ""}
            onChange={(e) => { const r = digits(e.target.value, 9); edit({ routingNumber: r, bankName: resolveUsBankName(r) }); }} />
          {d.bankName ? (
            <p style={{ margin: "-8px 0 14px", fontSize: "12.5px", color: "var(--ok-600)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="badge" style={{ width: "24px", height: "24px", background: "var(--ok-50)" }}><span style={{ display: "inline-flex", color: "var(--ok-600)" }}><Raw html={WICON.bank} /></span></span><b>{d.bankName}</b>
            </p>
          ) : <p style={{ margin: "-8px 0 14px", fontSize: "11.5px", color: "var(--txt3)" }}>Bank name will appear here once verified.</p>}
          <label className="field-label">Account number</label>
          <input className="field-input mono" id={`${p}AcctInput`} placeholder="Account number" value={d.accountNumber || ""} onChange={(e) => edit({ accountNumber: digits(e.target.value, 17) })} />
          <AddressFields d={d} edit={edit} />
        </>
      )}
      {method === "card" && (
        <>
          <label className="field-label" style={{ marginTop: "14px" }}>Card number</label>
          <input className="field-input mono" id={`${p}CardInput`} placeholder="4242 4242 4242 4242" maxLength={19} value={d.cardNumber || ""} onChange={(e) => edit({ cardNumber: formatCardNumber(e.target.value) })} />
          <AddressFields d={d} edit={edit} />
        </>
      )}
      {method === "zelle" && (
        <>
          <label className="field-label" style={{ marginTop: "14px" }}>Zelle email or phone</label>
          <input className="field-input" id="payoutZelleInput" placeholder="name@email.com or phone number" value={d.zelleContact || ""} onChange={(e) => edit({ zelleContact: e.target.value })} />
        </>
      )}
      {method === "cashapp" && (
        <>
          <label className="field-label" style={{ marginTop: "14px" }}>$Cashtag</label>
          <input className="field-input mono" id="payoutCashtagInput" placeholder="$jordanb" value={d.cashtag || ""} onChange={(e) => edit({ cashtag: e.target.value })} />
        </>
      )}
    </>
  );
}
