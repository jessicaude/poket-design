"use client";
import { ConvertBody } from "./convert/ConvertBody";
import { SendBody } from "./send/SendScreens";
import { useSend } from "./send/useSend";
import { useConvert } from "./convert/useConvert";
import { NgnBody } from "./ngn/NgnBody";
import { useNgn } from "./ngn/useNgn";
import { NgnBalanceEntry } from "./payout/NgnBalanceEntry";
import { PayoutBody } from "./payout/PayoutBody";
import { usePayout } from "./payout/usePayout";
import { NotificationsScreen } from "./NotificationsScreen";
import { currentScreen, useWalletNav } from "./useWalletNav";
import { NgnBalanceScreen } from "./withdrawals/NgnBalanceScreen";
import { OnHoldScreen } from "./withdrawals/OnHoldScreen";
import { WithdrawalStatusScreen } from "./withdrawals/WithdrawalStatusScreen";
import { ConversionReceiptScreen } from "./withdrawals/ConversionReceiptScreen";

/**
 * WalletShell's default #panelBody: an open Send, Convert, send-to-bank or NGN flow first, then the current wallet screen
 * (NGN balance, on hold, withdrawal status, conversion receipt, notifications), else the home entry (NGN balance + Withdraw).
 */
export function WalletBody() {
  const send = useSend((s) => s.stage);
  const convert = useConvert((s) => s.stage);
  const payout = usePayout((s) => s.stage);
  const ngn = useNgn((s) => s.stage);
  const screen = currentScreen(useWalletNav((s) => s.stack));
  if (send) return <SendBody />;
  if (convert) return <ConvertBody />;
  if (payout) return <PayoutBody />;
  if (ngn) return <NgnBody />;
  if (!screen) return <NgnBalanceEntry />;
  const key = screen.name + ("id" in screen ? screen.id : "");
  return (
    <div className="screen-fade" key={key}>
      {screen.name === "ngn-balance" && <NgnBalanceScreen />}
      {screen.name === "on-hold" && <OnHoldScreen />}
      {screen.name === "withdrawal" && <WithdrawalStatusScreen id={screen.id} />}
      {screen.name === "conversion" && <ConversionReceiptScreen id={screen.id} />}
      {screen.name === "notifications" && <NotificationsScreen />}
    </div>
  );
}
