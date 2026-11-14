import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { cvPress } from "./keypad";

/**
 * One template for every cash balance (history filter, day groups, Statement; on hold only when something is; the
 * account card where account details exist); Convert's keypad on demand; the network badge on top in Convert's
 * review; done screens repeat their review's rows.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
const openCash = async (page: Page, cur: string, bucket = "open") => {
  await page.locator(`[data-holdcur="${cur}"][data-holdbucket="${bucket}"] .tx-title`).click();
  await expect(page.locator("#balanceAmount")).toBeVisible();
};

test("every cash balance has the same screen: actions, history, Statement; account card and on hold where they apply", async ({ page }) => {
  await wallet(page);
  // Something on hold in naira: a first payment to Ngozi Eze (scheduled)
  await page.evaluate(() => (window as any).__ngn.getState().set({ ngnReserved: 500000 }));
  const cases: [string, string, boolean, boolean][] = [
    // currency, bucket, account card, on hold
    ["NGN", "open", true, true], ["USD", "open", true, false], ["USD", "fiat", true, false], ["EUR", "open", true, false], ["GBP", "open", true, false], ["GHS", "open", true, false],
  ];
  for (const [cur, bucket, card, hold] of cases) {
    await openCash(page, cur, bucket);
    await expect(page.locator(".action-row .action-btn"), cur).toHaveText(["Deposit", "Send", "Convert"]);
    await expect(page.locator("#balanceStatement"), cur).toHaveText("Statement");
    await expect(page.locator("#balanceHistory"), cur).toBeVisible(); // its history, or "No activity yet."
    await expect(page.locator("#vaOpen"), cur).toHaveCount(card ? 1 : 0);
    await expect(page.locator("#balanceOnHold"), cur).toHaveCount(hold ? 1 : 0);
    await page.locator("#backFromDetail").click();
  }
  // Open USD has history: the filter and day groups, as NGN
  await openCash(page, "USD");
  await expect(page.locator("#balanceHistory [data-histfilter]")).toHaveText(["All", "Money in", "Money out"]);
  await expect(page.locator("#balanceHistory [data-histday]").first()).toBeVisible();
});

test("a USD statement adds up from the demo's start", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("1");
  // ₦10,000.00 to USD: $5.14 into open USD
  await openCash(page, "NGN");
  await page.locator("#detailConvert").click();
  await page.locator("#cvPickTo").click();
  await page.locator('[data-cvopt="cash:USD:open"]').click();
  for (const d of "1000000") await cvPress(page, d);
  await page.locator("#cvReview").click();
  await page.locator("#cvConfirm").click();
  await page.locator("#cvDone").click();
  await page.locator("#tabHome").click();
  await openCash(page, "USD");
  await page.locator("#balanceStatement").click();
  await expect(page.locator("#backFromStatement")).toContainText("US Dollar");
  await page.locator('[data-format="csv"]').click();
  const [d] = await Promise.all([page.waitForEvent("download"), page.locator("#downloadStatement").click()]);
  expect(d.suggestedFilename()).toMatch(/^usd-statement-\d{4}-\d{2}-01-to-\d{4}-\d{2}-\d{2}\.csv$/);
  const rows = readFileSync((await d.path())!).toString("utf8").trim().split("\r\n").map((l) => l.split(","));
  expect(rows[1].slice(1, 6)).toEqual(["Opening balance", "", "", "", "USD"]);
  const tx = rows.slice(2, -1);
  expect(tx.map((r) => [r[1], r[5]])).toEqual([["Converted NGN to USD", "USD"]]);
  const got = Math.round(Number(tx[0][4]) * 100);
  expect(got).toBeGreaterThanOrEqual(510); // about $5.14: an FX quote moves a little
  expect(got).toBeLessThanOrEqual(518);
  const usd = await page.evaluate(() => (window as any).__holdings.getState().cash.USD as number);
  expect(Math.round(Number(rows.at(-1)![6]) * 100)).toBe(usd);
  expect(Math.round(Number(rows[1][6]) * 100) + got).toBe(usd); // opening + the conversion = closing
});

test("Convert's keypad: hidden until the amount is tapped; Done and a tap outside hide it", async ({ page }) => {
  await wallet(page);
  await page.locator("#actConvert").click();
  await expect(page.locator("#cvKeypad")).toHaveCount(0);
  await page.locator("#cvFromAmt").click();
  await expect(page.locator("#cvKeypad")).toBeVisible();
  await page.locator('#cvKeypad [data-cvkey="5"]').click();
  await expect(page.locator("#cvFromAmt")).toHaveText("0.05");
  await page.locator("#cvKeypadDone").click();
  await expect(page.locator("#cvKeypad")).toHaveCount(0);
  await page.locator("#cvFromAmt").click();
  await expect(page.locator("#cvKeypad")).toBeVisible();
  await page.locator("#panelBody .step-title").click(); // outside
  await expect(page.locator("#cvKeypad")).toHaveCount(0);
});

test("Convert: the network badge sits on the coin; done repeats the review's rows, then the confirmation", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("1");
  await openCash(page, "NGN");
  await page.locator("#detailConvert").click(); // to USDC on Base
  for (const d of "1000000") await cvPress(page, d);
  await page.locator("#cvReview").click();
  // On top: the badge's centre is the network badge, not the coin under it
  const onTop = await page.locator("#panelBody .convert-visual .badge-network").evaluate((el) => {
    const r = el.getBoundingClientRect(), root = el.getRootNode() as ShadowRoot;
    const hit = root.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  expect(onTop).toBe(true);
  const review = await page.locator("#cvQuoteCard .r-label").allTextContents();
  expect(review).toEqual(["You convert", "Rate", "Fee", "Network", "You get"]);
  await page.locator("#cvConfirm").click();
  await expect(page.locator("#cvDoneCard .r-label")).toHaveText([...review, "Confirmation"]);
  await expect(page.locator("#cvDoneCard .receipt-row").filter({ hasText: "You get" }).locator(".r-value")).toHaveText("5.14 USDC");
  await expect(page.locator("#cvDoneCard .receipt-row").filter({ hasText: "Network" }).locator(".r-value")).toHaveText("Base · ~15 sec");
  await expect(page.locator("#cvDoneCard .r-value").last()).toHaveText(/^TXN-\d{6}$/);
});

test("a dispute's done screen repeats its review's rows", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  await page.locator('[data-txid="t2"]').click();
  await page.locator("#extRaiseDispute").click();
  await page.locator("#disputeStart").click();
  await page.getByRole("radio", { name: "Not received" }).click();
  await page.locator("#extDisputeDescription").fill("It never came.");
  await page.locator("#extReviewDispute").click();
  const review = await page.locator("#disputeReview .info-row").allTextContents();
  await page.locator("#extSubmitDispute").click();
  await expect(page.locator("#disputeDone .step-title")).toHaveText("Dispute submitted");
  await expect(page.locator("#disputeDoneRows .info-row")).toHaveText(review);
});
