"use client";
import { useEffect } from "react";
import { WICON, sizedIcon } from "@/lib/icons";
import { BackRow } from "./payout/parts";
import { useNotifications } from "./useNotifications";
import { useWalletNav } from "./useWalletNav";

/** The reference's extWhen(ts). */
function when(ts: number) {
  const d = new Date(ts), now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days < 1 && d.getDate() === now.getDate()) return time;
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" }) + ", " + time;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The reference's tNotifications. Opening it marks everything read (clears the bell's dot). */
export function NotificationsScreen() {
  const list = useNotifications((s) => s.list);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const back = useWalletNav((s) => s.back);
  useEffect(() => () => markAllRead(), [markAllRead]);
  return (
    <>
      <BackRow id="extBackHome" label="Wallet" onClick={back} />
      <div className="step-title">Notifications</div>
      {list.length ? (
        <div className="settings-list">
          {list.map((n) => (
            <div className="settings-row" data-notif={n.id} key={n.id} style={{ alignItems: "flex-start" }}>
              <span className="settings-row-ic" style={n.read ? { background: "var(--n-100)", color: "var(--txt3)" } : undefined}
                dangerouslySetInnerHTML={{ __html: sizedIcon(n.type === "payout" ? WICON.bank : WICON.info, 16) }} />
              <div className="settings-row-text">
                <div className="settings-row-title" style={{ display: "flex", justifyContent: "space-between", gap: "10px", ...(n.read ? { fontWeight: 500 } : {}) }}>
                  <span>{n.title}</span><span style={{ fontSize: "11px", fontWeight: 500, color: "var(--txt3)", whiteSpace: "nowrap" }}>{when(n.ts)}</span>
                </div>
                <div className="settings-row-sub" style={{ color: "var(--txt2)" }}>{n.desc}</div>
              </div>
              {!n.read && <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--brand-500)", flex: "none", marginTop: "6px" }} />}
            </div>
          ))}
        </div>
      ) : <p className="step-sub">No notifications yet.</p>}
    </>
  );
}
