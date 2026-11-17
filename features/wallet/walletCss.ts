import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The wallet's stylesheet as text, for WalletShell's shadow root.
 * styles/wallet.css is the reference's shadow-root stylesheet (:host tokens, global resets, class names
 * shared with prototype.css), so it can't be imported globally. Read it on the server and pass it down.
 * wallet-signup.css is Checkout's sign-up styles scoped under .su (features/auth/SignupForm.tsx).
 */
const read = (f: string) => readFileSync(path.join(process.cwd(), "styles", f), "utf8");

export function getWalletCss(): string {
  return read("wallet.css") + "\n" + read("wallet-overrides.css") + "\n" + read("wallet-signup.css");
}
