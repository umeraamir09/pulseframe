import { describe, expect, it } from "vitest";
import {
  BUBBLE_WIDTH,
  MASCOT_SIZE,
  TOP_SAFE,
  placeGuide,
  type Rect,
  arcControl,
  arcPoint,
  easeInOutCubic,
  flightMs,
  readingMs,
} from "./motion";

describe("easeInOutCubic", () => {
  it("hits its endpoints and midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it("increases monotonically", () => {
    let prev = easeInOutCubic(0);
    for (let i = 1; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("arcPoint", () => {
  const from = { x: 10, y: 20 };
  const ctrl = { x: 60, y: -40 };
  const to = { x: 200, y: 120 };

  it("starts at from and ends at to", () => {
    const a = arcPoint(from, ctrl, to, 0);
    const b = arcPoint(from, ctrl, to, 1);
    expect(a.x).toBeCloseTo(from.x);
    expect(a.y).toBeCloseTo(from.y);
    expect(b.x).toBeCloseTo(to.x);
    expect(b.y).toBeCloseTo(to.y);
  });
});

describe("arcControl", () => {
  it("bows a horizontal move upward", () => {
    const from = { x: 100, y: 300 };
    const to = { x: 500, y: 300 };
    const c = arcControl(from, to);
    expect(c.y).toBeLessThan(300);
    expect(c.x).toBeCloseTo(300);
  });

  it("bows upward for a right-to-left move too", () => {
    const c = arcControl({ x: 500, y: 300 }, { x: 100, y: 300 });
    expect(c.y).toBeLessThan(300);
  });

  it("returns the midpoint when from equals to", () => {
    expect(arcControl({ x: 40, y: 50 }, { x: 40, y: 50 })).toEqual({ x: 40, y: 50 });
  });
});

describe("flightMs", () => {
  const origin = { x: 0, y: 0 };

  it("is 0 with reduced motion", () => {
    expect(flightMs(origin, { x: 900, y: 900 }, true)).toBe(0);
  });

  it("stays within 560..1400", () => {
    for (const d of [0, 10, 100, 500, 1000, 5000, 100000]) {
      const ms = flightMs(origin, { x: d, y: 0 }, false);
      expect(ms).toBeGreaterThanOrEqual(560);
      expect(ms).toBeLessThanOrEqual(1400);
    }
  });

  it("is longer for longer distances", () => {
    const short = flightMs(origin, { x: 100, y: 0 }, false);
    const long = flightMs(origin, { x: 800, y: 0 }, false);
    expect(long).toBeGreaterThan(short);
  });
});

describe("readingMs", () => {
  it("clamps to 2800..9000", () => {
    expect(readingMs("")).toBe(2800);
    expect(readingMs("Hi")).toBe(2800);
    expect(readingMs(Array(200).fill("word").join(" "))).toBe(9000);
  });

  it("grows with word count", () => {
    const ten = readingMs(Array(10).fill("word").join(" "));
    const twenty = readingMs(Array(20).fill("word").join(" "));
    expect(twenty).toBeGreaterThan(ten);
  });
});

describe("placeGuide", () => {
  const vw = 1440;
  const vh = 960;
  const bw = 360;
  const bh = 180;
  const place = (focus: Rect | null, tip = { x: 700, y: 400 }) => placeGuide(focus, tip, vw, vh, bw, bh);
  const rects = (p: ReturnType<typeof placeGuide>): Rect[] => [
    { x: p.mascot.x, y: p.mascot.y, w: p.mascot.s, h: p.mascot.s },
    { x: p.bubble.x, y: p.bubble.y, w: bw, h: bh },
  ];
  const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const inside = (p: ReturnType<typeof placeGuide>) => {
    for (const r of rects(p)) {
      expect(r.x).toBeGreaterThanOrEqual(8);
      expect(r.x + r.w).toBeLessThanOrEqual(vw - 8);
      expect(r.y).toBeGreaterThanOrEqual(TOP_SAFE);
      expect(r.y + r.h).toBeLessThanOrEqual(vh - 8);
    }
  };

  it("goes right of a focus in the left half", () => {
    const focus = { x: 200, y: 300, w: 300, h: 200 };
    const p = place(focus, { x: 350, y: 400 });
    expect(p.side).toBe("right");
    expect(p.flip).toBe(false);
    for (const r of rects(p)) {
      expect(hit(r, focus)).toBe(false);
      expect(r.x).toBeGreaterThanOrEqual(focus.x + focus.w);
    }
    inside(p);
  });

  it("goes left of a focus in the right half", () => {
    const focus = { x: 940, y: 300, w: 300, h: 200 };
    const p = place(focus, { x: 1090, y: 400 });
    expect(p.side).toBe("left");
    expect(p.flip).toBe(true);
    for (const r of rects(p)) {
      expect(hit(r, focus)).toBe(false);
      expect(r.x + r.w).toBeLessThanOrEqual(focus.x);
    }
    inside(p);
  });

  it("goes below a full-width focus when there is room", () => {
    const focus = { x: 0, y: 100, w: vw, h: 300 };
    const p = place(focus, { x: 700, y: 250 });
    for (const r of rects(p)) {
      expect(hit(r, focus)).toBe(false);
      expect(r.y).toBeGreaterThanOrEqual(focus.y + focus.h);
    }
    inside(p);
  });

  it("falls back to a corner for a near-full-viewport focus", () => {
    const focus = { x: 10, y: 10, w: vw - 20, h: vh - 20 };
    const p = place(focus, { x: 700, y: 480 });
    for (const r of rects(p)) {
      expect(r.x).toBeGreaterThanOrEqual(8);
      expect(r.x + r.w).toBeLessThanOrEqual(vw - 8);
      expect(r.y + r.h).toBeLessThanOrEqual(vh - 8);
    }
  });

  it("never places anything above TOP_SAFE", () => {
    const foci: (Rect | null)[] = [
      null,
      { x: 200, y: 0, w: 300, h: 100 },
      { x: 0, y: 0, w: vw, h: 120 },
      { x: 600, y: 700, w: 300, h: 250 },
      { x: 10, y: 10, w: vw - 20, h: vh - 20 },
    ];
    for (const focus of foci) {
      for (const tip of [{ x: 20, y: 5 }, { x: 700, y: 400 }, { x: 1430, y: 950 }]) {
        for (const r of rects(place(focus, tip))) expect(r.y).toBeGreaterThanOrEqual(TOP_SAFE);
      }
    }
  });

  it("sits near the tip and inside the viewport with no focus", () => {
    const tip = { x: 500, y: 400 };
    const p = place(null, tip);
    inside(p);
    expect(Math.abs(p.mascot.x - tip.x)).toBeLessThan(MASCOT_SIZE + BUBBLE_WIDTH);
    expect(Math.abs(p.mascot.y - tip.y)).toBeLessThan(300);
    inside(place(null, { x: 1435, y: 955 }));
    inside(place(null, { x: 2, y: 2 }));
  });
});
