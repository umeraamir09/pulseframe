import { useGuide, type MascotPose } from "./guideStore";
import { flyCursor, motion, ripple, type Pt } from "./motion";
import { playSfx } from "./sfx";

/** Thrown inside a scene when the demo is skipped. */
export class GuideAborted extends Error {
  constructor() {
    super("Guide demo skipped");
  }
}

/**
 * A CSS selector, a selector plus visible text (and an optional container to search in),
 * or a function that returns the element.
 */
export type Target = string | { sel: string; text?: string | RegExp; within?: Target } | (() => Element | null | undefined);

export interface PointOptions {
  /** Element to spotlight instead of the target itself. `false` keeps the current spotlight. */
  focus?: Target | false;
  /** Put a DEMO tag on the spotlit element. */
  tag?: boolean;
  pose?: MascotPose;
}

const BANNER_SPACE = 84;

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

function textMatches(el: Element, text: string | RegExp): boolean {
  const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return typeof text === "string" ? t.includes(text) : text.test(t);
}

/** Resolves a target once, or returns null. Prefers visible elements. */
export function resolve(target: Target, root: ParentNode = document): HTMLElement | null {
  if (typeof target === "function") return (target() as HTMLElement | null | undefined) ?? null;
  if (typeof target === "string") {
    const all = [...root.querySelectorAll<HTMLElement>(target)];
    return all.find(isVisible) ?? null;
  }
  const scope = target.within ? resolve(target.within, root) : root;
  if (!scope) return null;
  const all = [...scope.querySelectorAll<HTMLElement>(target.sel)].filter(isVisible);
  return (target.text === undefined ? all[0] : all.find((el) => textMatches(el, target.text!))) ?? null;
}

/** Writes a value the way typing does, so React's onChange runs. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export interface Driver {
  signal: AbortSignal;
  wait(ms: number): Promise<void>;
  find(target: Target, timeoutMs?: number): Promise<HTMLElement>;
  /** Waits until `check` is true (polled), or fails after the timeout. */
  until(check: () => boolean, timeoutMs?: number): Promise<void>;
  say(line: string, pose?: MascotPose): void;
  /** Waits until the crew presses Next (button, Enter or the right arrow). */
  next(label?: string): Promise<void>;
  /** Same as next(): Pulse never moves on before the crew has read the line. */
  read(): Promise<void>;
  focus(target: Target | null, opts?: { tag?: boolean }): Promise<HTMLElement | null>;
  point(target: Target, opts?: PointOptions): Promise<HTMLElement>;
  click(target: Target, opts?: PointOptions & { sound?: boolean }): Promise<HTMLElement>;
  type(target: Target, text: string, opts?: PointOptions): Promise<HTMLElement>;
  nav(path: string): Promise<void>;
}

