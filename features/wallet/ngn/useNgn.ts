import { create } from "zustand";
import {
  checkId, closeDedicatedAccount, createDedicatedAccount, createTemporaryAccount, resetNgnServer, seedNgnServer, setDedicatedAccountFrozen,
  simulateTransferArrives,
  type DedicatedAccount, type NgnIdRoute, type TemporaryAccount,
} from "@/lib/mock-api";
import type { Kobo } from "@/lib/money";
import { useAccount } from "@/store/account";

/**
 * NGN (naira) flow controller. The current `stage` is rendered by NgnBody inside WalletShell's #panelBody.
 * Ported from tDepositMethod (cur === 'NGN'), vaOpen, tVaNgn, ngnTempCreate, ngnTempArrive, ngnIdCheck,
 * vaCreate and the vaBack / NGN bindings in reference/poket-unified.html. Stage names are the reference's
 * `v.stage` values, so they can be searched for there.
 */
export const NGN_STAGES = [
  "deposit-method",
  "ngnChoice", "tempAmount", "tempCreating", "temp", "tempArrived", "tempDone", "tempExpired",
  "ngnRoute", "ngnUnavailable", "ngnId", "ngnChecking", "ngnLocked",
  "locked", "intro", "creating", "details",
] as const;
export type NgnStage = (typeof NGN_STAGES)[number];
export const isNgnStage = (s: unknown): s is NgnStage => NGN_STAGES.includes(s as NgnStage);

export type Tier = 0 | 1 | 2 | 3;
/** What the verified ID shows about nationality and residence (S.ngnElig). */
export type Eligibility = "ng_in" | "ng_out" | "for_in" | "for_out";
export type NgnId = { route: NgnIdRoute; last4: string };

export const NGN_ROUTES: Record<Eligibility, { label: string; routes: NgnIdRoute[] }> = {
  ng_in: { label: "Nigerian living in Nigeria", routes: ["bvn", "nin"] },
  ng_out: { label: "Nigerian living abroad", routes: ["nrbvn"] },
  for_in: { label: "Foreigner living in Nigeria", routes: ["nin", "bvn", "permit"] },
  for_out: { label: "Foreigner living outside Nigeria", routes: [] },
};
export const NGN_ID: Record<NgnIdRoute, { name: string; long: string; len: number }> = {
  bvn: { name: "BVN", long: "Bank Verification Number", len: 11 },
  nin: { name: "NIN", long: "National Identification Number", len: 11 },
  nrbvn: { name: "NRBVN", long: "Non-Resident BVN", len: 11 },
  permit: { name: "Passport and residence permit", long: "Passport and residence permit", len: 0 },
};
/** Failed ID matches share Veriff's limit (VF_MAX_TRIES). */
export const NGN_MAX_ATTEMPTS = 3;
/** Smallest temporary-account top-up: ₦100.00 (the reference enables "Create temporary account" from 10000 kobo). */
export const NGN_MIN_TOPUP: Kobo = 10000;

