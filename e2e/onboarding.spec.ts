import { test, expect, type Page } from "@playwright/test";

/**
 * The wallet's onboarding: the welcome screen (reference/poket-unified.html: Sign Up, Log In); then Checkout's sign-up
 * screen (reference/poket-widgets.html SCREENS['signup'], shared with Checkout): email or phone, legal name, terms and
 * Continue, with the 6-digit code in place (Edit, Resend). A known email or phone logs in from the same screen. After
 * the code, a new account gets the location check (onboard-geo, onboard-geo-blocked) and the age check (onboard-age,
 * age-blocked), then starts at Tier 0 with empty balances on the wallet home. Logging in checks the location each time.
 * Accounts are shared with Checkout, both ways. Demo bar: "Session", "Location".
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const body = (page: Page) => page.locator("#panelBody");
const title = (page: Page) => body(page).locator(".step-title").first();
const heading = (page: Page) => body(page).locator("h2.title");
const events = (page: Page) => page.getByTestId("events");

async function signedOut(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__account?.getState().account);
  await page.getByLabel("Session").selectOption("out");
  await expect(title(page)).toHaveText("Welcome to Poket");
}
async function code(page: Page, digits: string) {
  await page.locator("#otp input").first().click();
  await page.keyboard.type(digits);
}
/** Sign up as `email` up to the code (from the welcome screen). */
async function signUpForm(page: Page, email: string, first = "Kemi", last = "Adeyemi") {
  await page.locator("#goSignup").click();
  await page.locator("#idInput").fill(email);
  await page.locator("#suFirst").fill(first);
  await page.locator("#suLast").fill(last);
  await page.locator("#suTerms").check();
  await page.locator("#suGo").click();
  await expect(page.locator("#otp")).toBeVisible();
}
/** Log in as `id` (an email) up to the code (from the welcome screen). */
async function logInForm(page: Page, email: string) {
  await page.locator("#goLogin").click();
  await page.locator("#idInput").fill(email);
  await expect(page.locator("#suGo")).toHaveText("Continue to log in");
  await page.locator("#suGo").click();
}
async function dob(page: Page, m: string, d: string, y: string) {
  await expect(title(page)).toHaveText("Confirm your age");
  await page.locator("#dobMonthInput").fill(m);
  await page.locator("#dobDayInput").fill(d);
  await page.locator("#dobYearInput").fill(y);
  await page.locator("#ageConfirmCheck").check();
  await page.locator("#ageContinue").click();
}
/** A full sign-up to the wallet home. */
async function signUp(page: Page, email: string, first = "Kemi", last = "Adeyemi") {
  await signUpForm(page, email, first, last);
  await code(page, "123456");
  await expect(title(page)).toHaveText("Checking your location");
  await dob(page, "04", "12", "1994");
  await expect(page.locator("#totalBalance")).toBeVisible();
}

test("signed out: the welcome screen, with no bell or settings and an empty tab bar", async ({ page }) => {
  await signedOut(page);
  await expect(body(page).locator(".welcome-hero svg")).toBeVisible();
  await expect(body(page).locator(".step-sub")).toHaveText("One account to hold, convert, and spend stablecoins.");
  await expect(body(page).locator(".welcome-feature-row")).toHaveText(["Hold and convert stablecoins", "Spend anywhere with a virtual card", "Send and receive instantly"]);
  await expect(page.locator("#goSignup")).toHaveText("Sign Up");
  await expect(page.locator("#goLogin")).toHaveText("Log In");
  await expect(page.locator("#panelActions")).toBeHidden();
  await expect(page.locator("#tabbar .tab-item")).toHaveCount(0);
  // No money moves while signed out: the demo bar's receive buttons are gone
  await expect(page.locator("#demoPoketTransfer")).toHaveCount(0);
});

