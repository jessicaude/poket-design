"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The amount keypad on demand (Send's amount screen, the daily limit): hidden until the amount is tapped; "Done",
 * or a click anywhere outside `ref` (in the wallet or outside it; composedPath() sees through the shadow root),
 * closes it. On click, not pointerdown: the tapped control acts first, then the keypad closes, so nothing moves
 * under the finger mid-tap.
 */
export function useKeypadOnDemand() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current || !e.composedPath().includes(ref.current)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return { open, setOpen, ref };
}
