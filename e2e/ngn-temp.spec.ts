import { test, expect, type Page } from "@playwright/test";

/** Temporary account stages (tVaNgn in reference/poket-unified.html), in the wallet demo. */

async function openAtTier0(page: Page) {
  await page.clock.install();
  // No share sheet, so "Share details" copies and shows the notice, as on desktop browsers.
  await page.addInitScript(() => { Object.defineProperty(navigator, "share", { value: undefined }); });
  await page.goto("/demo/wallet?ngn=deposit-method");
  await page.locator("#dmBank").click();
}

async function createFor(page: Page, amount: string) {
  await page.locator("#ngnAmt").fill(amount);
  await page.locator("#ngnTempGo").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Creating your temporary account");
}

test("Tier 0: bank transfer > amount > temporary account > transfer arrives > done", async ({ page }) => {
  await openAtTier0(page);
  const body = page.locator("#panelBody");

  // tempAmount, straight from Bank transfer at Tier 0
  await expect(body.locator(".step-title")).toHaveText("Add naira");
  await expect(body).toContainText("Tier 0: up to ₦[limit] per top-up and ₦[limit] in total");
  const go = page.locator("#ngnTempGo");
  await expect(go).toBeDisabled();
  await page.locator("#ngnAmt").fill("99.99");
  await expect(go).toBeDisabled();
  await page.locator("#ngnAmt").fill("100");
  await expect(go).toBeEnabled();
  await page.locator("#ngnAmt").fill("25000");
  await page.locator("#ngnAmt").blur();
  await expect(page.locator("#ngnAmt")).toHaveValue("₦25,000.00");
  await go.click();
  await expect(body.locator(".step-title")).toHaveText("Creating your temporary account");
  await expect(body.locator(".spinner")).toBeVisible();

  // temp
  await expect(body.locator(".step-title")).toHaveText("Send exactly ₦25,000.00 NGN");
  await expect(body.locator(".step-title .cur-code")).toHaveText("NGN");
  await expect(page.locator("#ngnCount")).toHaveText("30:00");
  await page.clock.runFor(1000);
  await expect(page.locator("#ngnCount")).toHaveText("29:59");
  await expect(body.locator(".va-k")).toHaveText(["Amount to send", "Account number", "Bank", "Account name"]);
  await expect(body.locator(".va-v").nth(1)).toHaveText(/^\d{10}$/);
  await expect(body.locator(".va-v").nth(2)).toHaveText("[Partner bank]");
  await expect(body.locator(".va-v").nth(3)).toHaveText("Poket / Ada Osun");
  await expect(body.locator(".va-copy")).toHaveCount(3); // no copy button for Bank
  await body.locator(".va-copy").first().click();
  await expect(body.locator(".va-copy").first()).toHaveText("Copied");
  await page.clock.runFor(1600);
  await expect(body.locator(".va-copy").first()).toHaveText("Copy");
  await expect(body.locator(".va-note")).toHaveText("Use it once. A transfer for a different amount, or after it expires, is [handling].");
  await page.locator("#ngnTempShare").click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Details copied");
  await expect(page.locator("#toastEl .notice-body")).toHaveText("Paste them into your bank app.");

  // Demo: the transfer arrives
  await page.getByRole("button", { name: "Transfer arrives" }).click();
  await expect(body.locator(".step-title")).toHaveText("Transfer received");
  await expect(body.locator(".step-sub")).toHaveText("Adding ₦25,000.00 NGN to your balance.");
  await expect(body.locator(".step-title")).toHaveText("₦25,000.00 NGN added");
  await expect(body.locator(".step-sub")).toHaveText("It's in your NGN balance.");
  expect(await page.evaluate(() => (window as any).__ngn.getState().ngnBalance)).toBe(7500000); // eslint-disable-line @typescript-eslint/no-explicit-any
  await page.locator("#ngnDone").click();
  await expect(body.locator(".asset-item-row .tx-amt")).toHaveText("₦75,000.00 NGN"); // back on the wallet home
});

test("the temporary account expires after 30 minutes; 'Create a new one' keeps the amount", async ({ page }) => {
  await openAtTier0(page);
  await createFor(page, "5000");
  await expect(page.locator("#ngnCount")).toHaveText("30:00");
  await page.clock.fastForward("30:01");
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("This temporary account expired");
  await expect(body.locator(".step-sub")).toHaveText("Create a new one to add naira. Don't send to the old account number.");
  await page.locator("#ngnTempAgain").click();
  await expect(body.locator(".step-title")).toHaveText("Add naira");
  await expect(page.locator("#ngnAmt")).toHaveValue("₦5,000.00");
});

test("Back: temp > amount > Deposit NGN at Tier 0; Tier 1 gets the choice first", async ({ page }) => {
  await openAtTier0(page);
  await createFor(page, "1000");
  await expect(page.locator("#ngnCount")).toBeVisible();
  await page.locator("#vaBack").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Add naira");
  await page.locator("#vaBack").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Deposit NGN");

  await page.getByLabel("Tier").selectOption("1");
  await page.locator("#dmBank").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Bank transfer");
  await page.locator("#ngnPickTemp").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Add naira");
  await expect(page.locator("#panelBody")).toContainText("Up to ₦[limit] per top-up");
  await page.locator("#vaBack").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Bank transfer");
});
