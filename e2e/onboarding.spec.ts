import { test, expect, type Page } from "@playwright/test";

/**
 * The wallet's onboarding (reference/poket-unified.html): the welcome screen (Sign Up, Log In); sign up with legal
 * name, email and terms (onboard-email), the 6-digit email code (onboard-phone-otp, Checkout's code entry), the
 * location check (onboard-geo, onboard-geo-blocked) and the age check (onboard-age, age-blocked). A new account starts
 * at Tier 0 with empty balances on the wallet home. Accounts are shared with Checkout, both ways. Demo bar: "Session".
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const body = (page: Page) => page.locator("#panelBody");
const title = (page: Page) => body(page).locator(".step-title").first();
const events = (page: Page) => page.getByTestId("events");

async function signedOut(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__account?.getState().account);
  await page.getByLabel("Session").selectOption("out");
  await expect(title(page)).toHaveText("Welcome to Poket");
}
async function code(page: Page, digits: string) {
  await page.locator("#phoneOtpRow input").first().click();
  await page.keyboard.type(digits);
}
/** Sign up as `email` up to the code screen. */
async function signUpForm(page: Page, email: string, first = "Kemi", last = "Adeyemi") {
  await page.locator("#goSignup").click();
  await page.locator("#signupEmailInput").fill(email);
  await page.locator("#signupFirst").fill(first);
  await page.locator("#signupLast").fill(last);
  await page.locator("#signupTermsCheck").check();
  await page.locator("#continueEmail").click();
  await expect(title(page)).toHaveText("Enter code");
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

test("sign up: name, email and terms (both links); the code; location; age; a Tier 0 account with empty balances on the home", async ({ page }) => {
  await signedOut(page);
  await page.locator("#goSignup").click();
  await expect(title(page)).toHaveText("Create account");
  const go = page.locator("#continueEmail");
  await expect(go).toHaveText("Sign Up");
  await expect(go).toBeDisabled();
  await expect(body(page).locator(".consent-row label")).toHaveText("Accept Terms of Service and the Privacy Policy");
  await expect(page.locator('.consent-link[data-doc="terms"]')).toHaveAttribute("href", "https://onepoket.com/terms-and-conditions");
  await expect(page.locator('.consent-link[data-doc="privacy"]')).toHaveAttribute("href", "https://onepoket.com/privacy-policy");
  await page.locator("#signupEmailInput").fill("kemi.adeyemi@gmail.com");
  await page.locator("#signupFirst").fill("Kemi");
  await page.locator("#signupLast").fill("Adeyemi");
  await expect(go).toBeDisabled(); // the terms aren't accepted yet
  await page.locator("#signupTermsCheck").check();
  await go.click();

  // The code: Checkout's code entry; a wrong code says so and clears
  await expect(title(page)).toHaveText("Enter code");
  await expect(page.locator("#codeSentTo")).toHaveText("Sent 6-digit code to ke***@gmail.com.");
  await expect(page.locator("#resendPhoneOtp")).toHaveText(/^Resend \(1[34]s\)$/);
  await code(page, "000000");
  await expect(page.locator("#phoneOtpStatus")).toHaveText("That code isn’t right. Check it and try again.");
  await expect(page.locator("#phoneOtpRow input").first()).toHaveValue("");
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
  // The account wasn't made: logging in with it asks to sign up
  await page.locator("#goLogin").click();
  await page.locator("#loginEmailInput").fill("young@example.com");
  await page.locator("#sendLoginCode").click();
  await code(page, "123456");
  await expect(page.locator("#signupNotice")).toHaveText("No Poket account uses this email yet. You’ve confirmed it, so just accept the terms to create your account.");
});

test("log in with an email that has no account: sign-up skips the code (it's confirmed)", async ({ page }) => {
  await signedOut(page);
  await page.locator("#goLogin").click();
  await expect(title(page)).toHaveText("Log in");
  await page.locator("#loginEmailInput").fill("tobi@lagos.ng");
  await page.locator("#sendLoginCode").click();
  await expect(page.locator("#codeSentTo")).toHaveText("Sent 6-digit code to to***@lagos.ng.");
  await code(page, "123456");
  await expect(title(page)).toHaveText("Create account");
  await expect(page.locator("#signupEmailInput")).toHaveValue("tobi@lagos.ng");
  await page.locator("#signupFirst").fill("Tobi");
  await page.locator("#signupLast").fill("Bello");
  await page.locator("#signupTermsCheck").check();
  await page.locator("#continueEmail").click();
  await expect(title(page)).toHaveText("Checking your location");
  await dob(page, "02", "02", "1990");
  await expect(page.locator("#totalBalance")).toHaveText("$0.00 USD");
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
  await page.locator("#goLogin").click();
  await page.locator("#loginEmailInput").fill("new.user@example.com");
  await page.locator("#sendLoginCode").click();
  await code(page, "123456");
  await expect(title(page)).toHaveText("Checking your location");
  await expect(page.locator("#totalBalance")).toHaveText("$0.00 USD");
  await expect(page.getByLabel("Session").locator("option:checked")).toHaveText("Session: Signed in as Ngozi");
});

test("log in: the location is checked each time; not supported, Poket isn’t available here", async ({ page }) => {
  await signedOut(page);
  await page.getByLabel("Location").selectOption("blocked");
  await page.locator("#goLogin").click();
  await page.locator("#loginEmailInput").fill("ada@osun.co");
  await page.locator("#sendLoginCode").click();
  await code(page, "123456");
  await expect(body(page).locator(".step-sub")).toHaveText("This only takes a moment.");
  await expect(title(page)).toHaveText("Poket isn’t available here");
  await page.locator("#loginGeoBlockedClose").click();
  await expect(title(page)).toHaveText("Log in");
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
  await page.locator("#goLogin").click();
  await page.locator("#loginEmailInput").fill("checkout.made@example.com");
  await page.locator("#sendLoginCode").click();
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
    await expect(page.locator("#phoneOtpStatus")).toHaveText("That code isn’t right. Check it and try again.");
  }
  await code(page, "000000");
  await expect(page.locator("#accountLocked .step-title").first()).toHaveText("Account locked");
  await expect(events(page).locator("li", { hasText: "account.locked" })).toContainText('"widget":"wallet"');
  await page.locator("#lockedClose").click();
  await expect(title(page)).toHaveText("Welcome to Poket");
});
