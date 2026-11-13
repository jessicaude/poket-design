import { test, expect } from "@playwright/test";
import { belowMinimum, cvBlockReason, cvBlockedPair, cvDefaultFrom, cvFeeLabel, cvFeeText, cvFixTo, cvParse, cvQuote, cvRateText, cvSourceFor, cvType, overNgnLimit } from "@/features/wallet/convert/convertMath";
import { evaluateLimit, useSpend } from "@/features/wallet/limits";
import { useHoldings } from "@/features/wallet/useHoldings";
import { useNgn } from "@/features/wallet/ngn/useNgn";

/** Convert’s pure helpers (convertMath.ts), against the reference’s rules. */
test.beforeEach(() => {
  useHoldings.getState().reset(); useNgn.getState().reset(); useSpend.getState().reset();
  // The reference’s demo balances: all USD card-funded (the wallet demo also holds $50.00 of open USD)
  useHoldings.getState().set({ cash: { USD: 1560, EUR: 0, GBP: 0, GHS: 0 } });
});

test("pair types and the FIAT-ONLY block", () => {
  const p = cvParse;
  expect(cvType(p("cash:USD:open"), p("cash:NGN:open"))).toBe("fx");
  expect(cvType(p("cash:NGN:open"), p("cash:NGN:open"))).toBeNull();
  expect(cvType(p("cash:NGN:open"), p("coin:USDC:Base"))).toBe("onramp");
  expect(cvType(p("coin:USDT:Polygon"), p("cash:USD:open"))).toBe("offramp");
  expect(cvType(p("coin:USDC:Base"), p("coin:USDT:Base"))).toBe("swap");
  expect(cvType(p("coin:USDC:Base"), p("coin:USDC:Polygon"))).toBe("bridge");
  expect(cvType(p("coin:USDC:Base"), p("coin:USDC:Base"))).toBeNull();
  expect(cvBlockedPair(p("cash:USD:fiat"), p("coin:USDC:Base"))).toBe(true);
  expect(cvBlockReason(p("cash:USD:fiat"), p("cash:NGN:open"))).toBe("Card-funded money can’t be converted to naira");
  expect(cvBlockedPair(p("cash:USD:fiat"), p("cash:EUR:open"))).toBe(false);
});

test("cvFixTo and cvDefaultFrom", () => {
  expect(cvFixTo("cash:NGN:open", "cash:NGN:open")).toBe("coin:USDC:Base");
  expect(cvFixTo("cash:USD:fiat", "coin:USDC:Base")).toBe(""); // card-funded: no target until the user picks one
  expect(cvFixTo("cash:USD:fiat", "cash:GBP:open")).toBe("cash:GBP:open"); // a valid choice stays
  expect(cvFixTo("cash:NGN:open", "coin:USDC:Base", true)).toBe("cash:USD:open"); // NGN to stablecoins blocked
  expect(cvFixTo("cash:NGN:open", "coin:USDT:Polygon", true)).toBe("cash:USD:open");
  expect(cvFixTo("cash:NGN:fiat", "coin:USDC:Base")).toBe(""); // any card-funded source
  expect(cvFixTo("coin:USDC:Base", "coin:USDC:Base")).toBe("cash:USD:open");
  expect(cvDefaultFrom()).toBe("cash:NGN:open"); // USD is all card-funded
  useHoldings.getState().set({ fiatOnly: { USD: 0, NGN: 0, EUR: 0, GBP: 0, GHS: 0 } });
  expect(cvDefaultFrom()).toBe("cash:USD:open");
});

