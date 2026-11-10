import { test, expect } from "@playwright/test";
import { cvBlockedPair, cvDefaultFrom, cvFixTo, cvParse, cvQuote, cvRateText, cvType } from "@/features/wallet/convert/convertMath";
import { useHoldings } from "@/features/wallet/useHoldings";
import { useNgn } from "@/features/wallet/ngn/useNgn";

/** Convert's pure helpers (convertMath.ts), against the reference's rules. */
test.beforeEach(() => { useHoldings.getState().reset(); useNgn.getState().reset(); });

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
  expect(cvBlockedPair(p("cash:USD:fiat"), p("cash:NGN:open"))).toBe(false);
});

test("cvFixTo and cvDefaultFrom", () => {
  expect(cvFixTo("cash:NGN:open", "cash:NGN:open")).toBe("coin:USDC:Base");
  expect(cvFixTo("cash:USD:fiat", "coin:USDC:Base")).toBe("cash:NGN:open");
  expect(cvFixTo("cash:NGN:fiat", "coin:USDC:Base")).toBe("cash:USD:open");
  expect(cvFixTo("coin:USDC:Base", "coin:USDC:Base")).toBe("cash:USD:open");
  expect(cvDefaultFrom()).toBe("cash:NGN:open"); // USD is all card-funded
  useHoldings.getState().set({ fiatOnly: { USD: 0, NGN: 0, EUR: 0, GBP: 0, GHS: 0 } });
  expect(cvDefaultFrom()).toBe("cash:USD:open");
});

test("quotes: fees by type, integer amounts", () => {
  expect(cvQuote("cash:NGN:open", "coin:USDC:Base", 1000000, 1)).toMatchObject({ type: "onramp", fee: 5000, receive: 642, usd: 645 });
  expect(cvQuote("cash:USD:open", "cash:NGN:open", 1000, 1)).toMatchObject({ type: "fx", fee: 10, receive: 1534500 });
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
