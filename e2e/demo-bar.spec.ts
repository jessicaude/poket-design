import { test, expect, type Page } from "@playwright/test";

/** Every demo bar control shows its name with its value ("Naira partner: Up", "Name check: Available"). */
async function options(page: Page) {
  return page.locator(".pbar select").evaluateAll((els) => els.map((s) => ({
    name: (s.closest("label")?.querySelector("span")?.textContent ?? "").trim(),
    options: Array.from((s as HTMLSelectElement).options).map((o) => o.textContent!.trim()),
  })));
}
function nameWithValue(controls: { name: string; options: string[] }[]) {
  expect(controls.length).toBeGreaterThan(3);
  for (const c of controls) {
    expect(c.name, "every control has a name").not.toBe("");
    for (const o of c.options) expect(o, c.name).toMatch(new RegExp(`^${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: \\S`));
  }
}

test("wallet demo bar: every control shows its name and value", async ({ page }) => {
  // The NGN account choice shows the conditional "Verified ID shows" control too
  await page.goto("/demo/wallet?ngn=ngnChoice");
  await expect(page.getByLabel("Verified ID shows")).toBeVisible();
  const controls = await options(page);
  nameWithValue(controls);
  expect(controls.find((c) => c.name === "Name check")!.options).toEqual(["Name check: Available", "Name check: Unavailable"]);
  expect(controls.find((c) => c.name === "Tier")!.options).toEqual(["Tier: 0", "Tier: 1", "Tier: 2", "Tier: 3"]);
  expect(controls.some((c) => /enquiry/i.test(c.name))).toBe(false);
});

test("Checkout demo bar: every control shows its name and value", async ({ page }) => {
  // A naira order shows its own controls (naira partner, bank transfer account)
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  await expect(page.getByLabel("Naira partner")).toBeVisible();
  const controls = await options(page);
  nameWithValue(controls);
  expect(controls.find((c) => c.name === "Theme")!.options).toEqual(["Theme: Poket", "Theme: CentryOS"]);
});
