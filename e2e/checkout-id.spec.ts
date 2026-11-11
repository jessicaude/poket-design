import { test, expect, type Page } from "@playwright/test";

/**
 * Checkout identity verification (Tier 1), ported from SCREENS['details'], ['vendor'], ['verifying'], ['id-done'] and
 * ['blocked'] in reference/poket-widgets.html, with the demo bar's ID check outcomes. Orders of $500 or more only.
 */

async function enterCode(page: Page, code = "123456") {
  const boxes = page.locator("#otp input");
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill(code[i]);
}

/** A new user, an order over $500 ($621.40), signed up and on "Verify your identity". */
async function toDetails(page: Page, outcome = "pass") {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order", { exact: true }).selectOption("large");
  await page.getByLabel("ID check").selectOption(outcome);
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page);
  await expect(widget.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  return widget;
}
async function dob(page: Page, d: string, m: string, y: string) {
  await page.locator("#dD").fill(d);
  await page.locator("#dM").selectOption(m);
  await page.locator("#dY").fill(y);
}
/** Details, then the vendor handoff through the DEMO pill: Open on phone, Finish on phone. */
async function verify(page: Page) {
  await dob(page, "12", "3", "1990");
  await page.locator("#dGo").click();
  await expect(page.locator("#demoBtn")).toHaveText("Open on phone");
  await page.locator("#demoBtn").click();
  await expect(page.locator("#demoBtn")).toHaveText("Finish on phone");
  await page.locator("#demoBtn").click();
}
const events = (page: Page) => page.getByTestId("events");

test("$500 or more: Account, Identity, Payment; details, Veriff handoff, verified (Tier 1), then pay", async ({ page }) => {
  const widget = await toDetails(page);
  await expect(page.locator(".summary .line.total")).toContainText("$621.40");
  await expect(widget.locator(".steps")).not.toHaveClass(/\btwo\b/);
  await expect(widget.locator(".steps [role=listitem]")).toHaveText(["Account", "Identity", "Payment"]);
  await expect(widget.locator('.steps [aria-current="step"]')).toHaveText("Identity");

  // Details: country from the location check, prefilled legal name, date of birth
  await expect(widget.locator("#dCountry")).toHaveValue("Nigeria");
  await expect(widget.locator("#dFirst")).toHaveValue("Kemi");
  await expect(widget.locator("#dLast")).toHaveValue("Adeyemi");
  await expect(widget.locator("#dSsn")).toHaveCount(0);
  await expect(widget.locator("#dGo")).toHaveText("Continue to ID check");
  await expect(widget.locator("#dGo")).toBeDisabled();
  await page.locator("#dD").fill("12");
  await page.locator("#dM").selectOption("3");
  await expect(widget.locator("#dGo")).toBeDisabled(); // year missing
  await page.locator("#dY").fill("1990");
  await expect(widget.locator("#dGo")).toBeEnabled();
  await widget.locator("#dFirst").fill("");
  await expect(widget.locator("#dGo")).toBeDisabled();
  await widget.locator("#dFirst").fill("Kemi");
  await widget.locator("#dGo").click();

  // Vendor: Veriff, then the phone handoff
  await expect(widget.locator(".vendor .vlogo img")).toHaveAttribute("alt", "Veriff");
  await expect(widget.locator(".vendor .vt")).toHaveText("Let's get you verified");
  await expect(widget.locator(".vendor .prep")).toHaveText("Prepare a valid documentMake sure it's not expired or damaged.");
  await expect(widget.locator(".vendor .opt")).toContainText("Scan the QR codeUse your phone's camera app.");
  await expect(widget.locator(".vendor svg.qr")).toBeVisible();
  await expect(page.locator("#demo")).toHaveClass(/\bon\b/);
  await page.locator("#demoBtn").click();
  await expect(widget.locator(".vendor .vt")).toHaveText("Continue on your phone");
  await expect(widget.locator(".vendor .wait")).toHaveText("Take a photo of your ID and a short selfie on your phone. Keep this window open.");
  await page.locator("#demoBtn").click();
  await expect(widget.getByRole("heading", { name: "Checking your ID" })).toBeVisible();
  await expect(page.locator("#demo")).not.toHaveClass(/\bon\b/);

  // Verified: Tier 1, then back to paying (no saved methods yet: add one)
  await expect(widget.getByRole("heading", { name: "You're verified" })).toBeVisible();
  await expect(events(page).locator("li", { hasText: "user.verified" })).toContainText('"tier":1');
  await widget.locator("#idGo").click();
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible();
  await expect(widget.locator('.steps [aria-current="step"]')).toHaveText("Payment");
  await widget.getByRole("button", { name: /^Card/ }).click();
  await widget.locator("#cNum").fill("4242424242424242");
  await widget.locator("#cExp").fill("122029");
  await widget.locator("#cCvc").fill("123");
  await widget.locator("#cZip").fill("10001");
  await widget.locator("#cGo").click();
  await expect(widget.locator("#payGo")).toHaveText("Pay $621.40");
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid $621.40 to Ilé Living" })).toBeVisible();
  await expect(events(page).locator("li", { hasText: "payment.succeeded" })).toContainText('"identity_verified":true');
});

