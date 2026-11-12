import { test, expect, type Page } from "@playwright/test";

/**
 * The wallet's Settings (the reference's tSettings), Security (tSecurity) and Compliance (tAccountTier), and WGT-09's
 * Instant transfers: the switch, the daily limit with Change (up to ₦[tier max]; demo maximums ₦100,000 at Tier 0,
 * ₦1,000,000 at Tier 1), and the tier link. The demo user starts at Tier 0, instant transfers on, ₦50,000.00 a day.
 */

const body = (page: Page) => page.locator("#panelBody");
const title = (page: Page) => body(page).locator(".step-title").first();
async function openSettings(page: Page) {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.locator("#openSettingsHeader").click();
  await expect(title(page)).toHaveText("Settings");
}
const sub = (page: Page, id: string) => page.locator(`#${id} .settings-row-sub`);
const press = async (page: Page, keys: string) => { for (const k of keys) await page.locator(`[data-limitkey="${k}"]`).click(); };

test("the header gear opens Settings: name and email, then the reference's rows plus Instant transfers", async ({ page }) => {
  await openSettings(page);
  await expect(body(page).locator(".info-card .info-row")).toHaveText(["NameAda Osun", "Emailada@osun.co"]);
  await expect(body(page).locator(".settings-row-title")).toHaveText(["Compliance", "Instant transfers", "Payment methods", "Subscriptions", "Security", "Log out"]);
  await expect(sub(page, "openCompliance")).toHaveText("Tier 0: Registered · limits, verification level");
  await expect(sub(page, "openInstantTransfers")).toHaveText("On · ₦50,000.00 NGN a day");
  await expect(sub(page, "openSecurity")).toHaveText("Passcode delivery · 2 signed-in devices");
  await expect(sub(page, "settingsLogOut")).toHaveText("Log back in with a passcode");
  // The chevron is each row's last <svg> (.settings-row>svg:last-child)
  expect(await page.locator("#openSecurity > svg:last-child").count()).toBe(1);
  // Rows not ported say so
  await page.locator("#openSubscriptions").click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Not in the prototype yet");
  await page.locator("#backFromSettings").click();
  await expect(page.locator("#actSend")).toBeVisible();
});

test("Instant transfers: the switch, the daily limit, its tier maximum and the tier link; Off shows on Settings", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await expect(title(page)).toHaveText("Instant transfers");
  const sw = page.locator("#instantSwitch");
  await expect(sw).toHaveAttribute("role", "switch");
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(body(page).locator(".select-row .t1")).toHaveText("Instant transfers to banks");
  await expect(page.locator("#instantExplain")).toHaveText("Send naira to Nigerian bank accounts in seconds, up to your daily limit. When it's off, you can't send to banks.");
  await expect(page.locator("#instantLimit")).toHaveText("₦50,000.00 NGN");
  await expect(page.locator("#instantTierMax")).toHaveText("Up to ₦[tier max] at your tier");
  await expect(page.locator("#instantChange")).toBeEnabled();
  await expect(page.locator("#instantRaiseTier")).toHaveText("Raise your maximum: Tier 1: Basic");

  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#instantChange")).toBeDisabled();
  await page.locator("#backFromInstant").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("Off");
  await page.locator("#openInstantTransfers").click();
  await sw.click();
  await page.locator("#backFromInstant").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("On · ₦50,000.00 NGN a day");
});

