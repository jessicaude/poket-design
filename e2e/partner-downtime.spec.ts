import { test, expect, type Page } from "@playwright/test";

/**
 * WGT-13, partner downtime. Demo bar "Naira partner: Up / Down". While down, a banner (the wallet's .alert warn) tops
 * the wallet home, the NGN balance screen and the naira screens that move naira by bank transfer (deposits, adding a
 * Nigerian bank, the amount and review of a send to one). When the partner is back, it goes.
 */

const COPY = "Naira bank transfers are paused. Your balance is safe, and sending to Poket users, converting and card payments still work.";
const banner = (page: Page) => page.locator("#panelBody #nairaPaused");
const partner = (page: Page, v: "up" | "down") => page.getByLabel("Naira partner").selectOption(v);
async function start(page: Page) {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
}
async function ngnBalance(page: Page) {
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"]').click();
  await expect(page.locator("#ngnBalanceAmount")).toBeVisible();
}
/** Send → a recipient → the amount screen. */
async function toAmount(page: Page, recipient: string) {
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="${recipient}"]`).click();
  await expect(page.locator("#youSend")).toBeVisible();
}

test("up: no banner anywhere", async ({ page }) => {
  await start(page);
  await expect(page.getByLabel("Naira partner")).toHaveValue("up");
  await expect(banner(page)).toHaveCount(0);
  await ngnBalance(page);
  await expect(banner(page)).toHaveCount(0);
});

test("down: the banner tops the home and the NGN balance screen, in the wallet's warning style; back up, it goes", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await expect(banner(page)).toHaveText(COPY);
  await expect(banner(page)).toHaveClass("alert warn");
  await expect(banner(page).locator("svg")).toHaveCount(1); // the alert icon
  // At the top: the first thing on the home screen
  expect(await page.locator("#panelBody .screen-fade").first().evaluate((el) => el.firstElementChild?.id)).toBe("nairaPaused");

  await ngnBalance(page);
  await expect(banner(page)).toHaveText(COPY);
  expect(await page.locator("#panelBody").evaluate((el) => el.querySelector(".screen-fade")?.firstElementChild?.id)).toBe("nairaPaused");

  // The partner comes back while the screen is open: the banner disappears
  await partner(page, "up");
  await expect(banner(page)).toHaveCount(0);
  await page.locator("#backFromDetail").click();
  await expect(banner(page)).toHaveCount(0);
});

test("down: naira deposits by bank transfer show it", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await ngnBalance(page);
  await page.locator("#detailDeposit").click();
  await expect(page.locator("#panelBody .step-title").first()).toHaveText("Deposit NGN");
  await expect(banner(page)).toHaveText(COPY);
});

test("down: a send to a Nigerian bank shows it on the amount and review; adding a Nigerian bank too", async ({ page }) => {
  await start(page);
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await partner(page, "down");
  await toAmount(page, "bank:lb2");
  await expect(banner(page)).toHaveText(COPY);
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await expect(page.locator("#confirmPayout")).toBeVisible();
  await expect(banner(page)).toHaveText(COPY);
  await page.locator("#backToPayoutAmount").click();
  await page.locator("#backToPayoutRecipient2").click();

  await page.locator("#newRecipient").click();
  await page.locator('[data-newkind="bank"]').click();
  await page.locator('[data-sendcur="NGN"]').click();
  await expect(page.locator("#panelBody .step-title").first()).toHaveText("Add a bank account");
  await expect(banner(page)).toHaveText(COPY);
});

test("down: what still works doesn't show it (a Poket user, a US bank, Convert)", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await toAmount(page, "poket:pu1");
  await expect(banner(page)).toHaveCount(0);
  await page.locator("#backToPayoutRecipient2").click();
  await page.locator('[data-sendrecipient="bank:lb1"]').click();
  await expect(page.locator("#youSend")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await page.locator("#backToPayoutRecipient2").click();
  await page.locator("#backFromSend").click();
  await page.locator("#actConvert").click();
  await expect(page.locator("#actConvert")).toHaveCount(0); // Convert is open
  await expect(banner(page)).toHaveCount(0);
});
