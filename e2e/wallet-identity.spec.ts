import { test, expect, type Page } from "./fixtures";

/**
 * The wallet's identity verification (Tier 0 to Tier 1), from the step-up: "Verify your identity" (reference/
 * poket-widgets.html tKycDetails, the screen Checkout shares: features/auth/IdentityDetailsForm.tsx), the ID check's
 * handoff (demo bar: Open on phone, Finish on phone), "Checking your ID", then "Identity verified". Under 18 by the date
 * of birth given: tAgeBlocked; an ID that shows under 18: tDocAgeBlocked. Demo bar: "ID check".
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const body = (page: Page) => page.locator("#panelBody");
const title = (page: Page) => body(page).locator(".step-title").first();
const heading = (page: Page) => body(page).locator("h2.title");
const events = (page: Page) => page.getByTestId("events");

/** A new account (signed up in the wallet, so the names come from sign-up), on Compliance's step-up. */
async function newAccountToStepUp(page: Page, { email = "kemi.adeyemi@gmail.com", first = "Kemi", last = "Adeyemi", outcome = "pass" } = {}) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__account?.getState().account);
  await page.getByLabel("ID check").selectOption(outcome);
  await page.getByLabel("Session").selectOption("out");
  await page.locator("#goSignup").click();
  await page.locator("#idInput").fill(email);
  await page.locator("#suFirst").fill(first);
  await page.locator("#suLast").fill(last);
  await page.locator("#suTerms").check();
  await page.locator("#suGo").click();
  await page.locator("#otp input").first().click();
  await page.keyboard.type("123456");
  await expect(page.locator("#totalBalance")).toBeVisible();
  await page.locator("#openSettingsHeader").click();
  await page.locator("#openCompliance").click();
  await page.locator("#startStepupFromAccount").click();
  await page.locator("#stepupIntroContinue").click();
  await expect(heading(page)).toHaveText("Verify your identity");
}
async function dob(page: Page, d: string, m: string, y: string) {
  await page.locator("#dD").fill(d);
  await page.locator("#dM").selectOption(m);
  await page.locator("#dY").fill(y);
}

test("Verify your identity: the steps, country, the name from sign-up, the date of birth; the ID check; Identity verified at Tier 1", async ({ page }) => {
  await newAccountToStepUp(page);
  // Your details / ID verification, in Checkout's look
  await expect(body(page).locator(".su .steps.two [role=listitem]")).toHaveText(["Your details", "ID verification"]);
  await expect(body(page).locator('.su .steps [aria-current="step"]')).toHaveText("Your details");
  await expect(body(page).locator(".su .sub").first()).toHaveText("Enter your name and date of birth exactly as they appear on your government-issued ID.");
  await expect(page.locator("#dCountry")).toHaveValue("Nigeria");
  await expect(page.locator("#dFirst")).toHaveValue("Kemi");
  await expect(page.locator("#dLast")).toHaveValue("Adeyemi");
  await expect(page.locator("#dSsn")).toHaveCount(0);
  await expect(page.locator("#dGo")).toHaveText("Continue to ID verification");
  await expect(page.locator("#dGo")).toBeDisabled();
  await expect(page.locator("#dLater")).toHaveText("Finish later");
  // DD, the Month picker (in full, the chosen one short), YYYY (no later than this year)
  await page.locator("#dY").fill("2999");
  await expect(page.locator("#dY")).toHaveValue(String(new Date().getFullYear()));
  await dob(page, "12", "3", "1990");
  await expect(page.locator("#dM option:checked")).toHaveText("Mar");
  await expect(page.locator('#dM option[value="1"]')).toHaveText("January");
  await page.locator("#dGo").click();

  // The ID check: Veriff's handoff, under ID verification; Back keeps the details
  await expect(body(page).locator('.su .steps [aria-current="step"]')).toHaveText("ID verification");
  await expect(body(page).locator(".vendor .vlogo img")).toHaveAttribute("alt", "Veriff");
  await expect(body(page).locator(".vendor .vt")).toHaveText("Let’s get you verified");
  await page.locator("#idVendorBack").click();
  await expect(page.locator("#dY")).toHaveValue("1990");
  await page.locator("#dGo").click();
  await page.locator("#demoIdOpen").click();
  await expect(body(page).locator(".vendor .vt")).toHaveText("Continue on your phone");
  await page.locator("#demoIdFinish").click();
  await expect(title(page)).toHaveText("Checking your ID");

  // Identity verified: Tier 1, shared with Checkout
  await expect(title(page)).toHaveText("Identity verified");
  await expect(body(page).locator(".step-sub")).toHaveText("Document, liveness, and age checks passed. You’ve unlocked Tier 1: Basic.");
  await expect(events(page).locator("li", { hasText: "user.verified" })).toContainText('"widget":"wallet"');
  expect(await page.evaluate(() => (window as any).__account.getState().account.tier)).toBe(1);
  await page.locator("#continueVerified").click();
  await expect(page.locator("#currentLevel")).toHaveText("Tier 1: Basic");
  await expect(page.getByLabel("Tier")).toHaveValue("1");
});

