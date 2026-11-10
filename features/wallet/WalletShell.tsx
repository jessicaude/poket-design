"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Raw } from "@/components/ui/Raw";
import { BELL_ICON, SETTINGS_ICON, TAB_ICON, WALLET_LOCKUP, WICON } from "@/lib/icons";
import { NgnBody } from "./ngn/NgnBody";
import { useWalletToast } from "./useWalletToast";

export type WalletTab = "home" | "card" | "activity";

const TABS: { id: WalletTab; btnId: string; label: string }[] = [
  { id: "home", btnId: "tabHome", label: "Wallet" },
  { id: "card", btnId: "tabCard", label: "Card" },
  { id: "activity", btnId: "tabActivity", label: "Activity" },
];

type Props = {
  /** styles/wallet.css (+ overrides) as text. Get it on the server with getWalletCss() from ./walletCss. */
  css: string;
  /** Selected tab. null renders the empty tab bar, as the reference does on onboarding screens. */
  tab?: WalletTab | null;
  onTab?: (tab: WalletTab) => void;
  onSettings?: () => void;
  /** Contents of #panelBody. Defaults to the current NGN screen (useNgn), empty when none is open. */
  children?: React.ReactNode;
};

/**
 * The wallet panel frame: markup from <template id="tplWallet"> and renderTabbar() in reference/poket-unified.html.
 * Like the reference's mountEngine(), it renders into a shadow root so the wallet stylesheet stays isolated
 * from prototype.css (they share class names such as .panel, .tabbar and .toast).
 */
export function WalletShell({ css, tab = "home", onTab, onSettings, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);

  useEffect(() => {
    const host = hostRef.current!;
    setRoot(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, []);

  return (
    <div ref={hostRef} id="walletHost">
      {root &&
        createPortal(
          <>
            <style>{css}</style>
            <div className="app-root">
              <div className="stage">
                <div className="panel-slot">
                  <div className="panel">
                    <div className="panel-head">
                      <div className="panel-brand">
                        <Raw html={WALLET_LOCKUP} />
                      </div>
                      <div className="panel-actions" id="panelActions">
                        <span className="panel-settings-btn" id="openNotifHeader" style={{ position: "relative", display: "none" }} aria-label="Notifications">
                          <Raw html={BELL_ICON} />
                          <span className="notif-dot" id="notifDot" style={{ display: "none" }} />
                        </span>
                        <span className="panel-settings-btn" id="openSettingsHeader" aria-label="Settings" onClick={onSettings}>
                          <Raw html={SETTINGS_ICON} />
                        </span>
                      </div>
                    </div>
                    <div className="panel-body" id="panelBody">
                      {children ?? <NgnBody />}
                    </div>
                    <div className="tabbar" id="tabbar">
                      {tab !== null &&
                        TABS.map((t) => (
                          <button key={t.id} className={`tab-item ${tab === t.id ? "on" : ""}`} id={t.btnId} onClick={() => onTab?.(t.id)}>
                            <Raw html={TAB_ICON[t.id]} />
                            {t.label}
                          </button>
                        ))}
                    </div>
                    <ToastWrap />
                  </div>
                </div>
              </div>
            </div>
          </>,
          root as unknown as Element,
        )}
    </div>
  );
}

/** #toastWrap with the current toast (showToast / showNotice markup from the reference). */
function ToastWrap() {
  const { toast, shown } = useWalletToast();
  return (
    <div className={`toast-wrap${toast?.top ? " top" : ""}`} id="toastWrap">
      {toast && (
        <div key={toast.id} className={`toast${toast.variant ? " " + toast.variant : ""}${shown ? " show" : ""}`} id="toastEl" role="status" aria-live="polite">
          {toast.variant === "notice" ? (
            <>
              <span className="notice-ic"><Raw html={WICON.alert} /></span>
              <span><div className="notice-title">{toast.title}</div><div className="notice-body">{toast.body}</div></span>
            </>
          ) : toast.text}
        </div>
      )}
    </div>
  );
}
