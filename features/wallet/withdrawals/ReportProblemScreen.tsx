"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { CHECK_DRAW, WICON } from "@/lib/icons";
import { formatNairaShort, withoutCode } from "@/lib/money";
import type { RecallStatus, Withdrawal } from "@/lib/mock-api";
import { BackRow, Grey } from "../payout/parts";
import { useWithdrawals } from "../payout/useWithdrawals";
import { sentText } from "../payout/withdrawals";
import { useWalletNav } from "../useWalletNav";

/**
 * "Report a problem" on a Paid send to a Nigerian bank: send-report in reference/poket-widgets.html (its reasons,
 * with "Wrong recipient" as "I sent it to the wrong account"), in the wallet's look. That reason opens a recall
 * request (NEW): "Bank transfers can't always be recovered." up front, then the recall's progress on the send.
 */
export const WRONG_ACCOUNT = "I sent it to the wrong account";
const REASONS = [WRONG_ACCOUNT, "It didn’t arrive", "Wrong amount", "Scam or fraud", "Something else"];
export const RECALL_WARNING = "Bank transfers can’t always be recovered.";

/** The recall's chip and line on the send (NEW copy; not recovered is WGT's). */
export const RECALL_META: Record<RecallStatus, { chip: string; tone: string; message: (w: Withdrawal) => string }> = {
  submitted: { chip: "Submitted", tone: "warn", message: () => `We’ve asked the receiving bank to return it. ${RECALL_WARNING}` },
  in_progress: { chip: "In progress", tone: "warn", message: () => "The receiving bank is looking at the recall." },
  recovered: { chip: "Recovered", tone: "", message: (w) => `${formatNairaShort(w.amount)} is back in your NGN balance.` },
  not_recovered: { chip: "Not recovered", tone: "err", message: () => "We couldn’t recover this transfer. The receiving bank didn’t return it." },
};

/** On a Paid send to a Nigerian bank: Report a problem, the reported problem, or the recall and where it stands. */
export function SendProblem({ w }: { w: Withdrawal }) {
  const push = useWalletNav((s) => s.push);
  if (w.recall) {
    const m = RECALL_META[w.recall.status];
    return (
      <div className="info-card" id="recall" style={{ marginTop: "14px" }}>
        <div className="info-row"><span>Recall</span><span><span className={`va-status ${m.tone}`} id="recallStatus">{m.chip}</span></span></div>
        <p className="step-sub" id="recallMsg" style={{ margin: "8px 0 2px", fontSize: "12.5px" }}>{m.message(w)}</p>
      </div>
    );
  }
  if (w.problem) return (
    <div className="alert info" id="problemReported" role="note" style={{ marginTop: "14px", marginBottom: 0 }}>
      <Raw html={WICON.info} /><span>You reported a problem. We&rsquo;re looking into it and will email you.</span>
    </div>
  );
  return (
    <>
      <button className="btn-secondary" id="reportProblem" style={{ width: "100%", marginTop: "14px" }} onClick={() => push({ name: "report", id: w.id })}>Report a problem</button>
      <p className="step-sub" style={{ textAlign: "center", fontSize: "12px", margin: "8px 0 0" }}>Payments to people can&rsquo;t be disputed.</p>
    </>
  );
}

/** send-report, then (wrong account) the recall request; a confirmation either way. */
export function ReportProblemScreen({ id }: { id: string }) {
  const back = useWalletNav((s) => s.back);
  const w = useWithdrawals((s) => s.list.find((x) => x.id === id));
  const { reportProblem, requestRecall } = useWithdrawals();
  const [stage, setStage] = useState<"choose" | "recall" | "reported" | "recalled">("choose");
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!w) return <BackRow id="reportBack" onClick={back} />;
  // Running text drops the code (docs/copy.md)
  const amount = withoutCode(sentText(w));

  if (stage === "reported" || stage === "recalled") return (
    <>
      <div className="center-col" style={{ paddingTop: "30px" }} id="reportDone">
        <div className="check-circle"><Raw html={CHECK_DRAW} /></div>
        {stage === "recalled"
          ? <><div className="step-title">Recall requested</div><p className="step-sub">We&rsquo;ll let you know when the receiving bank responds.</p></>
          : <><div className="step-title">We&rsquo;re looking into it</div><p className="step-sub">We&rsquo;ll contact the receiving bank and email you within 2 business days.</p></>}
      </div>
      <button className="btn-primary" id="reportDoneBtn" style={{ marginTop: "18px" }} onClick={back}>Done</button>
    </>
  );

  if (stage === "recall") return (
    <>
      <BackRow id="reportBack" onClick={() => setStage("choose")} />
      <div className="step-title">Request a recall</div>
      {/* Said up front: a recall may not work */}
      <div className="alert warn" id="recallWarning" role="note"><Raw html={WICON.alert} /><span>{RECALL_WARNING}</span></div>
      <p className="step-sub">We&rsquo;ll ask {w.recipientName}&rsquo;s bank to return your {amount}. If they do, it goes back to your NGN balance.</p>
      <div className="info-card">
        <div className="info-row"><span>Amount</span><span><Grey>{amount}</Grey></span></div>
        <div className="info-row"><span>To</span><span>{w.recipientSub}</span></div>
        <div className="info-row"><span>Reference</span><span className="mono">{w.ref}</span></div>
      </div>
      <button className="btn-primary" id="requestRecall" style={{ marginTop: "14px" }} disabled={busy}
        onClick={async () => { setBusy(true); await requestRecall(w.id, WRONG_ACCOUNT, details); setStage("recalled"); }}>Request recall</button>
    </>
  );

  const wrong = reason === WRONG_ACCOUNT;
  return (
    <>
      <BackRow id="reportBack" onClick={back} />
      <div className="step-title">Report a problem</div>
      <p className="step-sub">With your {amount} payment to {w.recipientName}.</p>
      <label className="field-label">What happened?</label>
      <div role="radiogroup" aria-label="What happened?">
        {REASONS.map((r) => (
          <div key={r} className={`select-row ${reason === r ? "sel" : ""}`} role="radio" aria-checked={reason === r} tabIndex={0} data-reportreason={r} onClick={() => setReason(r)}>
            <div className="meta"><div className="t1" style={{ fontWeight: 500 }}>{r}</div></div><span className="radio" />
          </div>
        ))}
      </div>
      {reason === "Scam or fraud" && (
        <div className="alert info" role="note"><Raw html={WICON.info} /><span>If you were tricked into sending this, tell us now. The sooner we know, the better the chance of recovering it.</span></div>
      )}
      <label className="field-label" htmlFor="reportDetails">Details <span style={{ color: "var(--txt3)", fontWeight: 400 }}>Optional</span></label>
      <textarea className="field-input" id="reportDetails" rows={3} style={{ height: "auto", resize: "vertical", fontFamily: "inherit", fontSize: "13.5px" }} value={details} onChange={(e) => setDetails(e.target.value)} />
      <button className="btn-primary" id="reportGo" style={{ marginTop: "12px" }} disabled={!reason || busy}
        onClick={async () => {
          if (wrong) { setStage("recall"); return; }
          setBusy(true); await reportProblem(w.id, reason!, details); setStage("reported");
        }}>{wrong ? "Continue" : "Send report"}</button>
    </>
  );
}