test("sign up: one screen (email, legal name, terms with both links); the code in place; location; age; a Tier 0 account with empty balances on the home", async ({ page }) => {
  await signedOut(page);
  await page.locator("#goSignup").click();
  await expect(heading(page)).toHaveText("Verify your email");
  await expect(body(page).locator(".su .badge.info")).toBeVisible();
  const go = page.locator("#suGo");
  await expect(go).toHaveText("Continue");
  await expect(go).toBeDisabled();
  await expect(body(page).locator("#suTermsRow")).toHaveText("Accept Terms of Service and the Privacy Policy");
  await expect(body(page).getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "https://onepoket.com/terms-and-conditions");
  await expect(body(page).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "https://onepoket.com/privacy-policy");
  await page.locator("#idInput").fill("kemi.adeyemi@gmail.com");
  await expect(page.locator("#suKnown")).toBeHidden(); // a new email
  await page.locator("#suFirst").fill("Kemi");
  await page.locator("#suLast").fill("Adeyemi");
  await expect(go).toBeDisabled(); // the terms aren't accepted yet
  await page.locator("#suTerms").check();
  await go.click();

  // The code, in place: the email masked, Edit, Resend; a wrong code says so and clears
  await expect(heading(page)).toHaveText("Verify your email");
  await expect(body(page).locator(".id-val")).toHaveText("k••••i@gmail.com");
  await expect(body(page).locator(".lbl")).toHaveText("Enter the 6-digit code we sent you");
  await page.locator("#otpResend").click();
  await expect(page.locator("#toastEl")).toHaveText("New code sent to k••••i@gmail.com");
  await expect(page.locator("#otpResend")).toHaveText("Code sent");
  await expect(page.locator("#otpResend")).toBeDisabled();
  await code(page, "000000");
  await expect(page.locator("#otpStatus")).toHaveText("That code isn’t right. Check it and try again.");
  await expect(page.locator("#otp input").first()).toHaveValue("");
  // Edit goes back to the form, as it was
  await page.locator("#idEdit").click();
  await expect(page.locator("#idInput")).toHaveValue("kemi.adeyemi@gmail.com");
  await expect(page.locator("#suFirst")).toHaveValue("Kemi");
  await page.locator("#suGo").click();
  await code(page, "123456");

  // Location, then age
  await expect(title(page)).toHaveText("Checking your location");
  await expect(body(page).locator(".step-sub")).toHaveText("Poket confirms your location matches where account services are allowed.");
  await expect(title(page)).toHaveText("Confirm your age");
  await expect(body(page).locator(".step-sub")).toHaveText("You must be at least 18 to use Poket. Self-attested now, verified against your ID later.");
  // The reference's input rules: digits only, month up to 12
  await page.locator("#dobMonthInput").fill("13");
  await expect(page.locator("#dobMonthInput")).toHaveValue("12");
  await dob(page, "04", "12", "1994");

  // The wallet home: Tier 0, nothing in it
  await expect(page.locator("#totalBalance")).toHaveText("$0.00 USD");
  await expect(page.getByLabel("Tier")).toHaveValue("0");
  await expect(page.locator("#panelActions")).toBeVisible();
  await expect(page.locator("#tabHome")).toHaveClass(/\bon\b/);
  await expect(page.getByLabel("Session")).toHaveValue("kemi.adeyemi@gmail.com");
  await expect(page.getByLabel("Session").locator("option:checked")).toHaveText("Session: Signed in as Kemi");
  await expect(events(page).locator("li", { hasText: "user.account_created" })).toContainText('"widget":"wallet"');
  // No activity: not Ada's
  await page.locator("#tabActivity").click();
  await expect(body(page).locator("#activityHistory .tx-row")).toHaveCount(0);
  // Settings: their name and email, this device only
  await page.locator("#openSettingsHeader").click();
  await expect(body(page).locator(".info-card .info-row")).toHaveText(["NameKemi Adeyemi", "Emailkemi.adeyemi@gmail.com"]);
  await expect(page.locator("#openSecurity")).toContainText("1 signed-in device");
});

