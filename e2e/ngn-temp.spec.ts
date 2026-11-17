import { test, expect, type Page } from "./fixtures";
import { NGN_TOPUP, typeAmount } from "./keypad";

/** Single-use account stages (tVaNgn in reference/poket-unified.html), in the wallet demo. */

async function openAtTier0(page: Page) {
  await page.clock.install();
  // No share sheet, so "Share details" copies and shows the notice, as on desktop browsers.
  await page.addInitScript(() => { Object.defineProperty(navigator, "share", { value: undefined }); });
  await page.goto("/demo/wallet?ngn=deposit-method");
  await page.locator("#dmBank").click();
}

/** `amount` in kobo digits ("500000" is ₦5,000.00), on the NGN amount field's keypad. */
async function createFor(page: Page, amount: string) {
  await typeAmount(page, NGN_TOPUP, amount);
  await page.locator("#ngnTempGo").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Creating your single-use account");
}

test("Tier 0: bank transfer > amount > single-use account > transfer arrives > done", async ({ page }) => {
  await openAtTier0(page);
  const body = page.locator("#panelBody");

  // tempAmount, straight from Bank transfer at Tier 0
  await expect(body.locator(".step-title")).toHaveText("Add naira");
  await expect(body).toContainText("Tier 0: up to ₦[limit] per top-up and ₦[limit] in total");
  await expect(body).toContainText("We’ll create a single-use account for this amount.");
  const go = page.locator("#ngnTempGo");
  await expect(go).toHaveText("Create single-use account");
  await expect(go).toBeDisabled();
  // The wallet's amount field: the NGN chip, the amount, the keypad on tap (with Done); the limit line under it
  await expect(page.locator("#ngnAmtBox .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator("#ngnAmtBox .cv-pick svg")).toBeVisible();
  await expect(page.locator("#ngnAmt")).toHaveText("0.00");
  await expect(page.locator("#ngnAmt")).toHaveClass(/\bcv-amt\b/);
  await expect(page.locator("#ngnKeypad")).toHaveCount(0);
  await expect(page.locator("#ngnAmtLimit")).toHaveText("Tier 0: up to ₦[limit] per top-up and ₦[limit] in total");
  await expect(page.locator("#ngnTempFee")).toHaveCount(0);
  await typeAmount(page, NGN_TOPUP, "9999"); // ₦99.99: under the minimum
  await expect(page.locator("#ngnAmt")).toHaveText("99.99");
  await expect(go).toBeDisabled();
  await typeAmount(page, NGN_TOPUP, "10000", true);
  await expect(page.locator("#ngnAmt")).toHaveText("100.00");
  await expect(go).toBeEnabled();
  await typeAmount(page, NGN_TOPUP, "2500000", true);
  await expect(page.locator("#ngnAmt")).toHaveText("25,000.00");
  // While typing: the button docked directly above the keypad, at the bottom of the panel
  await expect(page.locator("#panelDock #ngnTempGo")).toBeVisible();
  await expect(page.locator("#panelDock #ngnKeypad")).toBeVisible();
  await expect(page.locator("#ngnTempFee .receipt-row")).toHaveText(["Fee₦100.00 NGN", "You get₦24,900.00 NGN"]);
  await page.locator("#ngnKeypadDone").click();
  await expect(page.locator("#ngnKeypad")).toHaveCount(0);
  // Closed: the box, the limit line, the Fee and You get card, the button right under it
  const y = async (sel: string) => (await page.locator(sel).boundingBox())!.y;
  expect(await y("#ngnAmtBox")).toBeLessThan(await y("#ngnAmtLimit"));
  expect(await y("#ngnAmtLimit")).toBeLessThan(await y("#ngnTempFee"));
  expect(await y("#ngnTempFee")).toBeLessThan(await y("#ngnTempGo"));
  await go.click();
  await expect(body.locator(".step-title")).toHaveText("Creating your single-use account");
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
  await expect(body.locator(".step-sub")).toHaveText("Adding ₦24,900.00 NGN to your balance.");
  await expect(body.locator(".step-title")).toHaveText("₦24,900.00 NGN added"); // less the ₦100.00 deposit fee
  await expect(body.locator(".step-sub")).toHaveText("It’s in your NGN balance.");
  expect(await page.evaluate(() => (window as any).__ngn.getState().ngnBalance)).toBe(7490000); // eslint-disable-line @typescript-eslint/no-explicit-any -- less the ₦100.00 deposit fee
  await page.locator("#ngnDone").click();
  await page.locator('[data-wallettab="cash"]').click(); // back on the wallet home; NGN is under Cash
  await expect(body.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-amt')).toHaveText("₦74,900.00 NGN");
});

test("the single-use account expires after 30 minutes; 'Create a new one' keeps the amount", async ({ page }) => {
  await openAtTier0(page);
  await createFor(page, "500000");
  await expect(page.locator("#ngnCount")).toHaveText("30:00");
  await page.clock.fastForward("30:01");
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("This single-use account expired");
  await expect(body.locator(".step-sub")).toHaveText("Create a new one to add naira. Don’t send to the old account number.");
  await page.locator("#ngnTempAgain").click();
  await expect(body.locator(".step-title")).toHaveText("Add naira");
  await expect(page.locator("#ngnAmt")).toHaveText("5,000.00");
});

test("Back: temp > amount > Deposit NGN at Tier 0; Tier 1 gets the choice first", async ({ page }) => {
  await openAtTier0(page);
  await createFor(page, "100000");
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
