/**
 * Shared, mutable motion state for the guide overlay. The runner writes targets here; the overlay's
 * animation loop reads it every frame and writes element styles directly (no React render per frame).
 * The helpers at the bottom are pure so they can be unit tested.
 */
export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Square box for the mascot: top-left and side length. */
export interface Box {
  x: number;
  y: number;
  s: number;
}

interface Flight {
  from: Pt;
  ctrl: Pt;
  to: Pt;
  t0: number;
  dur: number;
  done: () => void;
}

interface MascotFlight {
  from: Box;
  /** Where it lands; read every frame because the dock, the picker or the focus may move. */
  to: () => Box;
  lift: number;
  t0: number;
  dur: number;
  done: () => void;
}

/** dock: resting in the sidebar. picker: large in the start popup. guide: beside the focus during the demo. */
export type MascotMode = "dock" | "picker" | "guide" | "flying";

export const motion = {
  /** Arrow tip of the guide cursor, in viewport px. */
  cursor: { x: -100, y: -100 } as Pt,
  cursorVisible: false,
  flight: null as Flight | null,

  mascotMode: "dock" as MascotMode,
  /** Where the mascot belongs beside the focus right now (set by the overlay loop). */
  anchor: { x: -200, y: -200, s: 0 } as Box,
  mascot: { x: -200, y: -200, s: 0 } as Box,
  mascotFlight: null as MascotFlight | null,
  /** Wall-clock start of the current spin, for the 3D scene. 0 = none. */
  spinAt: 0,

  /** Element under the spotlight. null tints the whole screen. */
  focus: null as Element | null,
  /** Element that gets a DEMO tag in its top-right corner. */
  tag: null as Element | null,
  /** Current spotlight hole, eased toward the focus every frame. */
  spot: null as Rect | null,

  ripple: null as { x: number; y: number; at: number } | null,
  /** Wall-clock time of the last click hop. */
  hopAt: 0,
  reduced: false,
};

export const MASCOT_SIZE = 132;
export const BUBBLE_WIDTH = 360;
/** Space kept around the focused element, as in the Figma spotlight (target plus 8 px). */
export const SPOT_PAD = 8;
/** Gap between the focus and the guide, and between the mascot and its bubble. */
export const GAP = 16;
/** Height kept clear at the top for the demo banner. */
export const TOP_SAFE = 76;

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Point on a quadratic Bézier curve. */
export function arcPoint(from: Pt, ctrl: Pt, to: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
  };
}

/** Control point that bows the path sideways (and a little upward) so moves read as smooth arcs. */
export function arcControl(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (dist < 1) return mid;
  const bow = Math.min(160, dist * 0.28);
  // Perpendicular, picked so the arc bulges upward.
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: mid.x + nx * bow, y: mid.y + ny * bow };
}

/** Calm cursor moves: long enough to follow with the eye. */
export function flightMs(from: Pt, to: Pt, reduced: boolean): number {
  if (reduced) return 0;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.round(Math.min(1400, Math.max(560, 460 + dist * 0.7)));
}

/** How long a passing line stays up when Pulse moves on by itself: enough to read it twice. */
export function readingMs(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.min(9000, Math.max(2800, 1600 + words * 380));
}

export type Side = "right" | "left";

export interface Placement {
  mascot: Box;
  bubble: Pt;
  /** Which side of the mascot the bubble sits on. */
  side: Side;
  /** Mirror the mascot so it faces the focus. */
  flip: boolean;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, hi < lo ? lo : v));

/**
 * Where Pulse and the bubble go: next to the focused element, never on top of it, and close to the
 * cursor. Tries right of the focus, then left, below and above; if none fits, the viewport corner
 * that covers the least of the focus.
 */
export function placeGuide(
  focus: Rect | null,
  tip: Pt,
  vw: number,
  vh: number,
  bubbleW: number,
  bubbleH: number,
  size = MASCOT_SIZE,
): Placement {
  const gw = size + 8 + bubbleW;
  const gh = Math.max(size, bubbleH);
  const minY = TOP_SAFE;
  const maxY = vh - gh - 12;
  const build = (x: number, y: number, side: Side): Placement & { rect: Rect } => {
    const mascotX = side === "right" ? x : x + bubbleW + 8;
    const bubbleX = side === "right" ? x + size + 8 : x;
    // The bubble lines up with the mascot's head.
    const my = y + Math.max(0, (gh - size) / 2);
    return {
      mascot: { x: mascotX, y: my, s: size },
      bubble: { x: bubbleX, y: y + Math.max(0, (gh - bubbleH) / 2) },
      side,
      flip: side === "left",
      rect: { x, y, w: gw, h: gh },
    };
  };
  const fits = (r: Rect) => r.x >= 8 && r.x + r.w <= vw - 8 && r.y >= minY && r.y + r.h <= vh - 8;

  if (!focus) {
    const side: Side = tip.x + 24 + gw > vw - 8 ? "left" : "right";
    const x = side === "right" ? tip.x + 24 : tip.x - 24 - gw;
    return strip(build(clamp(x, 8, vw - gw - 8), clamp(tip.y + 16, minY, maxY), side));
  }

  const f: Rect = { x: focus.x - 4, y: focus.y - 4, w: focus.w + 8, h: focus.h + 8 };
  const nearY = clamp(tip.y - gh / 2, minY, maxY);
  const nearX = clamp(tip.x - size / 2, 8, vw - gw - 8);
  const candidates = [
    build(f.x + f.w + GAP, nearY, "right"),
    build(f.x - GAP - gw, nearY, "left"),
    build(nearX, f.y + f.h + GAP, "right"),
    build(nearX, f.y - GAP - gh, "right"),
  ];
  const fit = candidates.find((c) => fits(c.rect) && !overlaps(c.rect, f));
  if (fit) return strip(fit);

  const corners = [
    build(vw - gw - 12, maxY, "left"),
    build(12, maxY, "right"),
    build(vw - gw - 12, minY, "left"),
    build(12, minY, "right"),
  ];
  corners.sort((a, b) => overlapArea(a.rect, f) - overlapArea(b.rect, f));
  return strip(corners[0]!);
}

function strip(p: Placement & { rect?: Rect }): Placement {
  return { mascot: p.mascot, bubble: p.bubble, side: p.side, flip: p.flip };
}

/** Animates the cursor tip along an arc. Resolves when it lands (at once with reduced motion). */
export function flyCursor(to: Pt): Promise<void> {
  const from = { ...motion.cursor };
  const dur = flightMs(from, to, motion.reduced || !motion.cursorVisible);
  motion.flight?.done();
  if (dur === 0) {
    motion.flight = null;
    motion.cursor = { ...to };
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    motion.flight = { from, ctrl: arcControl(from, to), to, t0: performance.now(), dur, done: resolve };
  });
}

/** Flies the mascot in a high hop (with a spin) from where it is to a moving target box. */
export function flyMascot(to: () => Box, dur = 1000): Promise<void> {
  motion.mascotFlight?.done();
  if (motion.reduced) {
    motion.mascotFlight = null;
    motion.mascot = to();
    return Promise.resolve();
  }
  motion.spinAt = performance.now();
  return new Promise((resolve) => {
    motion.mascotMode = "flying";
    motion.mascotFlight = { from: { ...motion.mascot }, to, lift: 160, t0: performance.now(), dur, done: resolve };
  });
}

export function ripple(at: Pt): void {
  if (motion.reduced) return;
  motion.ripple = { ...at, at: performance.now() };
}