test("sign up with a phone: Use phone, the country code sheet, the code texted; the account has no email", async ({ page }) => {
  await signedOut(page);
  await page.locator("#goSignup").click();
  await page.locator("#idSwitch").click();
  await expect(heading(page)).toHaveText("Verify your phone number");
  await expect(body(page).locator('label[for="idInput"]')).toHaveText("Phone number");
  await expect(page.locator("#idInput")).toBeFocused();
  await expect(page.locator("#idSwitch")).toHaveText("Use email");
  await expect(page.locator("#idDialBtn")).toHaveText(/\+234/);
  // The country code sheet: the current code and the location's first; search by name or code
  await page.locator("#idDialBtn").click();
  const sheet = page.locator("#dialSheet");
  await expect(sheet.locator(".sheet-head b")).toHaveText("Country code");
  await expect(sheet.locator(".sheet-group").first()).toHaveText("Suggested");
  await expect(sheet.locator(".sheet-row.on").first()).toContainText("Nigeria");
  await page.locator("#dialSearch").fill("+44");
  await expect(sheet.locator(".sheet-row")).toHaveText(["🇬🇧United Kingdom+44"]);
  await page.locator("#dialSearch").fill("zzz");
  await expect(sheet.locator(".sheet-empty")).toHaveText("No country matches “zzz”.");
  await page.locator("#dialSearch").fill("ghana");
  await sheet.locator(".sheet-row").first().click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator("#idDialBtn")).toHaveText(/\+233/);
  // The number is formatted as it's typed; Ada's Nigerian number isn't known under Ghana's code
  await page.locator("#idInput").fill("8031234567");
  await expect(page.locator("#idInput")).toHaveValue("803 123 4567");
  await expect(page.locator("#suKnown")).toBeHidden();
  await page.locator("#suFirst").fill("Kofi");
  await page.locator("#suLast").fill("Mensah");
  await page.locator("#suTerms").check();
  await page.locator("#suGo").click();
  await expect(body(page).locator(".id-val")).toHaveText("+233 ••• ••• 4567");
  await expect(body(page).locator(".lbl")).toHaveText("Enter the 6-digit code we texted you");
  await page.locator("#otpResend").click();
  await expect(page.locator("#toastEl")).toHaveText("New code texted to +233 ••• ••• 4567");
  await code(page, "123456");
  await dob(page, "03", "03", "1990");
  await expect(page.locator("#totalBalance")).toHaveText("$0.00 USD");
  await expect(page.getByLabel("Session").locator("option:checked")).toHaveText("Session: Signed in as Kofi");
  // No email: the home shows the number; Settings has no email
  await expect(body(page).locator(".bh-sub .badge-pill")).toHaveText("+233 803 123 4567");
  await page.locator("#openSettingsHeader").click();
  await expect(body(page).locator(".info-card .info-row")).toHaveText(["NameKofi Mensah", "EmailNot added"]);
  // Logging back in by phone finds it
  await page.getByLabel("Session").selectOption("out");
  await page.locator("#goLogin").click();
  await page.locator("#idSwitch").click();
  await page.locator("#idDialBtn").click();
  await page.locator("#dialSearch").fill("GH");
  await page.locator("#dialSheet .sheet-row").first().click();
  await page.locator("#idInput").fill("803 123 4567");
  await expect(page.locator("#suKnownT")).toHaveText("This number already has a Poket account.");
  await page.locator("#suGo").click();
  await code(page, "123456");
  await expect(title(page)).toHaveText("Checking your location");
  await expect(page.getByLabel("Session").locator("option:checked")).toHaveText("Session: Signed in as Kofi");
});

test("location not supported: no account is made; Back to start", async ({ page }) => {
  await signedOut(page);
  await page.getByLabel("Location").selectOption("blocked");
  await signUpForm(page, "geo@example.com");
  await code(page, "123456");
  await expect(title(page)).toHaveText("Location Not Supported");
  await expect(body(page).locator(".step-sub")).toHaveText("Poket confirms your location before opening an account. We couldn’t verify that your current location is one where Poket is available, so we can’t create your account from here.");
  await page.locator("#onboardGeoBlockedClose").click();
  await expect(title(page)).toHaveText("Welcome to Poket");
  expect(await page.evaluate(() => (window as any).__account.getState().account)).toBeNull();
});

