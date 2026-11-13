import { useEffect, useState } from "react";
import { create } from "zustand";
import { ACCOUNT_LOCKED, accountLockedUntil, skipAccountLock } from "@/lib/mock-api";
import { useEvents } from "./events";

/**
 * The account lock after too many wrong verification codes (lib/mock-api.ts verifyCode), shared by Checkout and the
 * wallet: `until` mirrors the mock so screens re-render; the locked screens count down to it.
 */
type State = { until: number | null; sync: () => void; skip: () => void };
export const useAccountLock = create<State>((set) => ({
  until: null,
  sync: () => set({ until: accountLockedUntil() }),
  skip: () => { skipAccountLock(); set({ until: null }); },
}));

/** "Try again in 2 hours." */
export const LOCK_COPY = { title: "Account locked", body: "Too many incorrect codes. Try again in 2 hours." };
/** The reason sent with account.locked. */
export const LOCK_REASON = "too_many_incorrect_codes";

/**
 * After a code check failed: if it locked the account, mirror it and tell the merchant (account.locked, with the
 * reason). Returns whether the account is now locked.
 */
export function handleCodeError(e: unknown, widget: "checkout" | "wallet"): boolean {
  if (!(e instanceof Error) || e.message !== ACCOUNT_LOCKED) return false;
  const wasLocked = useAccountLock.getState().until !== null;
  useAccountLock.getState().sync();
  if (!wasLocked) useEvents.getState().emit("account.locked", { widget, reason: LOCK_REASON, locked_until: new Date(accountLockedUntil() ?? Date.now()).toISOString() });
  return true;
}

/** "1:59:59": the time left, live. */
export function fmtLockLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** The lock's time left (ms), ticking every second; at 0 the lock clears itself. */
export function useLockLeft(): number {
  const until = useAccountLock((s) => s.until);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const id = setInterval(() => { const t = Date.now(); setNow(t); if (t >= until) useAccountLock.getState().sync(); }, 1000);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, until - now) : 0;
}
