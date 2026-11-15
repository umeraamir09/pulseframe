import { describe, expect, it } from "vitest";
import { DONE_LINE, PICKER_LINE, SCENARIOS, SCENARIO_ORDER, WIPE_LINE } from "./scenarios";

const all = Object.values(SCENARIOS);

/** Every piece of user-facing copy, labelled for failure messages. */
const copy: { label: string; text: string }[] = [
  { label: "PICKER_LINE", text: PICKER_LINE },
  { label: "WIPE_LINE", text: WIPE_LINE },
  { label: "DONE_LINE", text: DONE_LINE },
];
for (const s of all) {
  copy.push({ label: `${s.id} title`, text: s.title });
  copy.push({ label: `${s.id} kicker`, text: s.kicker });
  copy.push({ label: `${s.id} blurb`, text: s.blurb });
  copy.push({ label: `${s.id} minutes`, text: s.minutes });
  s.scenes.forEach((sc, i) => copy.push({ label: `${s.id} scene ${i + 1}`, text: sc.line }));
}

const UNIT = /\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|mL|g)\b/i;

describe("guide copy rules", () => {
  it("has copy to check", () => {
    expect(copy.length).toBeGreaterThan(30);
  });

  it("has no em or en dashes", () => {
    for (const { label, text } of copy) {
      expect(text, label).not.toMatch(/[–—]/);
    }
  });

  it("types no dose amounts", () => {
    for (const { label, text } of copy) {
      expect(text, label).not.toMatch(UNIT);
    }
  });

  it("only says 'dose' in the allowed phrases", () => {
    for (const { label, text } of copy) {
      const stripped = text.replace(/pick a dose/gi, "").replace(/never pick/gi, "");
      expect(stripped, label).not.toMatch(/dose/i);
    }
  });

  it("keeps every line at 140 characters or fewer", () => {
    for (const { label, text } of copy) {
      expect(text.length, `${label}: ${text}`).toBeLessThanOrEqual(140);
    }
  });
});

describe("scenario structure", () => {
  it.each(all.map((s) => [s.id, s] as const))("%s starts with the picker and ends with wipe and done", (_id, s) => {
    const n = s.scenes.length;
    expect(s.scenes[0].line).toBe(PICKER_LINE);
    expect(s.scenes[n - 2].line).toBe(WIPE_LINE);
    expect(s.scenes[n - 1].line).toBe(DONE_LINE);
  });

  it.each(all.map((s) => [s.id, s] as const))("%s has a run function only on middle scenes", (_id, s) => {
    const n = s.scenes.length;
    s.scenes.forEach((sc, i) => {
      if (i === 0 || i >= n - 2) expect(sc.run, `scene ${i + 1}`).toBeUndefined();
      else expect(typeof sc.run, `scene ${i + 1}`).toBe("function");
    });
  });

  it("lists every scenario exactly once in SCENARIO_ORDER", () => {
    expect([...SCENARIO_ORDER].sort()).toEqual(Object.keys(SCENARIOS).sort());
    expect(new Set(SCENARIO_ORDER).size).toBe(SCENARIO_ORDER.length);
  });

  it("gives each scenario an id matching its key", () => {
    for (const [key, s] of Object.entries(SCENARIOS)) expect(s.id).toBe(key);
  });

  it("has 19 scenes in the motion-sickness scenario", () => {
    expect(SCENARIOS["motion-sickness"].scenes).toHaveLength(19);
  });
});
