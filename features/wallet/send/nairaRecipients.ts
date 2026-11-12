import { create } from "zustand";
import { setOtherPoketUsersHoldNaira } from "@/lib/mock-api";

/**
 * WGT-07, naira to Poket users: a recipient who can hold naira gets naira; one who can't (no BVN or NIN, or not
 * eligible) gets USD, converted on receipt. Amara Okafor can, Daniel Cho can't (lives abroad); every other Poket user
 * follows the demo bar's "Recipient can hold naira: Yes / No" (kept in step with the mock API).
 */
type State = { othersHoldNaira: boolean; setOthersHoldNaira: (v: boolean) => void };
export const useNairaRecipients = create<State>((set) => ({
  othersHoldNaira: true,
  setOthersHoldNaira: (v) => { setOtherPoketUsersHoldNaira(v); set({ othersHoldNaira: v }); },
}));

/** Whether this Poket user can hold naira: their own setting, else the demo bar's. */
export const canHoldNaira = (u: { holdsNaira?: boolean }) => u.holdsNaira ?? useNairaRecipients.getState().othersHoldNaira;