export function createDriver(signal: AbortSignal, navigate: (to: string) => void): Driver {

  const check = () => {
    if (signal.aborted) throw new GuideAborted();
  };

  /** Sleeps `ms` of unpaused time. */
  async function wait(ms: number): Promise<void> {
    let left = ms;
    let last = performance.now();
    while (left > 0) {
      check();
      await new Promise((r) => setTimeout(r, Math.min(50, Math.max(0, left))));
      const now = performance.now();
      if (!useGuide.getState().paused) left -= now - last;
      last = now;
    }
    check();
  }

  async function until(fn: () => boolean, timeoutMs = 8000): Promise<void> {
    const start = performance.now();
    while (!fn()) {
      if (performance.now() - start > timeoutMs) throw new Error("The guide timed out waiting for the screen.");
      await wait(80);
    }
  }

  async function next(label = "Next"): Promise<void> {
    check();
    useGuide.getState().set({ awaitingNext: true, nextLabel: label });
    try {
      await until(() => !useGuide.getState().awaitingNext, Number.POSITIVE_INFINITY);
    } finally {
      if (useGuide.getState().awaitingNext) useGuide.getState().set({ awaitingNext: false });
    }
  }

  async function find(target: Target, timeoutMs = 8000): Promise<HTMLElement> {
    let el: HTMLElement | null = null;
    await until(() => (el = resolve(target)) !== null, timeoutMs).catch((err: unknown) => {
      if (err instanceof GuideAborted) throw err;
      throw new Error(`The guide could not find ${typeof target === "string" ? target : JSON.stringify(target, (_k, v) => (v instanceof RegExp ? String(v) : v))}`);
    });
    return el!;
  }

  /** Scrolls so the element is on screen below the demo banner, then lets the scroll settle. */
  async function reveal(el: Element): Promise<void> {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.top >= BANNER_SPACE && r.bottom <= vh - 24) return;
    const tall = r.height > vh - BANNER_SPACE - 40;
    const dy = tall ? r.top - BANNER_SPACE - 8 : r.top + r.height / 2 - (BANNER_SPACE + vh) / 2;
    window.scrollBy({ top: dy, behavior: motion.reduced ? "auto" : "smooth" });
    await wait(motion.reduced ? 60 : 520);
  }

  function pose(p: MascotPose) {
    if (useGuide.getState().pose !== p) useGuide.getState().set({ pose: p });
  }

  async function focus(target: Target | null, opts: { tag?: boolean } = {}): Promise<HTMLElement | null> {
    check();
    if (!target) {
      motion.focus = null;
      motion.tag = null;
      return null;
    }
    const el = await find(target);
    await reveal(el);
    motion.focus = el;
    motion.tag = opts.tag ? el : null;
    return el;
  }

  function aim(el: Element): Pt {
    const r = el.getBoundingClientRect();
    // Small targets: the middle. Wide ones: a bit in from the left, where labels start.
    const x = r.width > 220 ? r.left + Math.min(r.width / 2, 120) : r.left + r.width / 2;
    return { x, y: r.top + Math.min(r.height / 2, 28) };
  }

  async function point(target: Target, opts: PointOptions = {}): Promise<HTMLElement> {
    const el = await find(target);
    if (opts.focus !== false) {
      const f = opts.focus ? await find(opts.focus) : el;
      await reveal(f);
      motion.focus = f;
      motion.tag = opts.tag ? f : null;
    }
    await reveal(el);
    pose(opts.pose ?? "point");
    if (!motion.cursorVisible) motion.cursorVisible = true;
    await flyCursor(aim(el));
    check();
    await wait(250);
    return el;
  }

  async function click(target: Target, opts: PointOptions & { sound?: boolean } = {}): Promise<HTMLElement> {
    const el = await point(target, opts);
    // Buttons can be disabled for a moment while the app saves.
    await until(() => !(el as HTMLButtonElement).disabled, 6000);
    await wait(320);
    ripple(motion.cursor);
    motion.hopAt = performance.now();
    if (opts.sound !== false) playSfx("cursor-click");
    el.click();
    await wait(800);
    return el;
  }

  async function type(target: Target, text: string, opts: PointOptions = {}): Promise<HTMLElement> {
    const el = (await point(target, { ...opts, pose: "type" })) as HTMLInputElement | HTMLTextAreaElement;
    await wait(360);
    ripple(motion.cursor);
    el.focus({ preventScroll: true });
    setNativeValue(el, "");
    const numeric = el instanceof HTMLInputElement && el.type === "number";
    let typed = "";
    for (const ch of text) {
      typed += ch;
      // A number field rejects "36." so only write values it can hold.
      if (!numeric || /^-?\d+(\.\d+)?$/.test(typed)) setNativeValue(el, typed);
      playSfx(typed.length % 2 ? "type-tick-1" : "type-tick-2");
      await wait(ch === " " ? 130 : 95 + Math.random() * 60);
    }
    if (el.value !== text) setNativeValue(el, text);
    await wait(600);
    return el;
  }

  async function nav(path: string): Promise<void> {
    check();
    if (window.location.pathname === path) return;
    const link =
      path === "/emergency"
        ? resolve(".emergency-btn")
        : (resolve(`.side-nav a[href="${path}"]`) ?? resolve(`.tab-bar a[href="${path}"]`));
    if (link) {
      await click(() => link, { focus: () => link });
    } else {
      navigate(path);
    }
    await until(() => window.location.pathname === path, 4000);
    window.scrollTo({ top: 0 });
    await wait(900);
  }

  return {
    signal,
    wait,
    find,
    until,
    say(line, p) {
      check();
      useGuide.getState().set({ line, lineKey: useGuide.getState().lineKey + 1, ...(p ? { pose: p } : {}) });
      playSfx("bubble-pop");
    },
    next,
    read: () => next(),
    focus,
    point,
    click,
    type,
    nav,
  };
}
