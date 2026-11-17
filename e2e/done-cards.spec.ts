import { test, expect, type Page } from "./fixtures";
import { cvPress, press } from "./keypad";
import { passSelfie } from "./selfie";

/**
 * Every done card: the review's rows, then Confirmation or Reference, then the highlighted total, always the last row
 * and flush with the card's edges (left, right and bottom). Send (bank account, debit card, CentryLink user,
 * stablecoin wallet), Convert, card deposit, NGN top-up.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page, path = "/demo/wallet") {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
}
/** The total is the only highlighted row and the last one; the row before it is the reference; it meets the card's edges. */
async function totalLast(page: Page, card: string, before: "Confirmation" | "Reference") {
  const rows = page.locator(`#panelBody ${card} .receipt-row`);
  await expect(rows.last()).toHaveClass(/\btotal\b/);
  await expect(page.locator(`#panelBody ${card} .receipt-row.total`)).toHaveCount(1);
  const labels = await rows.locator(".r-label").allTextContents();
  expect(labels.at(-2)).toBe(before);
  // Flush: the card's 1px border on each side. Measured once the screen has settled (it animates in), so measured again
  // until it does; a card that never ends flush still fails.
  await expect.poll(async () => {
    const c = (await page.locator(`#panelBody ${card}`).boundingBox())!, t = (await rows.last().boundingBox())!;
    return Math.max(Math.abs(t.x - c.x), Math.abs(t.x + t.width - (c.x + c.width)), Math.abs(t.y + t.height - (c.y + c.height)));
  }).toBeLessThanOrEqual(1.5);
}
async function sendWithPin(page: Page, selfie = false) {
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  if (selfie) await passSelfie(page);
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
}

test("Send to a bank account: Confirmation, then Debited from balance last", async ({ page }) => {
  await wallet(page);
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  for (const d of "100000") await press(page, d);
  await sendWithPin(page);
  await totalLast(page, "#doneRows", "Confirmation");
  await expect(page.locator("#doneRows .receipt-row.total .r-label")).toHaveText("Debited from balance");
});

test("Send to a debit card: Confirmation, then Total charged last", async ({ page }) => {
  await wallet(page, "/demo/wallet?send=card");
  await page.locator("#cardNum").fill("4242424242424242");
  await page.locator("#cardName").fill("Kemi Adeyemi");
  await page.locator("#cardZip").fill("10001");
  await page.locator("#cardContinue").click();
  await page.locator("#payFromChip").click();
  await page.locator('[data-payfrom="cash:USD:open"]').click();
  for (const d of "2500") await press(page, d);
  await sendWithPin(page, true);
  await totalLast(page, "#doneRows", "Confirmation");
  await expect(page.locator("#doneRows .receipt-row.total .r-label")).toHaveText("Total charged");
});

test("Send to a CentryLink user: Confirmation, then Total charged last", async ({ page }) => {
  await wallet(page);
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="poket:pu1"]').click();
  for (const d of "100000") await press(page, d);
  await sendWithPin(page);
  await totalLast(page, "#doneRows", "Confirmation");
});

test("Send to a stablecoin wallet: Confirmation, then Total charged last", async ({ page }) => {
  await wallet(page);
  await page.evaluate(() => (window as any).__holdings.getState().set({ coins: { USDC: { Polygon: 0, Base: 2000 }, USDT: { Polygon: 0, Base: 0 } } }));
  await page.getByLabel("Tier").selectOption("2");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="wallet:sw1"]').click();
  for (const d of "500") await press(page, d);
  await sendWithPin(page);
  await totalLast(page, "#doneRows", "Confirmation");
});

test("Convert: Confirmation, then You get last", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("1");
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#detailConvert").click();
  for (const d of "1000000") await cvPress(page, d);
  await page.locator("#cvReview").click();
  await page.locator("#cvConfirm").click();
  await totalLast(page, "#cvDoneCard", "Confirmation");
});

test("card deposit: Reference, then Total charged last", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("3");
  await page.locator('[data-holdcur="USD"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#detailDeposit").click();
  await page.locator("#dmCard").click();
  await page.locator("#amountTapTarget").click();
  for (const k of "2500") await page.locator(`[data-key="${k}"]`).click();
  await page.locator("#cardFundAmtContinue").click();
  await page.locator('[data-cardpick="card1"]').click();
  await page.locator("#cardPickContinue").click();
  for (let i = 0; i < 6; i++) await page.locator("#threeDsRow .otp-box").nth(i).fill(String(i + 1));
  await page.locator("#verify3ds").click();
  await expect(page.locator("#cardFundDoneCard")).toBeVisible();
  await totalLast(page, "#cardFundDoneCard", "Reference");
});

test("NGN top-up: Reference, then You get last", async ({ page }) => {
  await wallet(page, "/demo/wallet?ngn=deposit-method");
  await page.locator("#dmBank").click();
  await page.locator("#ngnAmt").fill("25000");
  await page.locator("#ngnTempGo").click();
  await page.getByRole("button", { name: "Transfer arrives", exact: true }).click();
  await expect(page.locator("#ngnTempDoneCard")).toBeVisible();
  await totalLast(page, "#ngnTempDoneCard", "Reference");
  await expect(page.locator("#ngnTempDoneCard .r-label")).toHaveText(["Fee", "Reference", "You get"]);
  await expect(page.locator("#ngnTempDoneCard .receipt-row.total .r-value")).toHaveText("₦24,900.00 NGN");
});