test("under $500: two steps and no ID check", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await expect(widget.locator(".steps")).toHaveClass(/\btwo\b/);
  await expect(widget.locator(".steps [role=listitem]")).toHaveText(["Account", "Payment"]);
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page);
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible();
});

test("a verified (Tier 1) customer pays $500 or more without the ID check", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order", { exact: true }).selectOption("large");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  await expect(page.getByTestId("checkout-widget").locator("#payGo")).toHaveText("Pay $621.40");
});

test("United States: SSN (masked, Show / Hide, checked), then Plaid's selfie; without an SSN, Veriff", async ({ page }) => {
  const widget = await toDetails(page);
  await widget.locator("#dCountry").selectOption("United States");
  await expect(widget.locator("#dGo")).toHaveText("Continue to selfie check");
  await dob(page, "12", "3", "1990");
  const ssn = widget.locator("#dSsn");
  await expect(ssn).toHaveAttribute("type", "password");
  await ssn.fill("000123456");
  await expect(ssn).toHaveValue("000-12-3456");
  await expect(widget.locator("#dGo")).toBeDisabled(); // 000 isn't a valid SSN
  await ssn.fill("123456789");
  await expect(ssn).toHaveValue("123-45-6789");
  await expect(widget.locator("#dGo")).toBeEnabled();
  await widget.locator("#dSsnShow").click();
  await expect(ssn).toHaveAttribute("type", "text");
  await expect(widget.locator("#dSsnShow")).toHaveText("Hide");

  await widget.locator("#dNoSsn").click();
  await expect(widget.locator("#dNoSsn")).toHaveText("Use my SSN instead");
  await expect(widget.locator("#dSsn")).toHaveCount(0);
  await expect(widget.locator("#dGo")).toHaveText("Continue to ID check");
  await widget.locator("#dNoSsn").click();
  await expect(widget.locator("#dNoSsn")).toHaveText("I don't have an SSN");

  await widget.locator("#dGo").click();
  await expect(widget.locator(".vendor .vlogo")).toHaveClass(/\bplaid\b/);
  await expect(widget.locator(".vendor .vt")).toHaveText("Let's confirm it's you");
  await expect(widget.locator(".vendor .prep")).toHaveText("Take a quick selfieWe'll match it to the details you entered.");
  await page.locator("#demoBtn").click();
  await expect(widget.locator(".vendor .wait")).toHaveText("Take a short selfie video on your phone. Keep this window open.");
});

test("under 18 by date of birth: blocked, nothing charged; Back closes", async ({ page }) => {
  const widget = await toDetails(page);
  await dob(page, "12", "3", String(new Date().getFullYear() - 17));
  await widget.locator("#dGo").click();
  await expect(widget.getByRole("heading", { name: "You must be 18 or older" })).toBeVisible();
  await expect(widget.locator(".sub")).toHaveText("Poket accounts are for people aged 18 and over. You haven’t been charged.");
  await expect(widget.locator(".steps")).toHaveCount(0);
  await expect(events(page).locator("li", { hasText: "user.blocked" })).toContainText('"reason":"age"');
  await widget.locator("#blkBack").click();
  await expect(widget).toHaveCount(0);
  await expect(events(page)).toContainText('"reason":"blocked"');
});

