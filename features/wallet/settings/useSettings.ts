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
/** How long a raised limit waits before it applies: not decided, so a placeholder. */
export const COOLING_OFF_PLACEHOLDER = "[cooling-off]";
/** A new user's daily limit: ₦50,000.00 (demo; capped at the tier's maximum). */
export const INSTANT_DEFAULT_LIMIT_KOBO: Kobo = 5000000;

type State = {
  channel: Channel;
  devices: Device[];
  /** Instant transfers to banks: on or off, and the daily limit (kobo). */
  instantOn: boolean;
  instantLimit: Kobo;
  /** A raised daily limit waiting out the cooling-off period ([cooling-off], not decided): it applies after. */
  instantPending: Kobo | null;
  /** The daily limit being typed on its screen: kept while the PIN screens are up (Back returns to it). */
  limitDraft: Kobo | null;
  setLimitDraft: (kobo: Kobo | null) => void;
  /** Demo bar "Instant transfers default: On / Off": what a new user starts with. */
  instantDefaultOn: boolean;
  setChannel: (c: Channel) => void;
  signOutDevice: (id: string) => void;
  setInstantOn: (on: boolean) => void;
  setInstantLimit: (kobo: Kobo) => void;
  /**
   * A new daily limit, once the PIN approved it: lower (or the same) applies at once; higher waits out the cooling-off
   * period (pending). Either replaces a pending raise. Returns whether it's pending.
   */
  changeInstantLimit: (kobo: Kobo) => boolean;
  cancelPendingLimit: () => void;
  /** Demo bar "Skip cooling-off": the pending limit applies now. */
  applyPendingLimit: () => void;
  /** Demo: change the default, and start over as a new user with it. */
  setInstantDefault: (on: boolean) => void;
  reset: () => void;
};

const fresh = (defaultOn: boolean) => ({
  channel: "email" as Channel,
  devices: [{ id: "d1", label: "This device", meta: "Now" }, { id: "d2", label: "Chrome · MacBook Air", meta: "2w ago" }],
  instantOn: defaultOn,
  instantLimit: INSTANT_DEFAULT_LIMIT_KOBO,
  instantPending: null as Kobo | null,
  limitDraft: null as Kobo | null,
  instantDefaultOn: defaultOn,
});

export const useSettings = create<State>((set, get) => ({
  ...fresh(true),
  setChannel: (channel) => set({ channel }),
  signOutDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
  setInstantOn: (instantOn) => set({ instantOn }),
  setInstantLimit: (instantLimit) => set({ instantLimit }),
  setLimitDraft: (limitDraft) => set({ limitDraft }),
  changeInstantLimit: (kobo) => {
    const raise = kobo > get().instantLimit;
    set(raise ? { instantPending: kobo } : { instantLimit: kobo, instantPending: null });
    return raise;
  },
  cancelPendingLimit: () => set({ instantPending: null }),
  applyPendingLimit: () => { const p = get().instantPending; if (p !== null) set({ instantLimit: p, instantPending: null }); },
  setInstantDefault: (on) => set(fresh(on)),
  reset: () => set(fresh(get().instantDefaultOn)),
}));

/** The daily limit as it applies: never above the tier's maximum. */
export const effectiveLimit = (limit: Kobo, tier: number) => Math.min(limit, INSTANT_TIER_MAX_DEMO_KOBO[(Math.max(0, Math.min(3, tier))) as 0 | 1 | 2 | 3]);
