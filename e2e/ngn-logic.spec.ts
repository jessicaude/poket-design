import { test, expect } from "@playwright/test";
import { formatNaira } from "@/lib/money";
import { checkId } from "@/lib/mock-api";
import { useNgn } from "@/features/wallet/ngn/useNgn";

/** NGN flow logic, without a browser: formatNaira, the mock API and useNgn. */
const ngn = () => useNgn.getState();
test.beforeEach(() => ngn().reset());

test("formatNaira: ₦ symbol, two decimals, thousands separators, NGN code; integer kobo only", () => {
  expect(formatNaira(2500000)).toBe("₦25,000.00 NGN");
  expect(formatNaira(0)).toBe("₦0.00 NGN");
  expect(formatNaira(5)).toBe("₦0.05 NGN");
  expect(formatNaira(123456789012)).toBe("₦1,234,567,890.12 NGN");
  expect(formatNaira(-10050)).toBe("-₦100.50 NGN");
  expect(() => formatNaira(10.5)).toThrow();
});

test("Tier 0 tops up through a temporary account for one exact amount", async () => {
  ngn().open();
  ngn().openBankTransfer();
  expect(ngn().stage).toBe("tempAmount");
  const created = ngn().createTemp(2500000);
  expect(ngn().stage).toBe("tempCreating");
  await created;
  const { temp } = ngn();
  expect(ngn().stage).toBe("temp");
  expect(temp?.num).toMatch(/^\d{10}$/);
  expect(temp?.amount).toBe(2500000);
  expect(temp!.expiresAt - Date.now()).toBeGreaterThan(29 * 60000);

  await ngn().transferArrives();
  expect(ngn().stage).toBe("tempDone");
  expect(ngn().ngnBalance).toBe(2500000);
});

test("an expired temporary account can be replaced; Back follows the reference", async () => {
  ngn().set({ tier: 1 });
  ngn().open();
  ngn().openBankTransfer();
  expect(ngn().stage).toBe("ngnChoice");
  ngn().go("tempAmount");
  await ngn().createTemp(10000);
  ngn().expireTemp();
  expect(ngn().stage).toBe("tempExpired");
  ngn().back();
  expect(ngn()).toMatchObject({ stage: "tempAmount", temp: null });
  ngn().back();
  expect(ngn().stage).toBe("ngnChoice");
  ngn().back();
  expect(ngn().stage).toBe("deposit-method");
  ngn().back();
  expect(ngn().stage).toBe(null);
});

test("three ID mismatches lock the step; attempts are shared", async () => {
  ngn().set({ tier: 1 });
  ngn().open();
  ngn().openBankTransfer();
  ngn().pickDedicated();
  expect(ngn().stage).toBe("ngnRoute");
  ngn().chooseRoute("bvn");
  for (const left of [2, 1]) {
    await ngn().checkIdNumber("00000000000");
    expect(ngn()).toMatchObject({ stage: "ngnId", mismatch: true, attempts: 3 - left });
  }
  await ngn().checkIdNumber("00000000000");
  expect(ngn()).toMatchObject({ stage: "ngnLocked", attempts: 3 });

  // Attempts already used up (e.g. by Veriff): choosing an ID goes straight to locked.
  ngn().set({ attempts: 3 });
  ngn().chooseRoute("nin");
  expect(ngn().stage).toBe("ngnLocked");
});

test("a matching ID leads to a dedicated account", async () => {
  ngn().set({ tier: 1 });
  ngn().open();
  ngn().openBankTransfer();
  ngn().pickDedicated();
  ngn().chooseRoute("nin");
  await ngn().checkIdNumber("22312345678");
  expect(ngn()).toMatchObject({ stage: "intro", ngnId: { route: "nin", last4: "5678" }, attempts: 0 });
  await ngn().createDedicated();
  expect(ngn().stage).toBe("details");
  expect(ngn().dedicated).toMatchObject({ status: "ready" });
  expect(ngn().dedicated?.num).toMatch(/^\d{10}$/);
});

test("no ID route for foreigners living abroad; mock API rejects bad numbers", async () => {
  ngn().set({ tier: 1, eligibility: "for_out" });
  ngn().open();
  ngn().openBankTransfer();
  ngn().pickDedicated();
  expect(ngn().stage).toBe("ngnUnavailable");
  await expect(checkId("bvn", "123")).rejects.toThrow();
  await expect(checkId("permit", "22312345678")).rejects.toThrow();
});