test("quotes: fees by type, integer amounts", () => {
  // Naira conversions: fee undecided, so 0 in the maths and ₦[fee] (or the coin equivalent) on screen
  const n = cvQuote("cash:NGN:open", "coin:USDC:Base", 1000000, 1);
  expect(n).toMatchObject({ type: "onramp", fee: 0, receive: 645, usd: 645 });
  expect([cvFeeLabel(n), cvFeeText(n)]).toEqual(["Fee", "₦[fee]"]);
  const c = cvQuote("coin:USDC:Base", "cash:NGN:open", 1000, 1);
  expect([c.fee, c.receive, cvFeeText(c)]).toEqual([0, 1550000, "[fee] USDC"]);
  expect(cvFeeText(cvQuote("cash:USD:open", "cash:NGN:open", 1000, 1))).toBe("$[fee]");
  // Other pairs keep the reference’s fees
  const e = cvQuote("cash:USD:open", "cash:EUR:open", 1000, 1);
  expect([e.type, e.fee, cvFeeLabel(e), cvFeeText(e)]).toEqual(["fx", 10, "Exchange fee (1%)", "$0.10 USD"]);
  expect(cvQuote("coin:USDC:Base", "coin:USDT:Base", 10000, 1)).toMatchObject({ type: "swap", fee: 10, receive: 9990 });
  expect(cvQuote("coin:USDC:Base", "coin:USDC:Polygon", 10000, 1)).toMatchObject({ type: "bridge", fee: 10, receive: 9990 });
  expect(cvQuote("coin:USDC:Base", "coin:USDC:Polygon", 5, 1)).toMatchObject({ fee: 5, receive: 0 }); // fee never exceeds the amount
  expect(cvQuote("cash:NGN:open", "cash:NGN:open", 1000, 1)).toMatchObject({ type: null, fee: 0, receive: 0 });
});

test("rate text reads the readable way round", () => {
  const p = cvParse;
  expect(cvRateText(p("cash:USD:open"), p("cash:NGN:open"), 1, false)).toBe("1 USD ≈ 1,550.00 NGN");
  expect(cvRateText(p("cash:NGN:open"), p("cash:USD:open"), 1, false)).toBe("1 USD ≈ 1,550.00 NGN");
  expect(cvRateText(p("cash:NGN:open"), p("cash:USD:open"), 1, true)).toBe("1 NGN ≈ 0.0006452 USD");
  expect(cvRateText(p("cash:GBP:open"), p("cash:USD:open"), 1, false)).toBe("1 GBP ≈ 1.27 USD");
});

test("₦[limit] per conversion: the naira side, from or to NGN (demo value ₦40,000.00)", () => {
  expect(overNgnLimit(cvQuote("cash:NGN:open", "coin:USDC:Base", 4000000, 1))).toBe(false);
  expect(overNgnLimit(cvQuote("cash:NGN:open", "coin:USDC:Base", 4000001, 1))).toBe(true);
  expect(overNgnLimit(cvQuote("coin:USDC:Base", "cash:NGN:open", 2600, 1))).toBe(true); // receives ₦40,300.00
  expect(overNgnLimit(cvQuote("cash:USD:open", "cash:EUR:open", 999999999, 1))).toBe(false);
});

test("cvSourceFor: what can convert into NGN (not card-funded USD, not naira itself)", () => {
  expect(cvSourceFor("cash:NGN:open")).toBeNull();
  useHoldings.getState().set({ coins: { USDC: { Polygon: 0, Base: 500 }, USDT: { Polygon: 0, Base: 0 } } });
  expect(cvSourceFor("cash:NGN:open")).toBe("coin:USDC:Base");
  useHoldings.getState().set({ fiatOnly: { USD: 0, NGN: 0, EUR: 0, GBP: 0, GHS: 0 } });
  expect(cvSourceFor("cash:NGN:open")).toBe("cash:USD:open");
});

test("evaluateLimit: the reference’s tier limits (USD), including today’s spend", () => {
  expect(evaluateLimit(100, 0)).toEqual({ ok: false, needTier: 1 });
  expect(evaluateLimit(2000, 1)).toEqual({ ok: true });
  expect(evaluateLimit(2001, 1)).toEqual({ ok: false, needTier: 2 });
  expect(evaluateLimit(50001, 3)).toEqual({ ok: false, blocked: true, reason: "transaction" });
  useSpend.getState().record(4000);
  expect(evaluateLimit(1500, 1)).toEqual({ ok: false, needTier: 2 }); // over Tier 1's $5,000 a day
});

