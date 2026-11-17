import { test, expect, type Page } from "./fixtures";

/**
 * One look for every transaction (docs/decisions.md, History and receipts): the direction icon (+ in, ↗ out, ⇄ a
 * conversion) on rows and details, with how it moved in the row's subtitle; one detail template for money in and
 * out (icon, amount, one title line, the shared rows, the status only in the Status row, Share receipt). And the
 * bell: Notifications from any screen, each opening its transaction, Back returning to where it was opened.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
const body = (page: Page) => page.locator("#panelBody");
const title = (page: Page) => body(page).locator(".step-title").first();
/** The detail's elements from the Back row to Share receipt (what follows is particular to the transaction). */
const skeleton = (page: Page) => body(page).locator(".screen-fade > *").evaluateAll((els) => {
  const out: string[] = [];
  for (const el of els) { out.push(el.className || el.id); if (el.id === "shareReceipt") break; }
  return out;
});

test("the bell opens Notifications over an open flow (account details); a notification opens its transaction; Back returns", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("1");
  await page.locator('[data-holdcur="EUR"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#vaOpen").click();
  await page.locator("#vaAgree").check();
  await page.locator("#vaCreate").click();
  await expect(title(page)).toHaveText("EUR account details");
  await page.locator("#demoVaTransfer").click();
  // The bell, from the account details
  await page.locator("#openNotifHeader").click();
  await expect(title(page)).toHaveText("Notifications");
  await expect(page.locator("#extBackHome")).toHaveText("Back");
  const n = page.locator("#panelBody [data-notif]").first();
  await expect(n.locator(".settings-row-sub")).toHaveText("€298.80 from Ada Osun added to your EUR balance.");
  // Tapping the bell again doesn't stack another Notifications
  await page.locator("#openNotifHeader").click();
  // The notification opens its transaction
  await n.click();
  await expect(page.locator("[data-txamount]")).toHaveText("€298.80 EUR");
  await expect(page.locator("[data-txtitle]")).toHaveText("Bank transfer from Ada Osun");
  await expect(page.locator('#txDetail [data-label="Fee"] > span:last-child')).toHaveText("€1.20 EUR");
  // Back: Notifications, then the account details it was opened from
  await page.locator("#backFromTxDetail").click();
  await expect(title(page)).toHaveText("Notifications");
  await page.locator("#extBackHome").click();
  await expect(title(page)).toHaveText("EUR account details");
});

test("a notification about a send opens the send; Back from Notifications returns to the Activity tab", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  await page.evaluate(async () => {
    const w = (window as any).__withdrawals.getState();
    await w.move(w.list.find((x: any) => x.status === "paid").id, "reversed");
  });
  await page.locator("#openNotifHeader").click();
  await page.locator("#panelBody [data-notif]").first().click();
  await expect(page.locator('#txDetail [data-label="Status"] > span:last-child')).toHaveText("Reversed");
  await page.locator("#backFromTxDetail").click();
  await page.locator("#extBackHome").click();
  await expect(title(page)).toHaveText("Activity");
});

test("activity rows: one icon per direction (+ in, ↗ out, ⇄ conversions); balance histories too", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  const rows = await body(page).locator("#activityHistory .tx-row").evaluateAll((els) => els.map((el) => {
    const ic = el.querySelector(".tx-ic")!;
    return { dir: ic.getAttribute("data-dir"), svg: ic.innerHTML, amt: el.querySelector(".tx-amt")!.textContent!.trim() };
  }));
  expect(rows.length).toBeGreaterThan(10);
  for (const r of rows) {
    expect(["in", "out", "convert"]).toContain(r.dir);
    expect(r.amt.startsWith("-")).toBe(r.dir === "out");
  }
  expect(rows.some((r) => r.dir === "convert")).toBe(true);
  // The same icon for every row of a direction
  for (const d of ["in", "out", "convert"]) expect(new Set(rows.filter((r) => r.dir === d).map((r) => r.svg)).size).toBe(1);
  // A balance's history: the same icons
  await page.locator("#tabHome").click();
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  const dirs = await body(page).locator("#balanceHistory .tx-row .tx-ic").evaluateAll((els) => els.map((el) => el.getAttribute("data-dir")));
  expect(dirs.length).toBeGreaterThan(0);
  for (const d of dirs) expect(["in", "out", "convert"]).toContain(d);
});

test("money in and money out: the same detail template; the status only in the Status row; Share receipt on both", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  // Out: a failed send
  await page.locator('#activityHistory [data-txid="wd_seed3"]').click();
  await expect(body(page).locator(".tx-ic-lg")).toHaveAttribute("data-dir", "out");
  await expect(body(page).locator(".va-status")).toHaveCount(0); // no chip
  await expect(page.locator('#txDetail [data-label="Status"] > span:last-child')).toHaveText("Failed");
  await expect(page.locator("#shareReceipt")).toBeVisible();
  const out = await skeleton(page);
  await page.locator("#backFromTxDetail").click();
  // In: a naira credit
  await page.locator("#activityHistory [data-credit]").first().click();
  await expect(body(page).locator(".tx-ic-lg")).toHaveAttribute("data-dir", "in");
  await expect(body(page).locator(".va-status")).toHaveCount(0);
  await expect(page.locator("#shareReceipt")).toBeVisible();
  const inn = await skeleton(page);
  expect(inn).toEqual(out);
  expect(out).toEqual(["back-row", "center-col", "step-title mono", "step-sub", "info-card", "btn-secondary"]);
  await page.locator("#backFromTxDetail").click();
  // A conversion: ⇄
  await page.locator("#activityHistory .tx-row").filter({ has: page.locator('.tx-ic[data-dir="convert"]') }).first().click();
  await expect(body(page).locator(".tx-ic-lg")).toHaveAttribute("data-dir", "convert");
  await expect(page.locator("#shareReceipt")).toBeVisible();
});
