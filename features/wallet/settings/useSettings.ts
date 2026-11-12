import { create } from "zustand";
import type { Kobo } from "@/lib/money";

/**
 * The wallet's Settings state: Security's passcode delivery and signed-in devices (the reference's identity.channel
 * and devices), and WGT-09's instant transfer controls for naira sends to banks.
 */
export type Device = { id: string; label: string; meta: string };
export type Channel = "email" | "text";

/**
 * Each tier's highest daily limit for instant transfers. Not decided: screens show "₦[tier max]"; these are demo
 * values only, so the Change screen can refuse an amount over it (like STEP_UP_DEMO_USD_CENTS).
 */
export const INSTANT_TIER_MAX_DEMO_KOBO: Record<0 | 1 | 2 | 3, Kobo> = { 0: 10000000, 1: 100000000, 2: 500000000, 3: 2500000000 };
export const TIER_MAX_PLACEHOLDER = "₦[tier max]";
/** A new user's daily limit: ₦50,000.00 (demo; capped at the tier's maximum). */
export const INSTANT_DEFAULT_LIMIT_KOBO: Kobo = 5000000;

type State = {
  channel: Channel;
  devices: Device[];
  /** Instant transfers to banks: on or off, and the daily limit (kobo). */
  instantOn: boolean;
  instantLimit: Kobo;
  /** Demo bar "Instant transfers default: On / Off": what a new user starts with. */
  instantDefaultOn: boolean;
  setChannel: (c: Channel) => void;
  signOutDevice: (id: string) => void;
  setInstantOn: (on: boolean) => void;
  setInstantLimit: (kobo: Kobo) => void;
  /** Demo: change the default, and start over as a new user with it. */
  setInstantDefault: (on: boolean) => void;
  reset: () => void;
};

const fresh = (defaultOn: boolean) => ({
  channel: "email" as Channel,
  devices: [{ id: "d1", label: "This device", meta: "Now" }, { id: "d2", label: "Chrome · MacBook Air", meta: "2w ago" }],
  instantOn: defaultOn,
  instantLimit: INSTANT_DEFAULT_LIMIT_KOBO,
  instantDefaultOn: defaultOn,
});

export const useSettings = create<State>((set, get) => ({
  ...fresh(true),
  setChannel: (channel) => set({ channel }),
  signOutDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
  setInstantOn: (instantOn) => set({ instantOn }),
  setInstantLimit: (instantLimit) => set({ instantLimit }),
  setInstantDefault: (on) => set(fresh(on)),
  reset: () => set(fresh(get().instantDefaultOn)),
}));

/** The daily limit as it applies: never above the tier's maximum. */
export const effectiveLimit = (limit: Kobo, tier: number) => Math.min(limit, INSTANT_TIER_MAX_DEMO_KOBO[(Math.max(0, Math.min(3, tier))) as 0 | 1 | 2 | 3]);
