import { useState } from "react";
import { useLocation } from "react-router-dom";
import { guideDriving, useGuide } from "./guideStore";
import { motion } from "./motion";
import { openGuide, skipGuide } from "./runner";
import { DONE_LINE } from "./scenarios";
import { playSfx } from "./sfx";

/** Short, plain tips per page. Tapping Pulse shows the next one. */
const TIPS: Record<string, string[]> = {
  "/": ["The shaded band is your own normal, not an Earth average.", "Red cards need action. Tap Ack once you have checked them."],
  "/alerts": ["Red cards need action. Tap Ack once you have checked them.", "Why? shows the math and the readings I used."],
  "/emergency": ["Say what's happening in your own words. Short is fine.", "I never pick a dose. The flight surgeon does."],
  "/assistant": ["The assistant only answers from what's on board.", "Try find, then a medicine name."],
  "/checklist": ["Log your morning numbers to keep your normal up to date."],
  "/fitness": ["Exercise keeps bones and muscles strong in microgravity."],
  "/radiation": ["Read your dosimeter once a day. I keep the running total."],
  "/psych": ["Private notes stay on the station."],
};
const GENERAL = ["In a real emergency, press the red Emergency button.", "Replay me any time from here."];

function tipsFor(path: string): string[] {
  const key = Object.keys(TIPS).find((k) => k !== "/" && path.startsWith(k)) ?? (path === "/" ? "/" : undefined);
  return [...(key ? TIPS[key]! : []), ...GENERAL];
}

/**
 * Pulse's resting spot at the bottom of the sidebar (and above the tab bar on phones).
 * While the demo runs it shows a placeholder, Skip and the scene count.
 */
export function GuideDock({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const status = useGuide((s) => s.status);
  const scene = useGuide((s) => s.scene);
  const count = useGuide((s) => s.sceneCount);
  const { pathname } = useLocation();
  const [n, setN] = useState(0);
  const driving = guideDriving(status);
  const tips = tipsFor(pathname);
  const tip = status === "done" ? DONE_LINE : tips[n % tips.length];

  function poke() {
    if (driving) return;
    motion.hopAt = performance.now();
    playSfx("bubble-pop");
    setN((x) => x + 1);
  }

  return (
    <section className={`guide-dock ${variant}${driving ? " out" : ""}`} aria-label="Pulse, your guide">
      <div className="guide-dock-tip" aria-live="polite">
        <p className="guide-overline">{driving ? "GUIDE IS DRIVING" : "GUIDE TIP"}</p>
        <p>{driving ? "I am out on the screen running the demo. I come back here when it ends." : tip}</p>
      </div>
      <div className="guide-dock-row">
        <button
          type="button"
          className="guide-dock-slot"
          data-guide-dock-slot=""
          onClick={poke}
          disabled={driving}
          aria-label="Pulse. Tap for another tip"
        />
        <div className="guide-dock-side">
          {driving ? (
            <>
              <button type="button" className="guide-pill" data-guide-control="" onClick={skipGuide}>
                Skip demo
              </button>
              <span className="muted small">
                Scene {scene} of {count}
              </span>
            </>
          ) : (
            <>
              <button type="button" className="btn primary sm guide-replay" onClick={() => openGuide()}>
                Replay tour
              </button>
              <span className="muted small">Tap me for help</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
