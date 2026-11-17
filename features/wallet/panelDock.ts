import { create } from "zustand";

/**
 * The panel's dock: a slot between #panelBody and the tab bar (WalletShell). While an amount's keypad is open,
 * AmountField puts the screen's button and the keypad there, so they sit at the bottom of the panel, just above the
 * tab bar, and only what's above them scrolls.
 */
export const usePanelDock = create<{ el: HTMLElement | null }>(() => ({ el: null }));
/** WalletShell's ref for the slot (one stable function, so it's set once). */
export const setPanelDock = (el: HTMLDivElement | null) => usePanelDock.setState({ el });
