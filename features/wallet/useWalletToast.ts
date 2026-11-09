import { create } from "zustand";

/** The wallet's toast in #toastWrap: showToast() and showNotice() in reference/poket-unified.html. */
export type WalletToast = { id: number; top: boolean; variant?: "notice"; text?: string; title?: string; body?: string };

type State = {
  toast: WalletToast | null;
  /** .show is added a frame after mounting so the toast slides in, and removed 200ms before it unmounts. */
  shown: boolean;
  showToast: (text: string, ms?: number) => void;
  showNotice: (title: string, body: string, ms?: number) => void;
};

let t1: ReturnType<typeof setTimeout> | undefined, t2: ReturnType<typeof setTimeout> | undefined, n = 0;

export const useWalletToast = create<State>((set) => {
  const show = (toast: Omit<WalletToast, "id">, ms = 2200) => {
    clearTimeout(t1); clearTimeout(t2);
    set({ toast: { ...toast, id: ++n }, shown: false });
    requestAnimationFrame(() => set({ shown: true }));
    t1 = setTimeout(() => {
      set({ shown: false });
      t2 = setTimeout(() => set({ toast: null }), 200);
    }, ms);
  };
  return {
    toast: null, shown: false,
    showToast: (text, ms) => show({ text, top: false }, ms),
    showNotice: (title, body, ms) => show({ title, body, top: true, variant: "notice" }, ms),
  };
});