test("demo outcome Under 18 at date of birth: blocked even with an adult date", async ({ page }) => {
  const widget = await toDetails(page, "under18");
  await dob(page, "12", "3", "1990");
  await widget.locator("#dGo").click();
  await expect(widget.getByRole("heading", { name: "You must be 18 or older" })).toBeVisible();
});

test("ID check: declined", async ({ page }) => {
  const widget = await toDetails(page, "declined");
  await verify(page);
  await expect(widget.getByRole("heading", { name: "We couldn’t verify your identity" })).toBeVisible();
  await expect(widget.locator(".sub")).toHaveText("If you think this is a mistake, contact Poket support. You haven’t been charged.");
  await expect(widget.locator("#blkBack")).toHaveText("Back to Ilé Living");
  await expect(events(page).locator("li", { hasText: "user.blocked" })).toContainText('"reason":"id_declined"');
  await expect(events(page)).not.toContainText("user.verified");
});

test("sanctions match: blocked with the sanctions copy", async ({ page }) => {
  const widget = await toDetails(page, "sanctions");
  await verify(page);
  await expect(widget.getByRole("heading", { name: "We couldn't verify this account" })).toBeVisible();
  await expect(widget.locator(".sub")).toHaveText("Poket wasn't able to complete verification for this account. Please contact support for more information. You haven’t been charged.");
  await expect(events(page).locator("li", { hasText: "user.blocked" })).toContainText('"reason":"sanctions"');
});

test("manual review: wait or finish later; approving the review verifies", async ({ page }) => {
  const widget = await toDetails(page, "review");
  await verify(page);
  await expect(widget.getByRole("heading", { name: "Your ID needs a closer look" })).toBeVisible();
  await expect(widget.locator(".center .sub")).toHaveText("A specialist is reviewing it. This usually takes up to 24 hours. We'll email k••••i@gmail.com as soon as it's done.");
  await expect(widget.locator("#idReviewCart")).toHaveText("Your Ilé Living cart is saved. The email links back to it.");
  await expect(page.locator("#demoBtn")).toHaveText("Approve review");
  await page.locator("#demoBtn").click();
  await expect(widget.getByRole("heading", { name: "You're verified" })).toBeVisible();
  await expect(events(page).locator("li", { hasText: "user.verified" })).toContainText('"tier":1');
});

test("manual review: Finish later closes the widget", async ({ page }) => {
  const widget = await toDetails(page, "review");
  await verify(page);
  await widget.locator("#idReviewLater").click();
  await expect(widget).toHaveCount(0);
  await expect(events(page)).toContainText('"reason":"id_review"');
});

test("needs retry: a reason and tries left each time; the third failure is a decline", async ({ page }) => {
  const widget = await toDetails(page, "retry");
  await verify(page);
  await expect(widget.getByRole("heading", { name: "We couldn't read your ID" })).toBeVisible();
  await expect(widget.locator("#idRetryReason")).toHaveText("The photo is blurry. Retake it in good light.");
  await expect(widget.locator("#idRetryLeft")).toHaveText("2 tries left");
  await widget.locator("#idTryAgain").click();
  await expect(widget.locator(".vendor .vt")).toHaveText("Let's get you verified");
  await page.locator("#demoBtn").click();
  await page.locator("#demoBtn").click();
  await expect(widget.locator("#idRetryReason")).toHaveText("There was glare on your ID. Avoid direct light.");
  await expect(widget.locator("#idRetryLeft")).toHaveText("1 try left");
  await widget.locator("#idTryAgain").click();
  await page.locator("#demoBtn").click();
  await page.locator("#demoBtn").click();
  await expect(widget.getByRole("heading", { name: "We couldn’t verify your identity" })).toBeVisible();
});

test("needs retry, then the next attempt passes", async ({ page }) => {
  const widget = await toDetails(page, "retry");
  await verify(page);
  await expect(widget.locator("#idRetryLeft")).toHaveText("2 tries left");
  await page.getByLabel("ID check").selectOption("pass");
  await widget.locator("#idTryAgain").click();
  await page.locator("#demoBtn").click();
  await page.locator("#demoBtn").click();
  await expect(widget.getByRole("heading", { name: "You're verified" })).toBeVisible();
});

test("Finish later on the details screen closes the widget", async ({ page }) => {
  const widget = await toDetails(page);
  await widget.locator("#dLater").click();
  await expect(widget).toHaveCount(0);
  await expect(events(page)).toContainText('"reason":"canceled"');
});