test("under 18: We can’t create this account; Back to start", async ({ page }) => {
  await signedOut(page);
  await signUpForm(page, "young@example.com");
  await code(page, "123456");
  const y = new Date().getFullYear() - 17;
  await dob(page, "01", "01", String(y));
  await expect(title(page)).toHaveText("We can’t create this account");
  await expect(body(page).locator(".step-sub")).toHaveText("Poket accounts require the account holder to be at least 18 years old. Based on the date of birth entered, this account can’t be created.");
  await page.locator("#ageBlockedClose").click();
  await expect(title(page)).toHaveText("Welcome to Poket");
  // The account wasn't made: the email is still new
  await page.locator("#goLogin").click();
  await page.locator("#idInput").fill("young@example.com");
  await expect(page.locator("#suKnown")).toBeHidden();
  await expect(page.locator("#suGo")).toHaveText("Continue");
});

test("a known email or phone, as it's typed: the note, no names or terms, Continue to log in; Log In opens the same screen", async ({ page }) => {
  await signedOut(page);
  await page.locator("#goLogin").click();
  await expect(heading(page)).toHaveText("Verify your email");
  await expect(page.locator("#suNames")).toBeVisible();
  await page.locator("#idInput").fill("ada@osun.co");
  await expect(page.locator("#suKnown")).toHaveText("This email already has a Poket account.We’ll send a code to log you in.");
  await expect(page.locator("#suNames")).toBeHidden();
  await expect(page.locator("#suTermsRow")).toBeHidden();
  await expect(page.locator("#suGo")).toHaveText("Continue to log in");
  await expect(page.locator("#suGo")).toBeEnabled();
  // Not known any more: the names and terms come back
  await page.locator("#idInput").fill("ada@osun.com");
  await expect(page.locator("#suKnown")).toBeHidden();
  await expect(page.locator("#suNames")).toBeVisible();
  await expect(page.locator("#suGo")).toHaveText("Continue");
  // Ada's phone number (Nigeria) is known too
  await page.locator("#idSwitch").click();
  await page.locator("#idInput").fill("8031234567");
  await expect(page.locator("#suKnownT")).toHaveText("This number already has a Poket account.");
  await page.locator("#suGo").click();
  await expect(body(page).locator(".id-val")).toHaveText("+234 ••• ••• 4567");
  // Use email from the code: back to the form, with the email
  await page.locator("#idSwitch").click();
  await expect(page.locator("#idInput")).toHaveValue("ada@osun.com");
  await page.locator("#idSwitch").click();
  await page.locator("#suGo").click();
  await code(page, "123456");
  await expect(title(page)).toHaveText("Checking your location");
  await expect(page.locator("#totalBalance")).toBeVisible();
  await expect(page.getByLabel("Session")).toHaveValue("ada@osun.co");
  // Logged in, not signed up
  await expect(events(page).locator("li", { hasText: "user.account_created" })).toHaveCount(0);
});

test("Log out and back in: each account keeps its own wallet; the demo bar signs Ada back in", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__account?.getState().account);
  const adaTotal = await page.locator("#totalBalance").textContent();
  // Ada logs out from Settings
  await page.locator("#openSettingsHeader").click();
  await page.locator("#settingsLogOut").click();
  await expect(title(page)).toHaveText("Welcome to Poket");
  await expect(page.getByLabel("Session")).toHaveValue("out");
  // A new account: empty; then logging out of it and in as Ada brings her wallet back
  await signUp(page, "new.user@example.com", "Ngozi", "Eze");
  await expect(page.locator("#totalBalance")).toHaveText("$0.00 USD");
  await page.getByLabel("Session").selectOption("ada@osun.co");
  await expect(page.locator("#totalBalance")).toHaveText(adaTotal!);
  await page.locator("#tabActivity").click();
  expect(await body(page).locator("#activityHistory .tx-row").count()).toBeGreaterThan(10);
  // Logging in to the new account again: its wallet, still empty
  await page.getByLabel("Session").selectOption("out");
  await logInForm(page, "new.user@example.com");
  await code(page, "123456");
  await expect(title(page)).toHaveText("Checking your location");
  await expect(page.locator("#totalBalance")).toHaveText("$0.00 USD");
  await expect(page.getByLabel("Session").locator("option:checked")).toHaveText("Session: Signed in as Ngozi");
});

