"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../useNgn";
import { useConvert } from "../../convert/useConvert";

/**
 * "Deposit NGN": tDepositMethod() with cur === 'NGN' in reference/poket-unified.html.
 * NGN is funded only by bank transfer or conversion, never by card.
 * The chevron is the reference's fallback text: icons.chevR doesn't exist there.
 */
export function DepositNgnScreen() {
  const { back, dedicated, openBankTransfer } = useNgn();
  const ready = dedicated?.status === "ready";
  return (
    <>
      <button className="back-row" id="backToDepositSelect" onClick={back}><Raw html={WICON.back} /> Back</button>
      <div className="step-title">Deposit NGN</div>
      <div className="select-row" id="dmBank" onClick={openBankTransfer}>
        <div className="va-ic"><Raw html={WICON.bank} /></div>
        <div className="meta"><div className="t1">Bank transfer</div><div className="t2">{ready ? "To your NGN account · usually within seconds" : "From any Nigerian bank"}</div></div>
        <span className="va-chev">{"›"}</span>
      </div>
      <div className="select-row" id="dmConvert" onClick={() => useConvert.getState().start({ to: "cash:NGN:open" })}>
        <div className="va-ic"><Raw html={WICON.convert} /></div>
        <div className="meta"><div className="t1">Convert</div><div className="t2">From your USD or USDC balance</div></div>
        <span className="va-chev">{"›"}</span>
      </div>
    </>
  );
}