test("Change the daily limit: up to the tier's maximum; saved back to the screen and Settings", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantChange").click();
  await expect(title(page)).toHaveText("Daily limit");
  await expect(body(page).locator(".step-sub")).toHaveText("Up to ₦[tier max] at your tier.");
  await expect(page.locator("#instantLimitAmt")).toHaveText("₦50,000.00 NGN");
  await press(page, "0"); // ₦500,000.00: over Tier 0's demo maximum (₦100,000)
  await expect(page.locator("#instantLimitAmt")).toHaveText("₦500,000.00 NGN");
  await expect(page.locator("#instantLimitErr")).toHaveText("More than your tier allows (₦[tier max]).");
  await expect(page.locator("#instantLimitSave")).toBeDisabled();
  for (let i = 0; i < 8; i++) await page.locator('[data-limitkey="back"]').click();
  await expect(page.locator("#instantLimitSave")).toBeDisabled(); // nothing typed
  await press(page, "7500000"); // ₦75,000.00
  await expect(page.locator("#instantLimitErr")).toHaveCount(0);
  await page.locator("#instantLimitSave").click();
  await expect(title(page)).toHaveText("Instant transfers");
  await expect(page.locator("#instantLimit")).toHaveText("₦75,000.00 NGN");
  await page.locator("#backFromInstant").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("On · ₦75,000.00 NGN a day");
});

test("the tier link opens Compliance; Increase my limits steps up (demo: the tier rises) and raises the maximum", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantRaiseTier").click();
  await expect(title(page)).toHaveText("Compliance");
  await expect(page.locator("#currentLevel")).toHaveText("Tier 0: Registered");
  await expect(body(page)).toContainText("No monetary activity until Tier 1");
  await page.locator("#startStepupFromAccount").click();
  await expect(title(page)).toHaveText("Additional verification needed");
  await expect(body(page).locator(".alert")).toHaveCount(0); // asked for, not over a limit
  await page.locator("#stepupIntroContinue").click();
  await expect(page.locator("#currentLevel")).toHaveText("Tier 1: Basic");
  await expect(body(page).locator(".info-card").nth(1)).toContainText("Tier 1: Basic limits");
  await page.locator("#backFromAccountTier").click();
  await expect(page.locator("#instantRaiseTier")).toHaveText("Raise your maximum: Tier 2: Standard");
  // Tier 1's maximum allows ₦500,000.00 now
  await page.locator("#instantChange").click();
  await press(page, "0");
  await expect(page.locator("#instantLimitErr")).toHaveCount(0);
  await expect(page.locator("#instantLimitSave")).toBeEnabled();
});

test("demo bar: Instant transfers default Off starts a new user with them off", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.getByLabel("Instant transfers default").selectOption("off");
  await page.locator("#openSettingsHeader").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("Off");
  await page.locator("#openInstantTransfers").click();
  await expect(page.locator("#instantSwitch")).toHaveAttribute("aria-checked", "false");
  await page.getByLabel("Instant transfers default").selectOption("on");
  await expect(page.locator("#instantSwitch")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#instantLimit")).toHaveText("₦50,000.00 NGN");
});

test("Security: passcode delivery (text needs a phone number) and signed-in devices", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openSecurity").click();
  await expect(title(page)).toHaveText("Security");
  await expect(body(page).locator(".section-title")).toHaveText(["Passcode delivery", "Signed-in devices"]);
  await expect(page.locator('[data-channel="email"]')).toHaveClass(/\bsel\b/);
  await expect(page.locator('[data-channel="email"] .t2')).toHaveText("ada@osun.co");
  await expect(page.locator('[data-channel="text"] .t2')).toHaveText("Add a phone number first");
  await expect(page.locator('[data-channel="text"]')).toHaveAttribute("aria-disabled", "true");
  await page.locator('[data-channel="text"]').click({ force: true });
  await expect(page.locator('[data-channel="text"]')).not.toHaveClass(/\bsel\b/); // no phone: can't choose it
  await expect(body(page).locator("[data-device] .settings-row-title")).toHaveText(["This device", "Chrome · MacBook Air"]);
  await expect(body(page).locator("[data-device] .settings-row-sub")).toHaveText(["Active now", "Last active 2w ago"]);
  await expect(body(page).locator("[data-signout]")).toHaveCount(1); // not this device
  await page.locator('[data-signout="d2"]').click();
  await expect(body(page).locator("[data-device]")).toHaveCount(1);
  await page.locator("#extBackSettings").click();
  await expect(sub(page, "openSecurity")).toHaveText("Passcode delivery · 1 signed-in device");
});
