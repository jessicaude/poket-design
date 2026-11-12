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
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#openSettingsHeader").click();
  await expect(title(page)).toHaveText("Settings");
}
const sub = (page: Page, id: string) => page.locator(`#${id} .settings-row-sub`);
/** The switch off: the confirmation sheet, then Turn off. */
async function turnOff(page: Page) {
  await page.locator("#instantSwitch").click();
  await page.locator("#instantOffConfirm").click();
}
/** The PIN screens, approving with the demo PIN (set by openSettings). */
async function enterPin(page: Page, pin = "1234") {
  await expect(page.locator("#panelBody .step-title")).toHaveText("Enter your PIN");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type(pin);
}
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

  await turnOff(page);
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#instantChange")).toBeDisabled();
  await page.locator("#backFromInstant").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("Off");
  await page.locator("#openInstantTransfers").click();
  await sw.click();
  await enterPin(page);
  await page.locator("#backFromInstant").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("On · ₦50,000.00 NGN a day");
});

/** The daily limit screen: open the keypad and type a new amount (kobo digits), then Done. */
async function typeLimit(page: Page, digits: string) {
  if (!(await page.locator("#limitKeypad").isVisible())) await page.locator("#instantLimitAmt").click();
  for (let i = 0; i < 9; i++) await page.locator('[data-limitkey="back"]').click(); // up to ₦9,999,999.99
  await press(page, digits);
  await page.locator("#limitKeypadDone").click();
}

test("the daily limit screen: the amount box with the keypad on demand, capped at ₦[tier max]", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantChange").click();
  await expect(title(page)).toHaveText("Daily limit");
  await expect(page.locator("#instantLimitBox .cv-box-top")).toHaveText("Daily limitUp to ₦[tier max] at your tier");
  await expect(page.locator("#instantLimitAmt")).toHaveText("50,000.00");
  await expect(page.locator("#limitKeypad")).toHaveCount(0); // hidden until the amount is tapped
  await expect(page.locator("#instantLimitSave")).toBeDisabled(); // unchanged
  await page.locator("#instantLimitAmt").click();
  await expect(page.locator("#limitKeypad")).toBeVisible();
  await press(page, "0"); // ₦500,000.00: over Tier 0's demo maximum (₦100,000)
  await expect(page.locator("#instantLimitAmt")).toHaveText("500,000.00");
  await expect(page.locator("#instantLimitErr")).toHaveText("More than your tier allows (₦[tier max]).");
  await expect(page.locator("#instantLimitSave")).toBeDisabled();
  await page.locator("#limitKeypadDone").click();
  await expect(page.locator("#limitKeypad")).toHaveCount(0);
  await page.locator("#instantLimitAmt").click();
  await title(page).click(); // a tap elsewhere hides it too
  await expect(page.locator("#limitKeypad")).toHaveCount(0);
});

test("lowering the limit applies at once, after the PIN", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantChange").click();
  await typeLimit(page, "2000000"); // ₦20,000.00
  await expect(page.locator("#instantLimitWhen")).toHaveText("A lower limit applies at once.");
  await page.locator("#instantLimitSave").click();
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Lowers your daily limit.");
  await enterPin(page);
  await expect(title(page)).toHaveText("Instant transfers");
  await expect(page.locator("#instantLimit")).toHaveText("₦20,000.00 NGN");
  await expect(page.locator("#instantPending")).toHaveCount(0);
  await page.locator("#backFromInstant").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("On · ₦20,000.00 NGN a day");
});

