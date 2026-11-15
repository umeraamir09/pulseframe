import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { initData } from "../../data/db";
import { Icon } from "../../ui/Icon";
import { guideDriving, useGuide } from "./guideStore";
import { Mascot } from "./Mascot";
import { preloadMascot } from "./mascotModels";
import { BUBBLE_WIDTH, MASCOT_SIZE, SPOT_PAD, arcPoint, easeInOutCubic, motion, placeGuide, prefersReducedMotion, type Rect } from "./motion";
import { advanceGuide, dockBox, dockPoint, maybeAutoStart, pickerBox, registerNavigate, skipGuide, startScenario, toggleMute, togglePause } from "./runner";
import { SCENARIOS, SCENARIO_ORDER } from "./scenarios";

const POINTER_PATH = "M4 2V22L9.5 17L13 25.5L16.5 24L13 15.8L20.5 15.5L4 2Z";
const HOP_MS = 420;
const RIPPLE_MS = 650;

/** Small inline icons the shared icon set does not have. */
export function SoundIcon({ muted, size = 16 }: { muted: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
    </svg>
  );
}

export function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l12-7.5-12-7.5Z" />
    </svg>
  );
}

function inflate(r: DOMRect): Rect {
  return { x: r.left - SPOT_PAD, y: r.top - SPOT_PAD, w: r.width + SPOT_PAD * 2, h: r.height + SPOT_PAD * 2 };
}

/** Pause, skip and mute. Marked so the click blocker lets them through. */
function Controls({ inBubble }: { inBubble?: boolean }) {
  const paused = useGuide((s) => s.paused);
  const muted = useGuide((s) => s.muted);
  return (
    <div className={`guide-controls${inBubble ? " in-bubble" : ""}`} data-guide-control="">
      <button type="button" className="guide-pill" data-guide-control="" onClick={togglePause} aria-pressed={paused}>
        {paused ? <PlayIcon size={14} /> : <Icon name="pause" size={14} />}
        {paused ? "Resume" : "Pause"}
      </button>
      <button type="button" className="guide-pill icon" data-guide-control="" onClick={toggleMute} aria-label={muted ? "Sound on" : "Mute"} aria-pressed={muted}>
        <SoundIcon muted={muted} size={16} />
      </button>
      <button type="button" className="guide-pill" data-guide-control="" onClick={skipGuide}>
        Skip demo
      </button>
    </div>
  );
}

function Banner() {
  const status = useGuide((s) => s.status);
  const scenarioId = useGuide((s) => s.scenarioId);
  const paused = useGuide((s) => s.paused);
  const title = status === "picking" ? "Pick a practice emergency" : SCENARIOS[scenarioId].title;
  return (
    <div className="guide-banner" role="region" aria-label="Demo">
      <span className="guide-chip">DEMO</span>
      <p className="guide-banner-label">
        Demo: {title} · {paused ? "paused" : "the guide is driving"}
      </p>
      <p className="guide-banner-note">Practice data only. It is wiped when the demo ends.</p>
      <Controls />
    </div>
  );
}

