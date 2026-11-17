import type { StoreApi, UseBoundStore } from "zustand";
import { accountKey, findAccount, listPayoutRecipients, switchWalletOwner } from "@/lib/mock-api";
import { useAccount, type Account } from "@/store/account";
import { useNgn, type Tier } from "./ngn/useNgn";
import { useHoldings } from "./useHoldings";
import { useWithdrawals } from "./payout/useWithdrawals";
import { useConvert } from "./convert/useConvert";
import { useNgnCredits } from "./history/credits";
import { useNgnLedger } from "./history/ledger";
import { useDeposit } from "./deposit/useDeposit";
import { useCards } from "./card/useCards";
import { usePayout } from "./payout/usePayout";
import { useSend } from "./send/useSend";
import { useNotifications } from "./useNotifications";
import { useSettings } from "./settings/useSettings";
import { useSpend } from "./limits";
import { useDemoDisputes } from "./disputes/DisputeScreens";
import { useWalletNav } from "./useWalletNav";
import { useWalletHome } from "./home/homeData";
import { useWalletSession } from "./useWalletSession";

/**
 * Signing the wallet in and out (useWalletSession). The account itself is the shared one (store/account.ts), so an
 * account made in the wallet logs in at Checkout and the other way round.
 *
 * Each account has its own wallet: signing out puts its balances, history, recipients and settings aside, and signing
 * back in brings them back. An account the wallet hasn't seen starts empty, at its tier (a new sign-up: Tier 0).
 */
export { useWalletSession };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Store = UseBoundStore<StoreApi<any>>;
/** The wallet's per-account stores. The ledger is last: restoring balances records lines, which it then replaces. */
const STORES: Record<string, Store> = {
  ngn: useNgn, holdings: useHoldings, withdrawals: useWithdrawals, convert: useConvert, credits: useNgnCredits, deposit: useDeposit,
  cards: useCards, payout: usePayout, send: useSend, notifications: useNotifications, settings: useSettings, spend: useSpend,
  disputes: useDemoDisputes, ledger: useNgnLedger,
};
const data = (s: Record<string, unknown>) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function"));
const saved: Record<string, Record<string, Record<string, unknown>>> = {};

/** Close every open flow and go back to the home tab (before switching, and on sign-out). */
function closeFlows() {
  useSend.getState().close(); usePayout.getState().close(); useConvert.getState().close(); useNgn.getState().close(); useDeposit.getState().close();
  useCards.setState({ creating: false, stepUp: false, freezeConfirm: false, authorizing: false });
  useWalletNav.getState().home();
  useWalletHome.setState({ tab: "home" });
}

/** Put the signed-in account's wallet aside. */
function putAside() {
  const email = useWalletSession.getState().email;
  if (!email) return;
  saved[email] = Object.fromEntries(Object.entries(STORES).map(([k, s]) => [k, structuredClone(data(s.getState()))]));
}

/** A new wallet: no money, no history, no recipients, this device only; the tier is the account's. */
function startEmpty(a: Account) {
  useNgn.getState().reset();
  useNgn.setState({ tier: a.tier as Tier, ngnBalance: 0 });
  useHoldings.setState({ cash: { USD: 0, EUR: 0, GBP: 0, GHS: 0 }, fiatOnly: { USD: 0, NGN: 0, EUR: 0, GBP: 0, GHS: 0 }, coins: { USDC: { Polygon: 0, Base: 0 }, USDT: { Polygon: 0, Base: 0 } } });
  useWithdrawals.getState().refresh();
  useConvert.getState().reset();
  useNgnCredits.getState().refresh();
  useDeposit.getState().reset();
  useDeposit.setState({ savedCards: [] });
  useCards.getState().reset();
  usePayout.setState({ recipients: listPayoutRecipients(), pinSet: false });
  useSend.setState({ recipients: [] });
  useNotifications.getState().reset();
  useSettings.getState().reset();
  useSettings.setState((s) => ({ devices: s.devices.filter((d) => d.id === "d1") }));
  useSpend.getState().reset();
  useDemoDisputes.setState({ open: {} });
  useNgnLedger.setState({ entries: [] });
}

/** Sign the wallet in as `key` (an account's email or phone key, lib/mock-api accountKey): its own wallet, or a new empty one. */
export function signInWallet(key: string) {
  const a = findAccount(key);
  if (!a) return;
  key = accountKey(a);
  if (useWalletSession.getState().email === key) { useAccount.getState().signIn(structuredClone(a)); return; }
  closeFlows();
  putAside();
  switchWalletOwner(key);
  useAccount.getState().signIn(structuredClone(a));
  const back = saved[key];
  if (back) for (const [k, s] of Object.entries(STORES)) s.setState(structuredClone(back[k]));
  else startEmpty(a);
  delete saved[key];
  useWalletSession.setState({ email: key });
}

/** Log out (Settings, or the demo bar): the wallet shows the welcome screen; the account's wallet waits for its next sign-in. */
export function signOutWallet() {
  if (!useWalletSession.getState().email) return;
  closeFlows();
  putAside();
  useAccount.getState().signOut();
  useWalletSession.setState({ email: null });
}