test("raising the limit needs the PIN, then waits out [cooling-off]: pending, Cancel change, and the demo's Skip cooling-off", async ({ page }) => {
  test.setTimeout(60_000); // two raises, each typed on the keypad and approved with the PIN
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await expect(page.locator("#demoSkipCoolingOff")).toHaveCount(0); // nothing pending
  await page.locator("#instantChange").click();
  await typeLimit(page, "7500000"); // ₦75,000.00
  await expect(page.locator("#instantLimitWhen")).toHaveText("A higher limit starts in [cooling-off].");
  await page.locator("#instantLimitSave").click();
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Raises your daily limit.");
  // Back from the PIN: nothing changes
  await page.locator("#pinApproveCancel").click();
  await expect(title(page)).toHaveText("Daily limit");
  await expect(page.locator("#instantLimitAmt")).toHaveText("75,000.00"); // the typed amount is kept
  await page.locator("#instantLimitSave").click();
  await enterPin(page);
  await expect(page.locator("#toastEl")).toHaveText("Your new limit starts in [cooling-off]");
  await expect(title(page)).toHaveText("Instant transfers");
  // The current limit stays until then; the pending one shows under it
  await expect(page.locator("#instantLimit")).toHaveText("₦50,000.00 NGN");
  await expect(page.locator("#instantPendingAmt")).toHaveText("₦75,000.00 NGN");
  await expect(page.locator("#instantPendingWhen")).toHaveText("Starts in [cooling-off]");
  await page.locator("#instantCancelChange").click();
  await expect(page.locator("#instantPending")).toHaveCount(0);
  await expect(page.locator("#instantLimit")).toHaveText("₦50,000.00 NGN");

  // Again, then the demo bar skips the cooling-off: it applies now
  await page.locator("#instantChange").click();
  await typeLimit(page, "9000000"); // ₦90,000.00
  await page.locator("#instantLimitSave").click();
  await enterPin(page);
  await expect(page.locator("#instantPendingAmt")).toHaveText("₦90,000.00 NGN");
  await page.locator("#demoSkipCoolingOff").click();
  await expect(page.locator("#instantPending")).toHaveCount(0);
  await expect(page.locator("#instantLimit")).toHaveText("₦90,000.00 NGN");
  await expect(page.locator("#demoSkipCoolingOff")).toHaveCount(0);
  await page.locator("#backFromInstant").click();
  await expect(sub(page, "openInstantTransfers")).toHaveText("On · ₦90,000.00 NGN a day");
});

test("lowering while a raise is pending replaces it", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantChange").click();
  await typeLimit(page, "8000000");
  await page.locator("#instantLimitSave").click();
  await enterPin(page);
  await expect(page.locator("#instantPendingAmt")).toHaveText("₦80,000.00 NGN");
  await page.locator("#instantChange").click();
  await typeLimit(page, "3000000"); // ₦30,000.00: lower than the current ₦50,000
  await page.locator("#instantLimitSave").click();
  await enterPin(page);
  await expect(page.locator("#instantLimit")).toHaveText("₦30,000.00 NGN");
  await expect(page.locator("#instantPending")).toHaveCount(0);
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
  await page.locator("#instantLimitAmt").click();
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

test("turning off asks to confirm (a sheet), then takes effect at once; Keep them on or a tap outside cancels", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  const sw = page.locator("#instantSwitch");
  await sw.click();
  const sheet = page.locator("#instantOffSheet");
  await expect(sheet.locator(".step-title")).toHaveText("Turn off instant transfers?");
  await expect(sheet.locator(".step-sub")).toHaveText("Sends to Nigerian banks won't go until you turn them back on.");
  await expect(sheet.locator("button")).toHaveText(["Turn off", "Keep them on"]);
  await expect(sw).toHaveAttribute("aria-checked", "true"); // nothing changes until confirmed
  await page.locator("#instantOffCancel").click();
  await expect(sheet).toHaveCount(0);
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await sheet.click({ position: { x: 20, y: 20 } }); // the dimmed panel above the sheet
  await expect(sheet).toHaveCount(0);
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await turnOff(page);
  await expect(sheet).toHaveCount(0);
  await expect(sw).toHaveAttribute("aria-checked", "false"); // no PIN to turn off
});

