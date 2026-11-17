"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Raw } from "@/components/ui/Raw";
import { ACCT_ICON, ICON } from "@/lib/icons";
import { GEO_COUNTRY } from "@/lib/mock-api";
import { DIALS, flag } from "./identifier";

const SEARCH_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/**
 * The reference's openDialPicker: a sheet over the whole widget (`host`: Checkout's .wg, the wallet's .panel) with
 * search, the current code and the location's first. Escape or Close puts focus back on the code button.
 */
export function DialSheet({ host, selected, onPick, onClose }: { host: HTMLElement; selected: string; onPick: (name: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => search.current?.focus(), 30);
    list.current?.querySelector(".sheet-row.on")?.scrollIntoView({ block: "nearest" });
    return () => clearTimeout(t);
  }, []);

  const query = q.trim().toLowerCase();
  const suggested = [...new Set([selected, GEO_COUNTRY].filter(Boolean))];
  const match = DIALS.filter((d) => !query || d[0].toLowerCase().includes(query) || d[1].includes(query.replace(/^\+?/, "+")) || d[2].toLowerCase() === query);
  const sug = query ? [] : DIALS.filter((d) => suggested.includes(d[0]));
  const row = ([n, c, iso]: [string, string, string], group: string) => (
    <button type="button" key={group + n} className={`sheet-row ${n === selected ? "on" : ""}`} data-dial={n} onClick={() => onPick(n)}>
      <span className="flag">{flag(iso)}</span><span className="sr-name">{n}</span><span className="sr-code">{c}</span>
      {n === selected && <span className="sr-check"><Raw html={ACCT_ICON.check} /></span>}
    </button>
  );

  // In .su (display: contents) so the wallet's scoped copy of Checkout's styles reaches it
  return createPortal(
    <div className="su" style={{ display: "contents" }}>
      <div className="sheet" id="dialSheet" role="dialog" aria-label="Choose a country code" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
        <div className="sheet-head"><b>Country code</b><button type="button" className="icon-btn" id="dialClose" aria-label="Close" onClick={onClose}><Raw html={ICON.x.replace(/22/g, "16")} /></button></div>
        <div className="sheet-search"><Raw html={SEARCH_ICON} /><input ref={search} id="dialSearch" type="search" placeholder="Search country or code" aria-label="Search country or code" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="sheet-list" id="dialList" ref={list}>
          {sug.length > 0 && <><div className="sheet-group">Suggested</div>{sug.map((d) => row(d, "s"))}<div className="sheet-group">All countries</div></>}
          {match.length ? match.map((d) => row(d, "a")) : <p className="sheet-empty">No country matches “{query}”.</p>}
        </div>
      </div>
    </div>,
    host,
  );
}