test("log in: the location is checked each time; not supported, Poket isn’t available here", async ({ page }) => {
  await signedOut(page);
  await page.getByLabel("Location").selectOption("blocked");
  await logInForm(page, "ada@osun.co");
  await code(page, "123456");
  await expect(body(page).locator(".step-sub")).toHaveText("This only takes a moment.");
  await expect(title(page)).toHaveText("Poket isn’t available here");
  await page.locator("#loginGeoBlockedClose").click();
  await expect(heading(page)).toHaveText("Verify your email");
});

test("an account made in the wallet logs in at Checkout", async ({ page }) => {
  await signedOut(page);
  await signUp(page, "wallet.made@example.com", "Amara", "Okafor");
  // To Checkout by the demo bar's link (no reload): the same mock directory
  await page.locator("#demoToCheckout").click();
  await expect(page).toHaveURL(/\/demo\/ile-living$/);
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#idInput").fill("wallet.made@example.com");
  await expect(widget.locator(".known-note")).toContainText("This email already has a Poket account.");
  await widget.locator("#suGo").click();
  await widget.locator("#otp input").first().click();
  await page.keyboard.type("123456");
  await expect(widget.locator("#otp")).toHaveCount(0);
  // Logged in, not signed up again: no new account event from Checkout
  await expect(events(page).locator("li", { hasText: "user.account_created" })).toHaveCount(1);
});

test("an account made at Checkout logs in to the wallet", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#idInput").fill("checkout.made@example.com");
  await widget.locator("#suFirst").fill("Daniel");
  await widget.locator("#suLast").fill("Cho");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await widget.locator("#otp input").first().click();
  await page.keyboard.type("123456");
  await expect(widget.locator("#otp")).toHaveCount(0);
  await expect(events(page).locator("li", { hasText: "user.account_created" })).toContainText('"widget":"checkout"');
  await page.locator("#demoToWallet").click();
  await expect(page).toHaveURL(/\/demo\/wallet$/);
  await page.getByLabel("Session").selectOption("out");
  await logInForm(page, "checkout.made@example.com");
  await code(page, "123456");
  await expect(title(page)).toHaveText("Checking your location");
  await expect(page.locator("#totalBalance")).toHaveText("$0.00 USD");
  await expect(page.getByLabel("Session").locator("option:checked")).toHaveText("Session: Signed in as Daniel");
  await page.locator("#openSettingsHeader").click();
  await expect(body(page).locator(".info-card .info-row").first()).toHaveText("NameDaniel Cho");
});

test("sign-up codes count toward the account lock: the 5th wrong code locks; Close goes back to the start", async ({ page }) => {
  await signedOut(page);
  await signUpForm(page, "locked.out@example.com");
  for (let i = 0; i < 4; i++) {
    await code(page, "000000");
    await expect(page.locator("#otpStatus")).toHaveText("That code isn’t right. Check it and try again.");
  }
  await code(page, "000000");
  await expect(page.locator("#accountLocked .step-title").first()).toHaveText("Account locked");
  await expect(events(page).locator("li", { hasText: "account.locked" })).toContainText('"widget":"wallet"');
  await page.locator("#lockedClose").click();
  await expect(title(page)).toHaveText("Welcome to Poket");
  // Still locked: sign-up shows the lock again
  await page.locator("#goSignup").click();
  await expect(page.locator("#accountLocked .step-title").first()).toHaveText("Account locked");
});
