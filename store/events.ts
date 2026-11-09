import { create } from "zustand";

/** Events Poket sends to the merchant (webhooks), newest first. Shown in the demo page's events panel. */
export type PoketEvent = { id: string; type: string; data: Record<string, unknown> };

type EventsState = { events: PoketEvent[]; hostReference: string; emit: (type: string, data?: Record<string, unknown>) => void; clear: () => void };

export const useEvents = create<EventsState>((set, get) => ({
  events: [],
  hostReference: "ILV-10482",
  emit: (type, data = {}) =>
    set((s) => ({ events: [{ id: crypto.randomUUID(), type, data: { host_reference: get().hostReference, ...data } }, ...s.events] })),
  clear: () => set({ events: [] }),
}));
