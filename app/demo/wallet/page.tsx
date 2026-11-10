import { getWalletCss } from "@/features/wallet/walletCss";
import { WalletDemo } from "./WalletDemo";

/** The Poket wallet on its own ("Wallet only" in reference/poket-unified.html), with an empty body for now. */
export default function WalletDemoPage() {
  return <WalletDemo css={getWalletCss()} />;
}
