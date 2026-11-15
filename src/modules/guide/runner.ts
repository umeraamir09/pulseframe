import { SIM_CREW, beginDemoData, endDemoData, store } from "../../data/db";
import { GuideAborted, createDriver, type Driver } from "./driver";
import { guideDriving, saveMuted, useGuide, type ScenarioId } from "./guideStore";
import { flyMascot, motion, prefersReducedMotion, type Box, type Pt } from "./motion";
import { DONE_LINE, PICKER_LINE, SCENARIOS, WIPE_LINE } from "./scenarios";
import { playSfx, preloadSfx, stopAllSfx } from "./sfx";

/**
 * Runs the guide demo: the picker (scene 1), the scenario scenes on practice data, then the wipe
 * and the flight home. Only Pause, Skip and Mute reach the crew while it runs.
 */
const SEEN_KEY = "pf-guide-seen";
const ERROR_LINE = "Something on screen did not load as I expected, so I'm ending the practice here.";

let navigateFn: (to: string) => void = (to) => {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
let run: AbortController | null = null;
let autoChecked = false;

export function registerNavigate(fn: (to: string) => void): void {
  navigateFn = fn;
}

function readSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: the tour may offer itself again next visit.
  }
}

/** The mascot box over a slot element (the sidebar dock or the picker), or null when none shows. */
function slotBox(selector: string): Box | null {
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const s = Math.min(r.width, r.height);
      return { x: r.left + (r.width - s) / 2, y: r.top + (r.height - s) / 2, s };
    }
  }
  return null;
}

/** Pulse's resting spot, or just off the bottom-left when no dock shows (phones without the dock in view). */
export function dockBox(): Box {
  return slotBox("[data-guide-dock-slot]") ?? { x: 24, y: window.innerHeight + 40, s: 96 };
}

export function pickerBox(): Box {
  return slotBox("[data-guide-picker-slot]") ?? dockBox();
}

/** @deprecated name kept for the confetti origin. */
export function dockPoint(): Pt {
  const b = dockBox();
  return { x: b.x, y: b.y };
}

function say(line: string): void {
  const st = useGuide.getState();
  st.set({ line, lineKey: st.lineKey + 1 });
  playSfx("bubble-pop");
}

/** Pulse hops to a new spot: the picker, or beside the focus once the demo runs. */
async function hopTo(mode: "picker" | "guide"): Promise<void> {
  motion.reduced = prefersReducedMotion();
  if (motion.mascotMode === mode) return;
  if (motion.mascotMode === "dock") motion.mascot = dockBox();
  playSfx("whoosh-out");
  await flyMascot(mode === "picker" ? pickerBox : () => motion.anchor, 1000);
  motion.mascotMode = mode;
}

async function returnToDock(): Promise<void> {
  motion.cursorVisible = false;
  motion.focus = null;
  motion.tag = null;
  playSfx("whoosh-in");
  await flyMascot(dockBox, 1100);
  motion.mascotMode = "dock";
  useGuide.getState().set({ pose: "wave" });
}

/** Opens the scenario picker (scene 1). It waits as long as the crew needs. */
export function openGuide(preferred: ScenarioId = "motion-sickness"): void {
  const st = useGuide.getState();
  if (guideDriving(st.status)) return;
  preloadSfx();
  st.set({
    status: "picking",
    scenarioId: preferred,
    scene: 1,
    sceneCount: SCENARIOS[preferred].scenes.length,
    paused: false,
    pose: "wave",
    awaitingNext: false,
  });
  say(PICKER_LINE);
  motion.focus = null;
  motion.tag = null;
  motion.cursorVisible = false;
  // Let the picker mount, then fly Pulse into it.
  requestAnimationFrame(() => void hopTo("picker"));
}

/** Starts a scenario on practice data. Called from the picker or the closing card. */
export function startScenario(id: ScenarioId): void {
  const st = useGuide.getState();
  if (st.status === "running" || st.status === "finishing") return;
  preloadSfx();
  run?.abort();
  run = new AbortController();
  const controller = run;
  const scenario = SCENARIOS[id];
  st.set({ status: "running", scenarioId: id, sceneCount: scenario.scenes.length, scene: 2, paused: false, awaitingNext: false, pose: "point" });
  const g = createDriver(controller.signal, navigateFn);

  void (async () => {
    let problem = false;
    try {
      motion.cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      motion.cursorVisible = true;
      await hopTo("guide");
      await beginDemoData();
      // Scene 1 is the picker; the last two are the wipe and the finish.
      for (let i = 1; i < scenario.scenes.length - 2; i++) {
        const scene = scenario.scenes[i]!;
        useGuide.getState().set({ scene: i + 1, pose: "point" });
        g.say(scene.line);
        await scene.run?.(g);
        await g.next(i === scenario.scenes.length - 3 ? "Finish practice" : "Next");
      }
    } catch (err) {
      if (!(err instanceof GuideAborted)) {
        problem = true;
        console.warn("[guide]", err);
      }
    }
    if (run === controller) run = null;
    await finish(id, problem);
  })();
}

/** Wipes the practice data, flies Pulse home and shows "Your turn". Runs even after a skip. */
async function finish(id: ScenarioId, problem: boolean): Promise<void> {
  const g: Driver = createDriver(new AbortController().signal, navigateFn);
  const count = SCENARIOS[id].scenes.length;
  useGuide.getState().set({ status: "finishing", scene: count - 1, pose: "wave", paused: false, awaitingNext: false });
  if (problem) {
    say(ERROR_LINE);
    await g.wait(3000);
  }
  say(WIPE_LINE);
  motion.focus = null;
  motion.tag = null;
  useGuide.getState().set({ wipeAt: performance.now() });
  try {
    await endDemoData();
  } catch (err) {
    console.warn("[guide] wipe failed; it runs again on the next load", err);
  }
  navigateFn("/");
  window.scrollTo({ top: 0 });
  await g.wait(2600);

  useGuide.getState().set({ scene: count });
  say(DONE_LINE);
  await returnToDock();
  markSeen();
  useGuide.getState().set({ status: "done", finished: id, confettiAt: performance.now() });
  playSfx("success-jingle");
}

/** Next: lets Pulse move on when it is waiting. */
export function advanceGuide(): void {
  const st = useGuide.getState();
  if (!st.awaitingNext || st.paused) return;
  playSfx("cursor-click");
  st.set({ awaitingNext: false });
}

/** Skip: closes the picker, or ends a running demo (the wipe still runs). */
export function skipGuide(): void {
  const st = useGuide.getState();
  if (st.status === "picking") {
    markSeen();
    st.set({ status: "idle", line: "", paused: false });
    void returnToDock();
    return;
  }
  if (st.status === "running") run?.abort();
}

export function togglePause(): void {
  const st = useGuide.getState();
  if (!guideDriving(st.status)) return;
  st.set({ paused: !st.paused });
}

export function toggleMute(): void {
  const st = useGuide.getState();
  const muted = !st.muted;
  st.set({ muted });
  saveMuted(muted);
  if (muted) stopAllSfx();
}

export function dismissFinish(): void {
  const st = useGuide.getState();
  if (st.status === "done") st.set({ status: "idle", line: "" });
}

/** Offers the tour on first launch, once the data is ready and when no real emergency is open. */
export async function maybeAutoStart(): Promise<void> {
  if (autoChecked) return;
  autoChecked = true;
  if (readSeen()) return;
  const open = await store.getOpenCase(SIM_CREW.id).catch(() => undefined);
  if (open || useGuide.getState().status !== "idle") return;
  openGuide();
}
