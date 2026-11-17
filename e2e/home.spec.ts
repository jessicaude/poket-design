import { test, expect } from "./fixtures";

/** The home page lists the demos: ported ones link to their page with their main flows; the rest are To port. */
test("home: the demos, what's ported, and the ported ones' flows", async ({ page }) => {
  await page.goto("/");
  const rows = page.locator("li[data-demo]");
  await expect(rows.locator("b")).toHaveText(["Checkout", "Wallet", "Payout: Get paid", "Wallets widget on a merchant page", "Conversion widget"]);
  const row = (title: string) => page.locator(`li[data-demo="${title}"]`);
  await expect(row("Checkout")).toContainText("Ilé Living (store)");
  await expect(row("Checkout").locator("a")).toHaveAttribute("href", "/demo/ile-living");
  await expect(row("Checkout").locator("[data-flows]")).toHaveText("Card, naira card and bank transfer, sign-up, ID check, Poket account with refunds and disputes");
  await expect(row("Wallet")).toContainText("Poket wallet with naira");
  await expect(row("Wallet").locator("a")).toHaveAttribute("href", "/demo/wallet");
  await expect(row("Wallet").locator("[data-flows]")).toHaveText("Deposit, Send, Convert, NGN account, activity and receipts, statements, settings");
  for (const [title, host] of [["Payout: Get paid", "Gigsy"], ["Wallets widget on a merchant page", "Esusu Circle"], ["Conversion widget", "NairaBridge"]]) {
    await expect(row(title)).toContainText(host);
    await expect(row(title)).toContainText("To port");
    await expect(row(title).locator("[data-flows]")).toHaveCount(0);
  }
  await expect(page.locator("li[data-demo]", { hasText: "Ported" })).toHaveCount(2);
  // The wallet's link opens it
  await row("Wallet").locator("a").click();
  await expect(page).toHaveURL(/\/demo\/wallet$/);
  await expect(page.locator("#actSend")).toBeVisible();
});
