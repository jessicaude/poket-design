"use client";
import type { ReactNode } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";

/**
 * The wallet's waiting state: something is in progress on someone else's side (a bank's review, a recall, a dispute,
 * the ID check). The subject's graphic (a 48px flag, or an icon in a brand circle) with a clock badge; a title and
 * one line; a vertical tracker of the steps (done with a check, the current one with what to expect under it,
 * upcoming in grey; the wallet's brand colour for done and current); then the actions. When `current` reaches
 * steps.length every step is done and the badge turns to a check.
 *
 * Used by: account details under review (deposit/AccountSetup.tsx), a recall requested, a dispute submitted, and
 * "Checking your ID". Where the wait is shown on a transaction's detail, the tracker alone (`Tracker flat`) follows
 * its status. Styles: .wait-* and .track* in styles/wallet-overrides.css.
 */
export type WaitStep = { label: string; /** Under the step while it's the current one. */ sub?: string };

/** The steps, as a vertical tracker. `current`: the step in progress (0-based); steps.length when all are done. */
export function Tracker({ id, steps, current, flat }: { id?: string; steps: WaitStep[]; current: number; /** Inside a card: no border of its own. */ flat?: boolean }) {
  return (
    <ol className={`track ${flat ? "flat" : ""}`} id={id} aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li key={s.label} className={`track-step ${state}`} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="track-dot">{state === "done" && <Raw html={WICON.check} />}</span>
            <div className="track-text">
              <div className="track-label">{s.label}</div>
              {state === "current" && s.sub && <div className="track-sub">{s.sub}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function WaitingScreen({ id, graphic, icon, title, line, steps, current, children }: {
  id: string;
  /** The graphic's markup: a WICON flag, or (with `icon`) any icon, shown in a brand circle. */
  graphic: string;
  icon?: boolean;
  title: string;
  line?: string;
  steps: WaitStep[];
  /** The step in progress (0-based); steps.length when they're all done. */
  current: number;
  /** The actions (and anything else under the tracker). */
  children?: ReactNode;
}) {
  const complete = current >= steps.length;
  return (
    <div className="wait-screen" id={id}>
      <div className="wait-graphic" aria-hidden="true">
        {/* The graphic's svg a direct child, to fill (a flag) or centre in (an icon) the circle */}
        <div className={icon ? "wait-icon" : "wait-flag"} dangerouslySetInnerHTML={{ __html: graphic }} />
        <span className={`wait-badge ${complete ? "done" : ""}`}><Raw html={complete ? WICON.check : WICON.clock} /></span>
      </div>
      <div className="step-title">{title}</div>
      {line && <p className="step-sub">{line}</p>}
      <Tracker steps={steps} current={current} />
      {children}
    </div>
  );
}
