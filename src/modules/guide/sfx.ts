import { useGuide } from "./guideStore";

/** Kenney CC0 sounds in public/sfx (licenses in public/sfx/LICENSES.md). */
export type Sfx =
  | "cursor-click"
  | "type-tick-1"
  | "type-tick-2"
  | "whoosh-out"
  | "whoosh-in"
  | "bubble-pop"
  | "alert-chime"
  | "success-jingle"
  | "link-down"
  | "link-up";

const VOLUME: Partial<Record<Sfx, number>> = {
  "type-tick-1": 0.25,
  "type-tick-2": 0.25,
  "cursor-click": 0.5,
  "bubble-pop": 0.45,
  "whoosh-out": 0.5,
  "whoosh-in": 0.5,
  "alert-chime": 0.6,
  "success-jingle": 0.55,
};

const pools = new Map<Sfx, HTMLAudioElement[]>();
let ext: "ogg" | "mp3" | undefined;

function extension(): "ogg" | "mp3" {
  if (ext) return ext;
  try {
    ext = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "mp3";
  } catch {
    ext = "mp3";
  }
  return ext;
}

function make(name: Sfx): HTMLAudioElement {
  const a = new Audio(`/sfx/${name}.${extension()}`);
  a.preload = "auto";
  a.volume = VOLUME[name] ?? 0.5;
  return a;
}

/** Fetches every sound once so the first click is not silent. */
export function preloadSfx(): void {
  if (typeof Audio === "undefined") return;
  for (const name of Object.keys(VOLUME) as Sfx[]) {
    if (!pools.has(name)) pools.set(name, [make(name)]);
  }
  for (const name of ["link-down", "link-up"] as Sfx[]) if (!pools.has(name)) pools.set(name, [make(name)]);
}

/** Plays a sound unless muted. Overlapping plays (typing ticks) use a small pool. Never throws. */
export function playSfx(name: Sfx): void {
  if (typeof Audio === "undefined" || useGuide.getState().muted) return;
  try {
    const pool = pools.get(name) ?? [];
    let a = pool.find((x) => x.paused || x.ended);
    if (!a) {
      if (pool.length >= 4) return;
      a = make(name);
      pool.push(a);
      pools.set(name, pool);
    }
    a.currentTime = 0;
    // Autoplay rules can block sound before the first user gesture. The demo still runs.
    void a.play().catch(() => undefined);
  } catch {
    // No audio device or blocked: stay silent.
  }
}

export function stopAllSfx(): void {
  for (const pool of pools.values()) for (const a of pool) a.pause();
}