/** The same person checks out again on this page: their email is now a Poket account, so they log in. */
async function checkoutAgain(page: Page) {
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await expect(widget.getByText("This email already has a Poket account.")).toBeVisible();
  await widget.getByRole("button", { name: "Continue to log in" }).click();
  await enterCode(page);
  return widget;
}
async function addCardAndPay(page: Page, total: string) {
  const widget = page.getByTestId("checkout-widget");
  await widget.getByRole("button", { name: /^Card/ }).first().click();
  await widget.locator("#cNum").fill("4242424242424242");
  await widget.locator("#cExp").fill("122029");
  await widget.locator("#cCvc").fill("123");
  await widget.locator("#cZip").fill("10001");
  await widget.locator("#cGo").click();
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: `Paid ${total} to Ilé Living` })).toBeVisible();
}

test("verified once, never asked again: a later $500+ checkout goes straight to Pay", async ({ page }) => {
  let widget = await toDetails(page);
  await verify(page);
  await widget.locator("#idGo").click();
  await addCardAndPay(page, "$621.40");
  await widget.getByRole("button", { name: "Back to Ilé Living" }).click();

  widget = await checkoutAgain(page);
  await expect(widget.getByRole("heading", { name: "Pay $621.40 to Ilé Living" })).toBeVisible();
  await expect(widget.getByRole("radio", { name: /Visa ••• 4242/ })).toHaveAttribute("aria-checked", "true");
  await expect(widget.locator("#dGo")).toHaveCount(0);
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid $621.40 to Ilé Living" })).toBeVisible();
  await expect(events(page).locator("li", { hasText: "user.verified" })).toHaveCount(1);
});

