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
  /**
   * WGT-10: this device is bound to the account (demo bar "This device: Known / New"). A new device confirms itself
   * with a code sent to the user's email the first time money moves; then it's "This device" under Security.
   */
  deviceKnown: boolean;
  /** Demo bar: the next selfie check's result, and "Flag as unusual" (any send asks for a selfie check). */
  selfieOutcome: "pass" | "retry" | "declined";
  flagUnusual: boolean;
  /** 3 failed ID checks (selfie checks and NGN ID matches, counted together): the account is blocked. */
  idBlocked: boolean;
  /** WGT-13: demo bar "Naira partner: Up / Down". While down, naira bank transfers are paused (NairaPausedBanner). */
  nairaPartnerDown: boolean;
  setDemo: (patch: Partial<Pick<State, "selfieOutcome" | "flagUnusual" | "idBlocked" | "nairaPartnerDown">>) => void;
  /**
   * Demo bar "Single active device" (to confirm: not in the PRD). On: binding a new device signs out every other one,
   * so Security lists only this device; a device signed out that way is asked to sign in again on its next action.
   */
  singleDevice: boolean;
  setSingleDevice: (on: boolean) => void;
  /** This device was signed out because another device was bound (single active device). */
  signedOut: boolean;
  /** Its next action happened: the panel shows "Sign in again" (WalletShell) until it signs in. */
  signInPrompt: boolean;
  /** Demo bar "Sign in on another device": another device binds, so (single active device) this one is signed out. */
  otherDeviceBinds: () => void;
  showSignInPrompt: () => void;
  /** Signed in again: a new device as far as the account knows (confirms itself the next time money moves). */
  signBackIn: () => void;
  setDeviceKnown: (known: boolean) => void;
  bindDevice: () => void;
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

const THIS_DEVICE: Device = { id: "d1", label: "This device", meta: "Now" };
const OTHER_DEVICE: Device = { id: "d2", label: "Chrome · MacBook Air", meta: "2w ago" };
/** The other device once it has signed in and been bound (demo "Sign in on another device"). */
const OTHER_DEVICE_JUST_BOUND: Device = { ...OTHER_DEVICE, meta: "just now" };

const fresh = (defaultOn: boolean) => ({
  channel: "email" as Channel,
  devices: [THIS_DEVICE, OTHER_DEVICE],
  deviceKnown: true,
  selfieOutcome: "pass" as "pass" | "retry" | "declined",
  flagUnusual: false,
  idBlocked: false,
  nairaPartnerDown: false,
  singleDevice: false,
  signedOut: false,
  signInPrompt: false,
  instantOn: defaultOn,
  instantLimit: INSTANT_DEFAULT_LIMIT_KOBO,
  instantPending: null as Kobo | null,
  limitDraft: null as Kobo | null,
  instantDefaultOn: defaultOn,
});

export const useSettings = create<State>((set, get) => ({
  ...fresh(true),
  setChannel: (channel) => set({ channel }),
  setDemo: (patch) => set(patch),
  // Known: "This device" is listed; new: only the other device until this one is bound
  setDeviceKnown: (deviceKnown) => set((s) => ({ deviceKnown, devices: deviceKnown ? [THIS_DEVICE, ...s.devices.filter((d) => d.id !== "d1")] : s.devices.filter((d) => d.id !== "d1") })),
  // With a single active device, binding this one signs out the others: only this device is left
  bindDevice: () => set((s) => ({ deviceKnown: true, devices: [THIS_DEVICE, ...(s.singleDevice ? [] : s.devices.filter((d) => d.id !== "d1"))] })),
  setSingleDevice: (singleDevice) => set({ singleDevice }),
  otherDeviceBinds: () => set({ signedOut: true, signInPrompt: false }),
  showSignInPrompt: () => set({ signInPrompt: true }),
  // Signed in again, this device isn't bound: the other one (bound when it signed this one out) is the only one listed
  signBackIn: () => set({ signedOut: false, signInPrompt: false, deviceKnown: false, devices: [OTHER_DEVICE_JUST_BOUND] }),
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
  setInstantDefault: (on) => set((s) => ({ ...fresh(on), deviceKnown: s.deviceKnown, devices: s.devices, selfieOutcome: s.selfieOutcome, flagUnusual: s.flagUnusual, idBlocked: s.idBlocked, nairaPartnerDown: s.nairaPartnerDown, singleDevice: s.singleDevice, signedOut: s.signedOut, signInPrompt: s.signInPrompt })),
  reset: () => set(fresh(get().instantDefaultOn)),
}));

/** The daily limit as it applies: never above the tier's maximum. */
export const effectiveLimit = (limit: Kobo, tier: number) => Math.min(limit, INSTANT_TIER_MAX_DEMO_KOBO[(Math.max(0, Math.min(3, tier))) as 0 | 1 | 2 | 3]);