test("mock API refuses the blocked conversions", async () => {
  const { createConversion, setNgnToStablecoinsAllowed, resetConversionServer } = await import("@/lib/mock-api");
  resetConversionServer();
  const base = { amount: 100, fee: 0, receive: 1, rateText: "", feeLabel: "", feeText: "", paidText: "", receivedText: "" };
  await expect(createConversion({ ...base, from: "cash:USD:fiat", to: "cash:NGN:open" })).rejects.toThrow("fiat_only_to_ngn");
  await expect(createConversion({ ...base, from: "cash:USD:fiat", to: "coin:USDC:Base" })).rejects.toThrow("fiat_only_to_digital_asset");
  setNgnToStablecoinsAllowed(false);
  await expect(createConversion({ ...base, from: "cash:NGN:open", to: "coin:USDC:Base" })).rejects.toThrow("ngn_to_stablecoins_unavailable");
  await expect(createConversion({ ...base, from: "cash:NGN:open", to: "coin:USDT:Polygon" })).rejects.toThrow("ngn_to_stablecoins_unavailable");
  setNgnToStablecoinsAllowed(true);
  expect((await createConversion({ ...base, from: "cash:NGN:open", to: "cash:USD:open" })).ref).toMatch(/^TXN-\d{6}$/);
});

test("₦[minimum]: the naira side of a naira conversion (demo value ₦1,550.00); other pairs keep $1.00", async () => {
  expect(belowMinimum(cvQuote("cash:NGN:open", "coin:USDC:Base", 154999, 1))).toBe(true);
  expect(belowMinimum(cvQuote("cash:NGN:open", "coin:USDC:Base", 155000, 1))).toBe(false);
  expect(belowMinimum(cvQuote("coin:USDC:Base", "cash:NGN:open", 99, 1))).toBe(true); // receives ₦1,534.50
  expect(belowMinimum(cvQuote("cash:USD:open", "cash:EUR:open", 99, 1))).toBe(true);
  expect(belowMinimum(cvQuote("cash:USD:open", "cash:EUR:open", 100, 1))).toBe(false);
  expect(belowMinimum(cvQuote("cash:NGN:open", "coin:USDC:Base", 0, 1))).toBe(false); // nothing typed yet
});

test("fmtCurrency formats naira with formatNaira", async () => {
  const { fmtCurrency } = await import("@/features/wallet/payout/payoutMath");
  const { formatNaira } = await import("@/lib/money");
  for (const k of [0, 1, 155000, 123456789, -2500]) expect(fmtCurrency(k, "NGN")).toBe(formatNaira(k));
  expect(fmtCurrency(1560, "USD")).toBe("$15.60 USD");
});

test("Send sources: what can pay each kind of recipient", async () => {
  const { sourceAllowed, defaultSource } = await import("@/features/wallet/send/sources");
  const bank = (currency: "NGN" | "USD" | "GBP") => ({ kind: "bank" as const, id: "b", self: false, bank: { id: "x", isSelf: false, name: "X", currency, methodType: "bank" as const } });
  const wallet = { kind: "wallet" as const, id: "w", wallet: { id: "w", name: "W", address: "0x0", asset: "USDC" as const, network: "Base" as const } };
  // Card-funded money: not for naira or stablecoins; fine for other banks
  expect(sourceAllowed("cash:USD:fiat", bank("NGN"), false)).toBe(false);
  expect(sourceAllowed("cash:USD:fiat", wallet, false)).toBe(false);
  expect(sourceAllowed("cash:USD:fiat", bank("USD"), false)).toBe(true);
  expect(sourceAllowed("cash:USD:fiat", bank("GBP"), false)).toBe(true);
  // NGN: not for non-Nigerian banks
  expect(sourceAllowed("cash:NGN:open", bank("USD"), false)).toBe(false);
  expect(sourceAllowed("cash:NGN:open", bank("NGN"), false)).toBe(true);
  // Conversions follow Convert’s rules (and the demo block on naira to stablecoins)
  expect(sourceAllowed("coin:USDC:Base", bank("NGN"), false)).toBe(true);
  expect(sourceAllowed("cash:NGN:open", wallet, false)).toBe(true);
  expect(sourceAllowed("cash:NGN:open", wallet, true)).toBe(false);
  // Defaults: the recipient’s currency (open, then card-funded), or the balance it was opened from if allowed
  expect(defaultSource(bank("NGN"), null, false)).toBe("cash:NGN:open");
  expect(defaultSource(bank("USD"), null, false)).toBe("cash:USD:fiat");
  expect(defaultSource(bank("NGN"), "cash:USD:fiat", false)).toBe("cash:NGN:open");
  expect(defaultSource(bank("GBP"), null, false)).toBe("cash:GBP:open");
});