type State = {
  tier: Tier;
  ngnBalance: Kobo;
  /** NGN taken out of ngnBalance for payouts not yet sent (approved with the PIN, or held for [hold]). */
  ngnReserved: Kobo;
  /** NGN a merchant holds for the user (e.g. store credit). It can be converted but not sent to a bank. */
  ngnMerchantBalance: Kobo;
  eligibility: Eligibility;
  ngnId: NgnId | null;
  /** Failed ID matches, shared with Veriff. */
  attempts: number;
  dedicated: DedicatedAccount | null;
  /** null: no NGN screen open, so the wallet body is empty. */
  stage: NgnStage | null;
  /** Where the account flow was opened from (v.back): Back from its first stage returns here. */
  entry: NgnStage | null;
  temp: TemporaryAccount | null;
  /** Amount typed on tempAmount (v.tempCents), kept when going Back to it. */
  tempCents: Kobo;
  /** ID chosen on ngnRoute, and whether the last check didn't match. */
  route: NgnIdRoute | null;
  mismatch: boolean;
  /** The ID number typed on ngnId (v.idNum): digits only, cleared after a mismatch. */
  idNum: string;
  /** details: "Close account details?" is showing (v.confirmClose). Back cancels it. */
  confirmClose: boolean;

  /** Demo controls (the prototype bar). */
  set: (patch: Partial<Pick<State, "tier" | "ngnBalance" | "ngnReserved" | "ngnMerchantBalance" | "eligibility" | "ngnId" | "attempts" | "dedicated">>) => void;
  reset: () => void;

  open: (stage?: NgnStage) => void;
  go: (stage: NgnStage) => void;
  back: () => void;
  close: () => void;

  /** dmBank: vaOpen('NGN'). */
  openBankTransfer: () => void;
  /** ngnPickDedicated: the intro if the ID is already matched, else choose an ID. */
  pickDedicated: () => void;
  /** data-ngnroute */
  chooseRoute: (route: NgnIdRoute) => void;
  setTempCents: (kobo: Kobo) => void;
  createTemp: (amount: Kobo) => Promise<void>;
  /** The countdown reached zero (or the demo's "Let it expire"). */
  expireTemp: () => void;
  /** ngnTempAgain */
  tempAgain: () => void;
  /** Demo: "Transfer arrives". */
  transferArrives: () => Promise<void>;
  setIdNum: (text: string) => void;
  /** Checks `number`, or the typed idNum. */
  checkIdNumber: (number?: string) => Promise<void>;
  createDedicated: () => Promise<void>;
  toggleFreeze: () => Promise<void>;
  askClose: (ask: boolean) => void;
  closeDedicated: () => Promise<void>;
};

const INITIAL = {
  tier: 0 as Tier, ngnBalance: 5000000, ngnReserved: 0, ngnMerchantBalance: 0, eligibility: "ng_in" as Eligibility, ngnId: null, attempts: 0, dedicated: null,
  stage: null, entry: null, temp: null, tempCents: 0, route: null, mismatch: false, idNum: "", confirmClose: false,
};