test("Veriff's 3-attempt limit is shared across checkouts; after 3, blocked, and blocked in later checkouts", async ({ page }) => {
  // 1st failed check
  let widget = await toDetails(page, "retry");
  await verify(page);
  await expect(widget.locator("#idRetryLeft")).toHaveText("2 tries left");
  await widget.locator("#idRetryLater").click();

  // A later checkout: verify again from the details screen; the 2nd failure counts on top of the 1st
  widget = await checkoutAgain(page);
  await expect(widget.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  await expect(widget.locator(".steps [role=listitem]")).toHaveText(["Account", "Identity", "Payment"]);
  await verify(page);
  await expect(widget.locator("#idRetryReason")).toHaveText("There was glare on your ID. Avoid direct light.");
  await expect(widget.locator("#idRetryLeft")).toHaveText("1 try left");
  await widget.locator("#idRetryLater").click();

  // The 3rd failure: the blocked screen
  widget = await checkoutAgain(page);
  await verify(page);
  await expect(widget.getByRole("heading", { name: "We couldn’t verify your identity" })).toBeVisible();
  await expect(events(page).locator("li", { hasText: "user.blocked" })).toContainText('"reason":"id_declined"');
  await widget.locator("#blkBack").click();

  // Every later checkout that needs an ID: straight to the blocked screen, even with "passes" selected
  await page.getByLabel("ID check").selectOption("pass");
  widget = await checkoutAgain(page);
  await expect(widget.getByRole("heading", { name: "We couldn’t verify your identity" })).toBeVisible();
  await expect(widget.locator("#dGo")).toHaveCount(0);
});

/** Reach each block in a first checkout of $500 or more. */
async function getBlocked(page: Page, kind: "declined" | "sanctions" | "under18" | "attempts") {
  const widget = await toDetails(page, kind === "attempts" ? "retry" : kind);
  if (kind === "under18") { await dob(page, "12", "3", "1990"); await widget.locator("#dGo").click(); return widget; }
  await verify(page);
  if (kind === "attempts") {
    for (let i = 0; i < 2; i++) { await widget.locator("#idTryAgain").click(); await page.locator("#demoBtn").click(); await page.locator("#demoBtn").click(); }
  }
  return widget;
}

for (const [kind, title] of [
  ["declined", "We couldn’t verify your identity"],
  ["sanctions", "We couldn't verify this account"],
  ["under18", "You must be 18 or older"],
  ["attempts", "We couldn’t verify your identity"],
] as const) {
  test(`blocked (${kind}): can't pay at any amount; the blocked screen straight after sign-in, before Pay`, async ({ page }) => {
    let widget = await getBlocked(page, kind);
    await expect(widget.getByRole("heading", { name: title })).toBeVisible();
    await widget.locator("#blkBack").click();
    await page.getByLabel("ID check").selectOption("pass");

    // $500 or more again: no ID check, the same block
    widget = await checkoutAgain(page);
    await expect(widget.getByRole("heading", { name: title })).toBeVisible();
    await expect(widget.locator("#dGo")).toHaveCount(0);
    await widget.locator("#blkBack").click();

    // Under $500 too: blocked before Pay, nothing to pay with
    await page.getByLabel("Order", { exact: true }).selectOption("small");
    widget = await checkoutAgain(page);
    await expect(widget.getByRole("heading", { name: title })).toBeVisible();
    await expect(widget.locator(".steps")).toHaveCount(0);
    await expect(widget.locator("#payGo")).toHaveCount(0);
    await expect(widget.locator(".methods")).toHaveCount(0);
    await expect(events(page)).not.toContainText("payment.succeeded");
  });
}

test("blocked: a naira order under $500 is blocked too, and the store refuses to pay or open a bank transfer", async ({ page }) => {
  let widget = await getBlocked(page, "sanctions");
  await widget.locator("#blkBack").click();
  await page.getByLabel("Order", { exact: true }).selectOption("small");
  await page.getByLabel("Order currency").selectOption("NGN");
  widget = await checkoutAgain(page);
  await expect(widget.getByRole("heading", { name: "We couldn't verify this account" })).toBeVisible();
  await page.evaluate(async () => { const c = (window as any).__checkout.getState(); await c.startTransfer(); await c.pay(); }); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(widget.getByRole("heading", { name: "We couldn't verify this account" })).toBeVisible();
  await expect(widget.locator("#transferDetails")).toHaveCount(0);
  await expect(events(page)).not.toContainText("payment.succeeded");
});

test("not blocked: a Tier 0 user who stopped mid-verification still pays under $500", async ({ page }) => {
  let widget = await toDetails(page, "retry");
  await verify(page);
  await expect(widget.locator("#idRetryLeft")).toHaveText("2 tries left"); // 1 failure: not out of attempts
  await widget.locator("#idRetryLater").click();
  await page.getByLabel("Order", { exact: true }).selectOption("small");
  widget = await checkoutAgain(page);
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible();
  await addCardAndPay(page, "$23.40");
});

test("a naira order of $500 or more completes after verification (bank transfer)", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  await page.getByLabel("Order", { exact: true }).selectOption("large");
  await expect(page.locator("#orderTotal")).toHaveText("₦963,170.00"); // $621.40 × 1,550
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page);
  await expect(widget.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  await expect(widget.locator(".steps [role=listitem]")).toHaveText(["Account", "Identity", "Payment"]);
  await verify(page);
  await widget.locator("#idGo").click();

  // The naira rails, then the one-time account
  await expect(widget.locator('[data-addpm="ngn-bank"]')).toBeVisible();
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.getByRole("heading", { name: "Pay ₦963,170.00 by bank transfer" })).toBeVisible();
  await page.locator("#demoTransferArrives").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦963,170.00 to Ilé Living" })).toBeVisible();
  const ev = events(page).locator("li", { hasText: "payment.succeeded" });
  await expect(ev).toContainText('"amount":96317000,"currency":"NGN"');
  await expect(ev).toContainText('"identity_verified":true');
  await expect(ev).toContainText('"rail":"ngn_bank_transfer","account_type":"dynamic"');
});

test("a naira order of $500 or more completes after verification (naira card)", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  await page.getByLabel("Order", { exact: true }).selectOption("large");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page);
  await verify(page);
  await widget.locator("#idGo").click();
  await widget.locator('[data-addpm="ngn-card"]').click();
  await widget.locator("#cNum").fill("5061020000000000");
  await widget.locator("#cExp").fill("122029");
  await widget.locator("#cCvc").fill("123");
  await widget.locator("#cGo").click();
  await expect(widget.locator("#payGo")).toHaveText("Pay ₦963,170.00");
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦963,170.00 to Ilé Living" })).toBeVisible();
  await expect(events(page).locator("li", { hasText: "payment.succeeded" })).toContainText('"rail":"ngn_card"');
});
