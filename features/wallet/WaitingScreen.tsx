"use client";
import type { ReactNode } from "react";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";

/**
 * The wallet's waiting state: something is in progress on someone else's side (a bank's review, say). The subject's
 * graphic (a 48px flag) with a clock badge; a title and one line; a vertical tracker of the steps (done with a check,
 * the current one with what to expect under it, upcoming in grey; the wallet's brand colour for done and current);
 * then the actions. When `current` reaches steps.length every step is done and the badge turns to a check.
 *
 * Use it for other waiting states too (styles: .wait-* and .track* in styles/wallet-overrides.css).
 */
export type WaitStep = { label: string; /** Under the step while it's the current one. */ sub?: string };

export function WaitingScreen({ id, graphic, title, line, steps, current, children }: {
  id: string;
  /** The graphic's markup (a WICON flag). */
  graphic: string;
  title: string;
  line: string;
  steps: WaitStep[];
  /** The step in progress (0-based); steps.length when they're all done. */
  current: number;
  /** The actions. */
  children?: ReactNode;
}) {
  const complete = current >= steps.length;
  return (
    <div className="wait-screen" id={id}>
      <div className="wait-graphic" aria-hidden="true">
        {/* The flag's svg a direct child, to fill the circle */}
        <div className="wait-flag" dangerouslySetInnerHTML={{ __html: graphic }} />
        <span className={`wait-badge ${complete ? "done" : ""}`}><Raw html={complete ? WICON.check : WICON.clock} /></span>
      </div>
      <div className="step-title">{title}</div>
      <p className="step-sub">{line}</p>
      <ol className="track" aria-label="Progress">
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
      {children}
    </div>
  );
}