export const useNgn = create<State>((set, get) => {
  /** ngnRoute, or ngnUnavailable when the verified ID allows no route (tVaNgn does this at render). */
  const routeStage = (): NgnStage => (NGN_ROUTES[get().eligibility].routes.length ? "ngnRoute" : "ngnUnavailable");

  return {
    ...INITIAL,

    set: (patch) => {
      if ("dedicated" in patch) seedNgnServer({ dedicated: patch.dedicated });
      if ("ngnId" in patch) seedNgnServer({ verifiedId: patch.ngnId });
      set(patch);
    },
    reset: () => { resetNgnServer(); set(INITIAL); },

    open: (stage = "deposit-method") => set({ stage, entry: null }),
    go: (stage) => set({ stage }),
    close: () => set({ stage: null, entry: null, temp: null, tempCents: 0, route: null, mismatch: false, idNum: "", confirmClose: false }),

    back: () => {
      const { stage, tier, ngnId, entry } = get();
      if (get().confirmClose) return set({ confirmClose: false });
      if (stage === "deposit-method" || stage === null) return get().close();
      if (stage === "temp" || stage === "tempExpired") return set({ temp: null, stage: "tempAmount" });
      const prev: Partial<Record<NgnStage, NgnStage | null>> = {
        tempAmount: tier < 1 ? null : "ngnChoice",
        ngnRoute: "ngnChoice",
        ngnId: "ngnRoute",
        ngnUnavailable: "ngnChoice",
        intro: ngnId ? "ngnChoice" : "ngnRoute",
      };
      const p = prev[stage];
      if (p) return set({ stage: p });
      set({ stage: entry, entry: null, temp: null });
    },

    openBankTransfer: () => {
      const { tier, dedicated, stage } = get();
      const usable = dedicated && dedicated.status !== "rejected";
      // Everyone can top up through a temporary account; a dedicated account needs Tier 1 and a matched ID.
      const next: NgnStage = usable ? (tier < 1 ? "locked" : "details") : tier < 1 ? "tempAmount" : "ngnChoice";
      set({ entry: stage, stage: next, route: null, mismatch: false, temp: null, tempCents: 0, idNum: "", confirmClose: false });
    },

    pickDedicated: () => set({ stage: get().ngnId ? "intro" : routeStage() }),
    // Attempts are shared with Veriff, so they may already be used up before this step.
    chooseRoute: (route) => set({ route, mismatch: false, idNum: "", stage: get().attempts >= NGN_MAX_ATTEMPTS ? "ngnLocked" : "ngnId" }),

    setTempCents: (tempCents) => set({ tempCents }),
    createTemp: async (amount) => {
      set({ stage: "tempCreating" });
      const temp = await createTemporaryAccount(amount);
      if (get().stage === "tempCreating") set({ temp, stage: "temp" });
    },
    expireTemp: () => { if (get().stage === "temp") set({ stage: "tempExpired" }); },
    tempAgain: () => set({ temp: null, stage: "tempAmount" }),

    transferArrives: async () => {
      set({ stage: "tempArrived" });
      const { amount } = await simulateTransferArrives();
      set((s) => ({ ngnBalance: s.ngnBalance + amount, stage: s.stage === "tempArrived" ? "tempDone" : s.stage }));
    },

    setIdNum: (text) => set({ idNum: text.replace(/\D/g, "").slice(0, 11) }),
    checkIdNumber: async (number = get().idNum) => {
      const route = get().route;
      if (!route) throw new Error("choose an ID first");
      if (get().attempts >= NGN_MAX_ATTEMPTS) return set({ stage: "ngnLocked" });
      set({ stage: "ngnChecking" });
      const res = await checkId(route, number);
      if (!res.match) {
        const attempts = get().attempts + 1;
        set((s) => ({ attempts, mismatch: true, idNum: "", stage: s.stage === "ngnChecking" ? (attempts >= NGN_MAX_ATTEMPTS ? "ngnLocked" : "ngnId") : s.stage }));
        return;
      }
      set((s) => ({ ngnId: { route, last4: res.last4 }, mismatch: false, stage: s.stage === "ngnChecking" ? "intro" : s.stage }));
    },

    createDedicated: async () => {
      set({ stage: "creating" });
      const dedicated = await createDedicatedAccount();
      set((s) => ({ dedicated, stage: s.stage === "creating" ? "details" : s.stage }));
    },
    toggleFreeze: async () => {
      const d = get().dedicated;
      if (!d) return;
      set({ dedicated: await setDedicatedAccountFrozen(d.status !== "frozen") });
    },
    askClose: (confirmClose) => set({ confirmClose }),
    /** vaCloseConfirm: remove the details and leave the flow. The notice is shown by the screen. */
    closeDedicated: async () => {
      await closeDedicatedAccount();
      set({ dedicated: null, confirmClose: false, stage: get().entry, entry: null });
    },
  };
});

/** vaHolderName(): the signed-in person's name, else the reference's demo person. */
export function holderName(): string {
  const a = useAccount.getState().account;
  return [a?.first, a?.last].filter(Boolean).join(" ") || "Ada Osun";
}

/** The reference's ngnFmtCountdown: mm:ss, never below 00:00. */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/**
 * The ngnAmt input's parse, in integer maths: keep digits and dots, then naira and up to 2 decimals.
 * "₦25,000.5" gives 2500050. The reference's parseFloat-based version gives the same kobo.
 */
export function parseNairaInput(text: string): Kobo {
  const [ip = "", dp] = text.replace(/[^\d.]/g, "").split(".");
  const naira = Number(ip || "0");
  const kobo = dp === undefined ? 0 : Number((dp.slice(0, 2) + "00").slice(0, 2));
  return naira * 100 + kobo || 0;
}

/** VA_SPEC.NGN in the reference. Partner-neutral: the bank is a placeholder. */
export const NGN_VA = {
  rails: "NIP bank transfer",
  arrives: "Usually within seconds",
  bank: "[Partner bank]",
  fields: (num: string): [string, string][] => [["Account number", num.slice(0, 10)], ["Bank", "[Partner bank]"]],
};
