import { test, expect } from "@playwright/test";

/** Checkout on the Ilé Living demo, following the prototype's flow. */

async function enterCode(page: import("@playwright/test").Page, code = "123456") {
  const boxes = page.locator("#otp input");
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill(code[i]);
}

test("a new user signs up, adds a card and pays", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");

  // Prefilled from the store's checkout form
  await expect(widget.locator("#idInput")).toHaveValue("kemi.adeyemi@gmail.com");
  await expect(widget.locator("#suFirst")).toHaveValue("Kemi");
  await expect(widget.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "https://onepoket.com/terms-and-conditions");
  await expect(widget.locator("#suGo")).toBeDisabled();
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();

  await expect(widget.locator(".id-val")).toHaveText("k••••i@gmail.com");
  await enterCode(page);
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible();
  await expect(page.getByTestId("events")).toContainText("user.account_created");

  await widget.getByRole("button", { name: /^Card/ }).click();
  await widget.locator("#cNum").fill("4242424242424242");
  await expect(widget.locator("#cNum")).toHaveValue("4242 4242 4242 4242");
  await widget.locator("#cExp").fill("122029");
  await expect(widget.locator("#cExp")).toHaveValue("12 / 2029");
  await widget.locator("#cCvc").fill("123");
  await widget.locator("#cZip").fill("10001");
  await widget.locator("#cGo").click();

  await expect(widget.getByRole("radio", { name: /Visa ••• 4242/ })).toHaveAttribute("aria-checked", "true");
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid $23.40 to Ilé Living" })).toBeVisible();
  await expect(widget).toContainText("ILV-10482");
  await expect(page.getByTestId("events")).toContainText("payment.succeeded");
});

test("a wrong code (000000) shows an error and clears the boxes", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page, "000000");
  await expect(widget.locator(".otp-status")).toHaveText("That code isn’t right. Check it and try again.");
  await expect(widget.locator("#otp input").first()).toHaveValue("");
});

test("an existing email logs in instead of signing up", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#idInput").fill("ada@osun.co");
  await expect(widget.getByText("This email already has a Poket account.")).toBeVisible();
  await widget.getByRole("button", { name: "Continue to log in" }).click();
  await enterCode(page);
  await expect(widget.getByRole("heading", { name: "Pay $23.40 to Ilé Living" })).toBeVisible();
  await expect(widget).toContainText("Signed in as a••••a@osun.co");
});

test("a returning user pays in one tap", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await expect(widget.locator(".steps")).toHaveCount(0);
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid $23.40 to Ilé Living" })).toBeVisible();
});

test("a declined card shows the declined screen, then another way to pay", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.getByLabel("Card outcome").selectOption("declined");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Your card was declined" })).toBeVisible();
  await expect(page.getByTestId("events")).toContainText("payment.failed");
  await widget.getByRole("button", { name: "Choose another way to pay" }).click();
  await expect(widget.getByRole("radio", { name: /Chase checking/ })).toHaveAttribute("aria-checked", "true");
  await expect(widget.locator(".mandate")).toContainText("By paying, you authorize Poket to debit Chase checking ••• 6789");
});

test("Amex formats 4-6-5 and asks for a 4-digit CVC", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.getByRole("button", { name: /Add a payment method/ }).click();
  await widget.getByRole("button", { name: /^Card/ }).click();
  await widget.locator("#cNum").fill("378282246310005");
  await expect(widget.locator("#cNum")).toHaveValue("3782 822463 10005");
  await expect(widget.locator("#cCvc")).toHaveAttribute("placeholder", "1234");
  await widget.locator("#cExp").fill("012024");
  await expect(widget.getByText("This card has expired. Use a card that’s still valid.")).toBeVisible();
});

test("demo bar: an NGN order shows in naira on the page and in the widget", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await expect(page.locator("#orderTotal")).toHaveText("$23.40");
  await page.getByLabel("Order currency").selectOption("NGN");
  await expect(page.locator("#orderTotal")).toHaveText("₦36,270.00 NGN");
  await expect(page.locator(".summary")).toContainText("₦24,490.00 NGN"); // Adire throw cushion, $15.80
  await expect(page.locator(".ship")).toContainText("₦9,300.00 NGN"); // Express, $6.00

  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await expect(widget.getByRole("heading", { name: "Pay ₦36,270.00 NGN to Ilé Living" })).toBeVisible();
  await expect(widget.locator(".line", { hasText: "Order total" })).toHaveText(/₦36,270\.00\s*NGN/);
  await expect(page.getByTestId("events")).toContainText('"currency":"NGN"');
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 NGN to Ilé Living" })).toBeVisible();
});

test("demo bar: the widget reads what the merchant accepts and its bank transfer account", async ({ page }) => {
  await page.goto("/demo/ile-living");
  const settings = () => page.evaluate(() => (window as any).__checkout.getState().settings); // eslint-disable-line @typescript-eslint/no-explicit-any
  const accepts = page.getByRole("group", { name: "Merchant accepts" });
  for (const l of ["NGN card", "NGN bank transfer", "Conversion"]) await expect(accepts.getByLabel(l)).toBeChecked();
  await expect(page.getByLabel("Bank transfer account")).toHaveValue("dynamic");

  await accepts.getByLabel("NGN card").uncheck();
  await accepts.getByLabel("Conversion").uncheck();
  await page.getByLabel("Bank transfer account").selectOption("pool");
  await page.locator("#payWithPoket").click();
  expect(await settings()).toEqual({ accepts: { ngnCard: false, ngnBank: true, conversion: false }, bankTransferAccount: "pool" });

  // Read when the widget opens: changing the bar later applies to the next checkout
  await page.getByTestId("checkout-widget").getByRole("button", { name: "Close" }).click();
  await accepts.getByLabel("NGN card").check();
  await page.getByLabel("Bank transfer account").selectOption("dynamic");
  await page.locator("#payWithPoket").click();
  expect(await settings()).toEqual({ accepts: { ngnCard: true, ngnBank: true, conversion: false }, bankTransferAccount: "dynamic" });
});

test("the $500 ID check uses an NGN order's USD value", async () => {
  const { orderUsdCents, formatOrder } = await import("@/lib/money");
  expect(orderUsdCents(50000 * 1550, "NGN")).toBe(50000);
  expect(orderUsdCents(49999 * 1550, "NGN")).toBe(49999);
  expect(orderUsdCents(2340, "USD")).toBe(2340);
  expect(formatOrder(3627000, "NGN")).toBe("₦36,270.00 NGN");
  expect(formatOrder(2340, "USD")).toBe("$23.40");
});