test("United States: the SSN (masked, Show, checked) and Continue to selfie check, Plaid; I don’t have an SSN, Veriff", async ({ page }) => {
  await newAccountToStepUp(page);
  await page.locator("#dCountry").selectOption("United States");
  await dob(page, "12", "3", "1990");
  const ssn = page.locator("#dSsn");
  await expect(ssn).toHaveAttribute("type", "password");
  await expect(page.locator("#dGo")).toHaveText("Continue to selfie check");
  await ssn.fill("123006789");
  await expect(page.locator("#dSsnErr")).toHaveText("Check your SSN. This number isn’t valid.");
  await expect(page.locator("#dGo")).toBeDisabled();
  await ssn.fill("123456789");
  await expect(ssn).toHaveValue("123-45-6789");
  await expect(page.locator("#dSsnErr")).toHaveCount(0);
  await page.locator("#dSsnShow").click();
  await expect(ssn).toHaveAttribute("type", "text");
  await expect(page.locator("#dSsnShow")).toHaveText("Hide");
  await page.locator("#dNoSsn").click();
  await expect(page.locator("#dSsn")).toHaveCount(0);
  await expect(page.locator("#dGo")).toHaveText("Continue to ID verification");
  await page.locator("#dNoSsn").click();
  await expect(page.locator("#dNoSsn")).toHaveText("I don’t have an SSN");
  await page.locator("#dGo").click();
  await expect(body(page).locator(".vendor .vlogo")).toHaveClass(/\bplaid\b/);
  await expect(body(page).locator(".vendor .vt")).toHaveText("Let’s confirm it’s you");
});

test("Finish later: back where the step-up started, still Tier 0", async ({ page }) => {
  await newAccountToStepUp(page);
  await page.locator("#dLater").click();
  await expect(title(page)).toHaveText("Compliance");
  await expect(page.locator("#currentLevel")).toHaveText("Tier 0: Registered");
  // Starting again starts over
  await page.locator("#startStepupFromAccount").click();
  await page.locator("#stepupIntroContinue").click();
  await expect(page.locator("#dD")).toHaveValue("");
});

test("under 18 by the date of birth: We can’t create this account, signed out; the block stays on the account", async ({ page }) => {
  await newAccountToStepUp(page, { email: "young@example.com" });
  await dob(page, "1", "1", String(new Date().getFullYear() - 17));
  await page.locator("#dGo").click();
  await expect(title(page)).toHaveText("We can’t create this account");
  await expect(body(page).locator(".step-sub")).toHaveText("Poket accounts require the account holder to be at least 18 years old. Based on the date of birth entered, this account can’t be created.");
  await expect(page.locator("#tabbar .tab-item")).toHaveCount(0);
  await expect(events(page).locator("li", { hasText: "user.blocked" })).toContainText('"reason":"age"');
  await page.locator("#ageBlockedClose").click();
  await expect(title(page)).toHaveText("Welcome to Poket");
  // Logging back in shows the block again
  await page.locator("#goLogin").click();
  await page.locator("#idInput").fill("young@example.com");
  await page.locator("#suGo").click();
  await page.locator("#otp input").first().click();
  await page.keyboard.type("123456");
  await expect(title(page)).toHaveText("We can’t create this account");
});

test("demo ID check Under 18 at date of birth: blocked even with an adult date", async ({ page }) => {
  await newAccountToStepUp(page, { outcome: "under18" });
  await dob(page, "12", "3", "1990");
  await page.locator("#dGo").click();
  await expect(title(page)).toHaveText("We can’t create this account");
});

test("the ID shows under 18 (demo, or a last name with “minor”): We can’t verify this account, after the ID check", async ({ page }) => {
  await newAccountToStepUp(page, { outcome: "docUnder18" });
  await expect(page.getByLabel("ID check").locator("option")).toHaveText(["ID check: Passes", "ID check: Under 18 at date of birth", "ID check: ID shows under 18"]);
  await dob(page, "12", "3", "1990");
  await page.locator("#dGo").click();
  await page.locator("#demoIdOpen").click();
  await page.locator("#demoIdFinish").click();
  await expect(title(page)).toHaveText("We can’t verify this account");
  await expect(body(page).locator(".step-sub")).toHaveText("The date of birth on your government ID doesn’t meet Poket’s minimum age requirement. Self-attestation isn’t relied on once a document is verified, so this account has been blocked and flagged for compliance review. No funds can be added.");
  await expect(events(page).locator("li", { hasText: "user.blocked" })).toContainText('"reason":"doc_age"');
  await page.locator("#docAgeBlockedClose").click();
  await expect(title(page)).toHaveText("Welcome to Poket");

  // The name trigger, with the ID check passing
  await newAccountToStepUp(page, { email: "minor@example.com", first: "Tobi", last: "Minor" });
  await dob(page, "12", "3", "1990");
  await page.locator("#dGo").click();
  await page.locator("#demoIdOpen").click();
  await page.locator("#demoIdFinish").click();
  await expect(title(page)).toHaveText("We can’t verify this account");
});
