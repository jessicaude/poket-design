import { expect, type Page } from "@playwright/test";

/**
 * The wallet's waiting state (features/wallet/WaitingScreen.tsx): a tracker's labels and each step's state, read until
 * they match ("done", "current", "upcoming").
 */
export async function expectTrack(page: Page, sel: string, labels: string[], states: string[]) {
  const steps = page.locator(`${sel} .track-step`);
  await expect(steps.locator(".track-label")).toHaveText(labels);
  await expect.poll(() => steps.evaluateAll((els) => els.map((e) => e.getAttribute("data-state")))).toEqual(states);
}
export const WAITING = ["done", "current", "upcoming"];
export const COMPLETE = ["done", "done", "done"];
