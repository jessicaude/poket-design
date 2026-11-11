import type { PayoutRecipient, SendRecipient } from "@/lib/mock-api";
import { cashBuckets, type CashCurrency } from "../useHoldings";
import { cvAvail, cvBlockReason, cvOptions, cvParse, cvType, isNgnToStablecoin, type Side } from "../convert/convertMath";

/**
 * Which balances can pay a Send recipient (the amount screen's "You send" chip), and which one it starts on.
 * The chip never offers a balance that can't be used for the recipient:
 *   - merchant-held naira, for bank accounts (it can't be sent to a bank);
 *   - card-funded (FIAT-ONLY) money, for naira or stablecoins;
 *   - NGN, for non-Nigerian bank accounts;
 *   - anything but USD cash (open or card-funded), for debit cards.
 * A balance in another currency converts inline, so it must also be a conversion Convert allows (cvBlockReason,
 * and the "NGN to stablecoins" demo block).
 */

/** What the recipient receives: a bank's currency, USD on a debit card, a wallet's coin on its network; a Poket user takes the source's currency. */
export function recipientTarget(r: SendRecipient): string | null {
  if (r.kind === "bank") return `cash:${r.bank.currency}:open`;
  if (r.kind === "card") return "cash:USD:open";
  if (r.kind === "wallet") return `coin:${r.wallet.asset}:${r.wallet.network}`;
  return null;
}

export function sourceAllowed(source: string, r: SendRecipient, ngnCoinsBlocked: boolean): boolean {
  const f = cvParse(source);
  // A debit card: only USD can pay it (open or card-funded), never converted
  if (r.kind === "card") return f.k === "cash" && f.cur === "USD" && f.bucket !== "merchant";
  const isBank = r.kind === "bank";
  const ngnBank = isBank && r.bank.currency === "NGN";
  if (isBank && f.k === "cash" && f.bucket === "merchant") return false;
  if (f.k === "cash" && f.bucket === "fiat" && (ngnBank || r.kind === "wallet")) return false;
  if (isBank && !ngnBank && f.k === "cash" && f.cur === "NGN") return false;
  const target = recipientTarget(r);
  if (!target) return true; // a Poket user receives in the source's currency
  const t = cvParse(target);
  if (!cvType(f, t)) return true; // the same balance: no conversion
  if (cvBlockReason(f, t)) return false;
  if (ngnCoinsBlocked && isNgnToStablecoin(f, t)) return false;
  return true;
}

/** Same balance as the target, so no conversion (the same currency, or the same coin on the same network). */
export const sameAsTarget = (source: string, r: SendRecipient) => {
  const target = recipientTarget(r);
  return !target || !cvType(cvParse(source), cvParse(target));
};

/** The chip's list: balances you hold that can pay this recipient (and the recipient's own currency, even at 0). */
export function sendSources(r: SendRecipient, ngnCoinsBlocked: boolean): string[] {
  const keys = cvOptions(true, cashBuckets).map(keyOf);
  const target = recipientTarget(r);
  if (target && target.startsWith("cash:") && !keys.includes(target)) {
    const cur = target.split(":")[1] as CashCurrency;
    if (!cashBuckets(cur).some((b) => b.balance > 0)) keys.unshift(target);
  }
  return keys.filter((k) => sourceAllowed(k, r, ngnCoinsBlocked));
}

/**
 * The starting source: the balance it was opened from, if it can pay this recipient; else the recipient's currency
 * (its open part, then its FIAT-ONLY part); for a Poket user, the NGN balance; else the first balance that can.
 */
export function defaultSource(r: SendRecipient, from: string | null, ngnCoinsBlocked: boolean): string {
  const list = sendSources(r, ngnCoinsBlocked);
  if (from && list.includes(from)) return from;
  const target = recipientTarget(r);
  if (target?.startsWith("cash:")) {
    const cur = target.split(":")[1];
    const own = [`cash:${cur}:open`, `cash:${cur}:fiat`].filter((k) => list.includes(k));
    const withMoney = own.find((k) => cvAvail(cvParse(k)) > 0);
    if (withMoney || own[0]) return withMoney ?? own[0];
  }
  if (target && list.includes(target)) return target;
  if (!target && list.includes("cash:NGN:open")) return "cash:NGN:open"; // a Poket user: the naira balance first
  return list[0] ?? target ?? "cash:NGN:open";
}

const keyOf = (o: Side) => (o.k === "cash" ? `cash:${o.cur}:${o.bucket}` : `coin:${o.asset}:${o.net}`);

/** The send flow's recipient (bank, Poket user or wallet) as a Send recipient, for these rules. */
export function asSendRecipient(r: PayoutRecipient): SendRecipient {
  if (r.methodType === "poket") return { kind: "poket", id: `poket:${r.id}`, user: { id: r.id, name: r.name, handle: r.handle ?? "", initials: "" } };
  if (r.methodType === "card") return { kind: "card", id: `card:${r.id}`, self: r.isSelf, card: r };
  if (r.methodType === "wallet") return { kind: "wallet", id: `wallet:${r.id}`, wallet: { id: r.id, name: r.name, address: r.walletAddress ?? "", asset: r.asset ?? "USDC", network: r.network ?? "Base" } };
  return { kind: "bank", id: `bank:${r.id}`, self: r.isSelf, bank: r };
}

/** Send recipients carried through the send flow (whose recipient is a PayoutRecipient). */
export function toPayoutRecipient(r: SendRecipient): PayoutRecipient {
  if (r.kind === "bank") return r.bank;
  if (r.kind === "card") return r.card;
  if (r.kind === "poket") return { id: r.user.id, isSelf: false, name: r.user.name, currency: "NGN", methodType: "poket", handle: r.user.handle };
  return { id: r.wallet.id, isSelf: false, name: r.wallet.name, currency: "USD", methodType: "wallet", walletAddress: r.wallet.address, asset: r.wallet.asset, network: r.wallet.network };
}

/** What the recipient receives, given the paying balance (a Poket user takes the source's currency). */
export const targetKeyFor = (r: PayoutRecipient, payFrom: string) => recipientTarget(asSendRecipient(r)) ?? payFrom;