function Picker() {
  const preferred = useGuide((s) => s.scenarioId);
  const line = useGuide((s) => s.line);
  return (
    <div className="guide-picker" role="dialog" aria-modal="true" aria-labelledby="guide-picker-title" data-guide-control="">
      <div className="guide-picker-hero">
        <div className="guide-picker-mascot" data-guide-picker-slot="" aria-hidden="true" />
        <div className="guide-picker-hello">
          <p className="guide-overline">PRACTICE MODE</p>
          <h2 id="guide-picker-title">{line}</h2>
          <p className="muted">Take your time. I do every step myself, and you press Next when you are ready for more.</p>
        </div>
      </div>
      <div className="guide-picker-list">
        {SCENARIO_ORDER.map((id) => {
          const s = SCENARIOS[id];
          return (
            <button
              key={id}
              type="button"
              className={`guide-scenario${id === preferred ? " preferred" : ""}`}
              data-guide-scenario={id}
              data-guide-control=""
              onClick={() => startScenario(id)}
            >
              <span className="t">{s.title}</span>
              <span className="d">{s.blurb}</span>
              <span className="go" aria-hidden="true">
                {id === preferred ? <span className="guide-chip">Main tour</span> : null}
                <Icon name="arrowR" size={20} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="guide-picker-foot">
        <span className="muted small">Practice data only. I wipe it all when we finish.</span>
        <button type="button" className="guide-pill" data-guide-control="" onClick={skipGuide}>
          Not now
        </button>
      </div>
    </div>
  );
}

function Bubble({ innerRef }: { innerRef: React.Ref<HTMLDivElement> }) {
  const scenarioId = useGuide((s) => s.scenarioId);
  const line = useGuide((s) => s.line);
  const lineKey = useGuide((s) => s.lineKey);
  const scene = useGuide((s) => s.scene);
  const count = useGuide((s) => s.sceneCount);
  const waiting = useGuide((s) => s.awaitingNext);
  const label = useGuide((s) => s.nextLabel);
  const paused = useGuide((s) => s.paused);
  const status = useGuide((s) => s.status);
  return (
    <div ref={innerRef} className="guide-bubble" data-guide-control="" aria-live="polite">
      <div className="guide-bubble-head">
        <p className="guide-overline">{SCENARIOS[scenarioId].kicker}</p>
        <span className="guide-scene">
          Scene {scene} of {count}
        </span>
      </div>
      <p key={lineKey} className="guide-line">
        {line}
      </p>
      <div className="guide-progress" aria-hidden="true">
        <span style={{ width: `${count ? (scene / count) * 100 : 0}%` }} />
      </div>
      <div className="guide-bubble-foot">
        <Controls inBubble />
        {status === "running" ? (
          <button
            type="button"
            className={`guide-next${waiting && !paused ? " ready" : ""}`}
            data-guide-control=""
            disabled={!waiting || paused}
            onClick={advanceGuide}
          >
            {waiting ? (
              <>
                {label} <Icon name="arrowR" size={18} />
              </>
            ) : (
              <span className="guide-working">
                <i />
                <i />
                <i />
                <span className="sr">Pulse is working</span>
              </span>
            )}
          </button>
        ) : null}
      </div>
      {status === "running" ? (
        <p className="guide-keys" aria-hidden="true">
          {waiting ? (
            <>
              Press <kbd>Enter</kbd> or <kbd>→</kbd> for the next step
            </>
          ) : (
            "Watch me. I'll stop when it's your turn to read."
          )}
        </p>
      ) : null}
    </div>
  );
}

/** Stable 0 to 1 scatter per confetti piece, so renders stay pure. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Confetti() {
  const at = useGuide((s) => s.confettiAt);
  const status = useGuide((s) => s.status);
  if (!at || status !== "done" || motion.reduced) return null;
  const origin = dockPoint();
  const colors = ["#1f5eff", "#12b76a", "#f59e0b", "#e5383b", "#8ab4ff"];
  return (
    <div key={at} className="guide-confetti" style={{ left: origin.x + MASCOT_SIZE / 2, top: origin.y + 20 }} aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => {
        const angle = -Math.PI / 2 + (jitter(i, 1) - 0.5) * 2.2;
        const dist = 120 + jitter(i, 2) * 220;
        const style = {
          "--dx": `${Math.cos(angle) * dist}px`,
          "--dy": `${Math.sin(angle) * dist}px`,
          "--rot": `${Math.round(jitter(i, 3) * 720 - 360)}deg`,
          background: colors[i % colors.length],
          animationDelay: `${jitter(i, 4) * 120}ms`,
        } as CSSProperties;
        return <i key={i} style={style} />;
      })}
    </div>
  );
}

/**
 * Everything Pulse draws over the app: banner, spotlight tint, click blocker, cursor, mascot,
 * bubble, picker, wipe and confetti. Positions are written straight to the DOM every frame.
 */
export function GuideLayer() {
  const navigate = useNavigate();
  const status = useGuide((s) => s.status);
  const pose = useGuide((s) => s.pose);
  const wipeAt = useGuide((s) => s.wipeAt);
  const driving = guideDriving(status);

  const cursorRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const mascotInnerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);

  useEffect(() => registerNavigate((to) => navigate(to)), [navigate]);

  useEffect(() => {
    motion.reduced = prefersReducedMotion();
    void initData().then(() => maybeAutoStart());
  }, []);

  useEffect(() => {
    if (driving) preloadMascot();
    document.body.classList.toggle("guide-on", driving);
    return () => document.body.classList.remove("guide-on");
  }, [driving]);

  // Only Pause, Skip and Mute reach the crew while Pulse drives. Esc pauses.
  useEffect(() => {
    if (!driving) return;
    const isControl = (t: EventTarget | null) => t instanceof Element && t.closest("[data-guide-control]") !== null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
      const onControlButton = e.target instanceof HTMLButtonElement && isControl(e.target);
      if ((e.key === "ArrowRight" || (e.key === "Enter" && !onControlButton)) && useGuide.getState().awaitingNext) {
        e.preventDefault();
        e.stopPropagation();
        advanceGuide();
        return;
      }
      if (e.key === "Tab" || isControl(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onWheel = (e: Event) => {
      if (!isControl(e.target)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    window.addEventListener("touchmove", onWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("touchmove", onWheel, true);
    };
  }, [driving]);

  // The animation loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const st = useGuide.getState();
      const on = guideDriving(st.status);

      // Cursor along its arc.
      const f = motion.flight;
      if (f) {
        const t = Math.min(1, (now - f.t0) / f.dur);
        motion.cursor = arcPoint(f.from, f.ctrl, f.to, easeInOutCubic(t));
        if (t >= 1) {
          motion.flight = null;
          f.done();
        }
      }
      const small = vw < 700;
      const size = small ? 84 : MASCOT_SIZE;
      const bubbleW = Math.min(BUBBLE_WIDTH, vw - size - 32);
      const bubbleH = bubbleRef.current?.offsetHeight ?? 170;
      const focusEl = motion.focus && motion.focus.isConnected ? motion.focus : null;
      const place = placeGuide(focusEl ? inflate(focusEl.getBoundingClientRect()) : null, motion.cursor, vw, vh, bubbleW, bubbleH, size);
      motion.anchor = place.mascot;

      // Mascot: a flight, or gliding to its spot beside the focus, or sitting in the dock or picker.
      const mf = motion.mascotFlight;
      if (mf) {
        const t = Math.min(1, (now - mf.t0) / mf.dur);
        const to = mf.to();
        const e = easeInOutCubic(t);
        motion.mascot = {
          x: mf.from.x + (to.x - mf.from.x) * e,
          y: mf.from.y + (to.y - mf.from.y) * e - Math.sin(Math.PI * t) * mf.lift,
          s: mf.from.s + (to.s - mf.from.s) * e,
        };
        if (t >= 1) {
          motion.mascot = to;
          motion.mascotFlight = null;
          mf.done();
        }
      } else if (motion.mascotMode === "guide") {
        const k = motion.reduced ? 1 : 1 - Math.exp(-dt * 6);
        const m0 = motion.mascot;
        motion.mascot = { x: m0.x + (place.mascot.x - m0.x) * k, y: m0.y + (place.mascot.y - m0.y) * k, s: m0.s + (place.mascot.s - m0.s) * k };
      } else if (motion.mascotMode === "dock") {
        motion.mascot = dockBox();
      } else if (motion.mascotMode === "picker") {
        motion.mascot = pickerBox();
      }

      const cur = cursorRef.current;
      if (cur) {
        cur.style.opacity = on && motion.cursorVisible ? "1" : "0";
        cur.style.transform = `translate(${motion.cursor.x - 4}px, ${motion.cursor.y - 2}px)`;
      }
      const m = mascotRef.current;
      if (m) {
        const box = motion.mascot;
        m.style.transform = `translate(${Math.round(box.x)}px, ${Math.round(box.y)}px)`;
        m.style.width = m.style.height = `${Math.round(box.s)}px`;
        m.style.zIndex = on ? "9660" : "60";
        const hop = now - motion.hopAt;
        const inner = mascotInnerRef.current;
        if (inner) {
          const lift = !motion.reduced && hop < HOP_MS ? Math.sin((Math.PI * hop) / HOP_MS) * 22 : 0;
          const flip = motion.mascotMode === "guide" && place.flip && !motion.mascotFlight ? -1 : 1;
          inner.style.transform = `translateY(${-lift}px) scaleX(${flip})`;
        }
      }
      const b = bubbleRef.current;
      if (b) {
        const show = on && st.status !== "picking" && motion.mascotMode === "guide";
        b.style.visibility = show ? "visible" : "hidden";
        b.style.width = `${bubbleW}px`;
        // The bubble follows the mascot as it glides, with its tail toward it.
        const bx = place.side === "right" ? motion.mascot.x + motion.mascot.s + 8 : motion.mascot.x - 8 - bubbleW;
        const by = place.bubble.y + (motion.mascot.y - place.mascot.y);
        b.dataset.side = place.side;
        b.style.transform = `translate(${Math.round(Math.max(8, Math.min(vw - bubbleW - 8, bx)))}px, ${Math.round(Math.max(8, Math.min(vh - bubbleH - 8, by)))}px)`;
      }

      // Spotlight: ease the hole toward the focused element, or close it.
      const spot = spotRef.current;
      const ring = ringRef.current;
      if (spot && ring) {
        const el = motion.focus && motion.focus.isConnected ? motion.focus : null;
        const target: Rect | null = el ? inflate(el.getBoundingClientRect()) : null;
        const prev = motion.spot;
        const goal = target ?? (prev ? { x: prev.x + prev.w / 2, y: prev.y + prev.h / 2, w: 0, h: 0 } : { x: vw / 2, y: vh / 2, w: 0, h: 0 });
        const k = motion.reduced || !prev ? 1 : 1 - Math.exp(-dt * 14);
        const s = prev
          ? { x: prev.x + (goal.x - prev.x) * k, y: prev.y + (goal.y - prev.y) * k, w: prev.w + (goal.w - prev.w) * k, h: prev.h + (goal.h - prev.h) * k }
          : goal;
        motion.spot = s;
        const css = `translate(${s.x}px, ${s.y}px)`;
        spot.style.transform = css;
        spot.style.width = `${Math.max(0, s.w)}px`;
        spot.style.height = `${Math.max(0, s.h)}px`;
        ring.style.transform = css;
        ring.style.width = `${Math.max(0, s.w)}px`;
        ring.style.height = `${Math.max(0, s.h)}px`;
        ring.style.opacity = target && s.w > 4 ? "1" : "0";
      }
      const tag = tagRef.current;
      if (tag) {
        const el = motion.tag && motion.tag.isConnected ? motion.tag : null;
        if (el && on) {
          const r = el.getBoundingClientRect();
          tag.style.opacity = "1";
          tag.style.transform = `translate(${Math.round(r.right - 56)}px, ${Math.round(r.top - SPOT_PAD - 9)}px)`;
        } else tag.style.opacity = "0";
      }
      const rip = rippleRef.current;
      if (rip) {
        const r = motion.ripple;
        const age = r ? now - r.at : RIPPLE_MS;
        if (r && age < RIPPLE_MS) {
          const p = age / RIPPLE_MS;
          rip.style.opacity = String(1 - p);
          rip.style.transform = `translate(${r.x - 28}px, ${r.y - 28}px) scale(${0.5 + p * 0.7})`;
        } else rip.style.opacity = "0";
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onBlockerDown = (e: React.PointerEvent) => {
    // Pass clicks through to guide controls drawn under the blocker (the dock's Skip button).
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.closest("[data-guide-control]") && !el.closest(".guide-blocker"));
    e.preventDefault();
    const control = hit?.closest<HTMLElement>("button[data-guide-control], [data-guide-control] button");
    control?.click();
  };

  return createPortal(
    <div className={`guide-layer${driving ? " on" : ""}`}>
      {driving ? (
        <>
          <div ref={spotRef} className="guide-spot" aria-hidden="true" />
          <div ref={ringRef} className="guide-ring" aria-hidden="true" />
          <div className="guide-blocker" onPointerDown={onBlockerDown} aria-hidden="true" />
          <span ref={tagRef} className="guide-tag" aria-hidden="true">
            DEMO
          </span>
          <div ref={rippleRef} className="guide-ripple" aria-hidden="true" />
          <Banner />
          {status === "picking" ? <Picker /> : null}
          <Bubble innerRef={bubbleRef} />
          {status === "finishing" && wipeAt ? <div key={wipeAt} className="guide-wipe" aria-hidden="true" /> : null}
        </>
      ) : null}
      <div ref={mascotRef} className="guide-mascot" aria-hidden="true">
        <div ref={mascotInnerRef} className="guide-mascot-inner">
          <Mascot pose={driving ? pose : "wave"} />
        </div>
      </div>
      <div ref={cursorRef} className="guide-cursor" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d={POINTER_PATH} fill="#0F172A" stroke="white" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
      <Confetti />
    </div>,
    document.body,
  );
}
