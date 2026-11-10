"use client";
import { useEffect, useState } from "react";
import { CV_QUOTE_SECONDS } from "../convert/convertMath";

/**
 * The quote's countdown (the reference's 30 seconds, as on Convert's review): seconds left, and onExpire once it hits 0.
 * Used by Send's amount and review screens when the send converts.
 */
export function useQuoteTimer(quoteAt: number, expired: boolean, onExpire: () => void): number {
  const left = () => Math.max(0, CV_QUOTE_SECONDS - Math.floor((Date.now() - quoteAt) / 1000));
  const [secs, setSecs] = useState(left);
  useEffect(() => {
    if (expired) return;
    setSecs(left());
    const id = setInterval(() => { const l = left(); if (l <= 0) { clearInterval(id); onExpire(); return; } setSecs(l); }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteAt, expired]);
  return secs;
}