test("turning on asks for the PIN, then says so; a wrong PIN or Back leaves them off", async ({ page }) => {
  await openSettings(page);
  await page.locator("#openInstantTransfers").click();
  await turnOff(page);
  const sw = page.locator("#instantSwitch");
  await sw.click();
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Turns on instant transfers.");
  await page.locator("#pinApproveCancel").click();
  await expect(title(page)).toHaveText("Instant transfers");
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await enterPin(page, "0000");
  await expect(page.locator("#panelBody .step-sub").first()).toContainText("Incorrect PIN. 2 attempts left.");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#toastEl")).toHaveText("Instant transfers are on.");
  await expect(title(page)).toHaveText("Instant transfers");
  await expect(sw).toHaveAttribute("aria-checked", "true");
});

test("turning on with no PIN yet creates one first", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.getByLabel("Instant transfers default").selectOption("off");
  await page.locator("#openSettingsHeader").click();
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantSwitch").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Create your PIN");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("4321");
  await expect(page.locator("#panelBody .step-title")).toHaveText("Confirm your PIN");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("4321");
  await expect(page.locator("#instantSwitch")).toHaveAttribute("aria-checked", "true");
});

/** Instant transfers off (demo default), then Send to a recipient with an amount. */
async function offThenSend(page: Page, recipient: string, digits = "500000") {
  await page.goto("/demo/wallet");
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.getByLabel("Instant transfers default").selectOption("off");
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="${recipient}"]`).click();
  await page.locator("#youSend").click();
  for (const d of digits) await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
}

test("while off, sending naira to a Nigerian bank says so with Turn on, and Review is disabled; Turn on resumes the send", async ({ page }) => {
  await offThenSend(page, "bank:r6");
  await expect(page.locator("#instantOffNotice")).toHaveText("Instant transfers are off. Turn on");
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await page.evaluate(() => (window as any).__payout.getState().toReview()); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(page.locator("#confirmPayout")).toHaveCount(0); // the store refuses too
  await page.locator("#instantTurnOn").click();
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Turns on instant transfers.");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  // Back on the amount screen with the same send
  await expect(page.locator("#sendToTitle")).toHaveText("Send to Ngozi");
  await expect(page.locator("#youSend")).toHaveText("5,000.00");
  await expect(page.locator("#instantOffNotice")).toHaveCount(0);
  await expect(page.locator("#payoutReview")).toBeEnabled();
  await page.locator("#payoutReview").click();
  await expect(page.locator("#confirmPayout")).toBeVisible();
});

test("while off, naira to a Nigerian bank is blocked whatever pays it (USD converted too); Back from the PIN keeps the send", async ({ page }) => {
  await offThenSend(page, "bank:r6", "");
  await page.locator("#payFromChip").click();
  await page.locator('[data-payfrom="cash:USD:open"]').click();
  await page.locator("#youSend").click();
  for (const d of "1000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await expect(page.locator("#instantOffNotice")).toBeVisible();
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await page.locator("#instantTurnOn").click();
  await page.locator("#pinApproveCancel").click();
  await expect(page.locator("#youSend")).toHaveText("10.00"); // the send is as it was
  await expect(page.locator("#instantOffNotice")).toBeVisible();
});

for (const [recipient, label] of [["poket:pu1", "a Poket user"], ["bank:r4", "a US bank"]] as const) {
  test(`while off, ${label} is unaffected`, async ({ page }) => {
    await offThenSend(page, recipient, recipient === "bank:r4" ? "" : "500000");
    if (recipient === "bank:r4") {
      await page.locator("#payFromChip").click();
      await page.locator('[data-payfrom="cash:USD:open"]').click();
      await page.locator("#youSend").click();
      for (const d of "1000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
    }
    await expect(page.locator("#instantOffNotice")).toHaveCount(0);
    await expect(page.locator("#payoutReview")).toBeEnabled();
  });
}

test("while off, Convert is unaffected", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.getByLabel("Instant transfers default").selectOption("off");
  await page.evaluate(() => (window as any).__convert.getState().start({ from: "cash:NGN:open", to: "cash:USD:open" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const d of "500000") await page.locator(`#panelBody [data-cvkey="${d}"]`).click();
  await expect(page.locator("#cvReview")).toBeEnabled();
  await expect(page.locator("#panelBody")).not.toContainText("Instant transfers are off");
});
