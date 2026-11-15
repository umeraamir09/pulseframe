import { useEffect, useState } from "react";

/** About how long the lead text takes to type out, whatever its length. */
export const TYPE_DURATION_MS = 900;
const TICK_MS = 16;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Reveals `text` a few characters per frame while `active`. Returns the visible
 * part and whether it has finished. Inactive, or with reduced motion, the full
 * text shows at once, so screen readers and static renders get it immediately.
 */
export function useTypewriter(text: string, active: boolean): { shown: string; done: boolean } {
  const animate = active && !reducedMotion();
  const [count, setCount] = useState(() => (animate ? 0 : text.length));

  useEffect(() => {
    if (!animate) return;
    const step = Math.max(1, Math.ceil(text.length / (TYPE_DURATION_MS / TICK_MS)));
    const timer = window.setInterval(() => {
      setCount((n) => {
        const next = Math.min(text.length, n + step);
        if (next >= text.length) window.clearInterval(timer);
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [animate, text]);

  const shown = animate ? text.slice(0, count) : text;
  return { shown, done: shown.length >= text.length };
}
