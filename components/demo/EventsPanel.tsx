"use client";
import { useEvents } from "@/store/events";

/** What the merchant receives from Poket (webhooks), newest first. Markup from the prototype's .events panel. */
export function EventsPanel({ host }: { host: string }) {
  const events = useEvents((s) => s.events);
  return (
    <aside className="events" aria-live="polite">
      <header><span>Events sent to {host}</span><small>what the host receives</small></header>
      <ol data-testid="events">
        {events.length === 0 ? <li className="empty">Nothing yet. Tap Pay with Poket.</li> : events.map((e) => (
          <li key={e.id}>
            <code className={/failed|canceled|blocked/.test(e.type) ? "bad" : ""}>{e.type}</code>
            <pre>{JSON.stringify(e.data)}</pre>
          </li>
        ))}
      </ol>
    </aside>
  );
}
