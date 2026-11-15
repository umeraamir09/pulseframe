import { playSfx } from "./sfx";
import { resolve, type Driver, type Target } from "./driver";
import type { ScenarioId } from "./guideStore";

/**
 * Practice scripts. Pulse leads: every line is first person, short and plain, and never asks the
 * crew to do anything. Typed numbers are placeholders marked as examples, or real values from
 * research/ (cited in src/data/demoSeed.ts). No dose is ever typed or read out.
 */
export interface Scene {
  line: string;
  run?: (g: Driver) => Promise<void>;
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  /** Uppercase label at the top of the bubble. */
  kicker: string;
  blurb: string;
  minutes: string;
  /** Scene 1 is the picker; the last two are the wipe and "Your turn" (run by the runner). */
  scenes: Scene[];
}

export const PICKER_LINE = "Hi, I'm Pulse. Pick a practice emergency and I'll show you how the station helps.";
export const WIPE_LINE = "That was practice. I'm wiping it now, so everything you see from here is really yours.";
export const DONE_LINE = "You're ready. In a real emergency, press the red button. Replay me any time.";

const section = (id: string) => `section[aria-labelledby="${id}"]`;
const button = (text: string | RegExp, within?: Target): Target => ({ sel: "button", text, within });

/** Today's checklist row for a template slug, e.g. "heart-rate". */
const checkRow = (label: string): Target => ({ sel: ".check-row", text: label });

// ---------------------------------------------------------------------------------------------
// Shared emergency moves

async function openEmergency(g: Driver): Promise<void> {
  await g.nav("/emergency");
  await g.find(section("situation-title"));
}

async function describe(g: Driver, narrative: string, started: "Just now" | "Under 1 h" | "Today"): Promise<void> {
  const card = section("situation-title");
  await g.type("#narrative", narrative, { focus: card, tag: true });
  await g.click({ sel: "button", text: started, within: '[aria-label="Started"]' }, { focus: card });
}

async function nextFromSituation(g: Driver): Promise<void> {
  await g.click(button("Next: pinpoint", section("situation-title")));
  await g.find(section("pinpoint-title"));
}

async function pinpoint(g: Driver, regions: string[]): Promise<void> {
  const area = () => document.querySelector(".viewport-card")?.closest(".em-col") ?? null;
  for (const r of regions) {
    await g.click({ sel: "button", text: new RegExp(`^${r}$`), within: ".region-pills" }, { focus: area });
    await g.wait(250);
  }
}

async function nextFromPinpoint(g: Driver): Promise<void> {
  await g.click(button("Next: check current info", section("pinpoint-title")));
  await g.find(button("Next: differential", section("check-title")));
}

async function nextFromCheck(g: Driver): Promise<void> {
  await g.click(button("Next: differential", section("check-title")));
  await g.find(section("diff-title"));
}

async function showRedBox(g: Driver): Promise<void> {
  await g.point(".em-redflags.is-act", { focus: ".em-redflags.is-act" });
}

const testsPanel = section("tests-title");

async function typeTest(g: Driver, title: string, value: string): Promise<void> {
  await g.type({ sel: `input[aria-label="${title}"]`, within: testsPanel }, value, { focus: testsPanel, tag: true });
  const save = document.querySelector(`button[aria-label="Save ${title}"]`) ? `Save ${title}` : `Mark ${title} done`;
  await g.click({ sel: `button[aria-label="${save}"]`, within: testsPanel }, { focus: testsPanel, tag: true });
  await g.wait(300);
}

async function toSteps(g: Driver): Promise<void> {
  await g.click(button("Next: steps", testsPanel), { focus: testsPanel });
  await g.find(section("steps-title"));
}

async function tick(g: Driver, title: string): Promise<void> {
  await g.click(`button[aria-label="Done: ${title}"]`, { focus: section("steps-title") });
  await g.wait(200);
}

async function toKit(g: Driver): Promise<void> {
  await g.click(button("Continue to kit", section("steps-title")));
  await g.find(section("kit-title"));
}

async function toSend(g: Driver): Promise<void> {
  await g.click(button("Next: send", section("kit-title")), { focus: section("kit-title") });
  await g.find(".handoff-card");
}

const handoffStatus = () => document.querySelector(".handoff-card [role=status]")?.textContent ?? "";

async function send(g: Driver): Promise<void> {
  await g.click(button("Send to flight surgeon", ".handoff-card"), { focus: ".handoff-card" });
  await g.until(() => /status: (queued|sending|failed|sent)/.test(handoffStatus()), 6000);
}

// ---------------------------------------------------------------------------------------------
// Main scenario: space motion sickness (about 3 minutes)

const motionSickness: Scenario = {
  id: "motion-sickness",
  title: "Space motion sickness",
  kicker: "SPACE MOTION SICKNESS",
  blurb: "The full tour: a normal week, an alert, the whole Emergency flow and the handoff. About 5 minutes.",
  minutes: "About 5 minutes",
  scenes: [
    { line: PICKER_LINE },
    {
      line: "This is a normal week in space. The shaded band is your own normal, not an Earth average.",
      async run(g) {
        await g.nav("/");
        await g.point('section[aria-label="Heart rate, morning trend"] .chips', {
          focus: 'section[aria-label="Heart rate, morning trend"]',
          tag: true,
        });
        await g.read();
        g.say("These are real in-flight numbers: heart rate about 63, blood pressure about 121/76, oxygen 97%.");
        await g.point(".metric-row", { focus: ".metric-row", tag: true });
      },
    },
    {
      line: "Each morning you log a few numbers. Today your heart rate is higher than usual.",
      async run(g) {
        await g.nav("/checklist");
        const vitals = section("grp-vitals");
        await g.point(checkRow("Morning heart rate"), { focus: vitals });
        await g.read();
        g.say("I'm typing this morning's heart rate: 78. It's an example value.", "type");
        await g.type({ sel: 'input[aria-label="Morning heart rate"]', within: checkRow("Morning heart rate") }, "78", { focus: vitals, tag: true });
        await g.click('button[aria-label="Save Morning heart rate"]', { focus: vitals, tag: true });
        await g.find(`${vitals} .alert-card`);
        playSfx("alert-chime");
        g.say("An alert just fired. Next I log the blood pressure: 118 over 75.", "type");
        await g.type('input[aria-label="Systolic"]', "118", { focus: vitals, tag: true });
        await g.type('input[aria-label="Diastolic"]', "75", { focus: vitals, tag: true });
        await g.click('button[aria-label="Save Blood pressure"]', { focus: vitals, tag: true });
      },
    },
    {
      line: "Pulseframe compares you to you. Far from your normal is Act. A bit off is Watch.",
      async run(g) {
        await g.point(`${section("grp-vitals")} .alert-card`, { tag: true });
        await g.read();
        g.say("Here is the same alert on the Alerts page. I'm opening Why? to show the math.");
        await g.nav("/alerts");
        const card = ".alert-pattern-grid .alert-card.act";
        await g.click(button("Why?", card), { focus: card, tag: true });
        await g.read();
        g.say("78 is far above this crew member's usual 63, so I mark it Act.");
        await g.point(section("scale-title"), { focus: section("scale-title") });
      },
    },
    {
      line: "If something feels wrong, press the red Emergency button. Say what's happening in your own words.",
      async run(g) {
        await openEmergency(g);
        await g.read();
        g.say("I'm typing what the crew member feels.", "type");
        await describe(g, "Nausea, vomited twice since waking. Feel dizzy.", "Today");
      },
    },
    {
      line: "Tap where it bothers you. You can pick more than one spot.",
      async run(g) {
        await nextFromSituation(g);
        await pinpoint(g, ["Head", "Abdomen"]);
      },
    },
    {
      line: "I check the latest numbers against your normal. Red means look closer.",
      async run(g) {
        await nextFromPinpoint(g);
        const check = section("check-title");
        await g.point(`${check} .vital-card`, { focus: check });
      },
    },
    {
      line: "These are possible causes, not a diagnosis.",
      async run(g) {
        await nextFromCheck(g);
        const diff = section("diff-title");
        await g.click(button("Why?", { sel: ".diff-card", text: "Space motion sickness" }), { focus: diff });
        await g.read();
        g.say("If anything in the red box is true, act right away.");
        await showRedBox(g);
      },
    },
    {
      line: "Stay strapped in while you measure. I'll fill in each check.",
      async run(g) {
        await g.click(button("Next: tests", section("diff-title")), { focus: section("diff-title") });
        await g.find(testsPanel);
        await typeTest(g, "Sickness grade", "Moderate");
        await typeTest(g, "Vomiting count", "2");
        g.say("I'm typing the heart rate from the monitor: 96. Stay strapped in while you measure.", "type");
        await typeTest(g, "Heart rate", "96");
        await g.read();
        g.say("Blood pressure and temperature. These are example values.", "type");
        await typeTest(g, "Systolic blood pressure", "118");
        await typeTest(g, "Diastolic blood pressure", "75");
        await typeTest(g, "Body temperature", "36.7");
      },
    },
    {
      line: "Now the steps. I tick each one as it's done.",
      async run(g) {
        await toSteps(g);
        await tick(g, "Restrain your body and keep your head still");
        await tick(g, "Close your eyes or focus on one task");
        await tick(g, "Sip fluids");
        g.say("Hold any spacewalk until the flight surgeon says it's OK.");
        await tick(g, "Do not start an EVA or critical task");
      },
    },
    {
      line: "These are the kit items the card names. I never pick a dose. The flight surgeon does.",
      async run(g) {
        await toKit(g);
        await g.point(`${section("kit-title")} .kit-card`, { focus: section("kit-title") });
      },
    },
    {
      line: "The assistant only answers from what's on board.",
      async run(g) {
        await g.nav("/assistant");
        const box = 'section[aria-label="Ask the assistant"]';
        await g.type('input[aria-label="Assistant command"]', "find meclizine", { focus: box, tag: true });
        await g.click('button[aria-label="Send command"]', { focus: box });
        const hit = await g.find({ sel: ".kit-card, li, article", text: /Meclizine/ });
        await g.read();
        g.say("Meclizine is in pack A2, with 20 on board.");
        await g.point(() => hit, { focus: () => hit.closest("li, article, section") ?? hit });
      },
    },
    {
      line: "One tap packs up the whole case.",
      async run(g) {
        await openEmergency(g).catch(() => g.nav("/emergency"));
        if (resolve(button("Next: send", section("kit-title")))) await toSend(g);
        const card = await g.find(".handoff-card");
        g.say("Let's say the link to Earth is down right now.");
        await g.click('button[aria-label="Earth link"]', { focus: () => card, sound: false });
        playSfx("link-down");
        await g.read();
        g.say("One tap packs up the whole case.");
        await send(g);
      },
    },
    {
      line: "No link? No problem. The case waits here and sends itself when the link is back.",
      async run(g) {
        const card = ".handoff-card";
        await g.point(`${card} [role=status]`, { focus: card });
        await g.read();
        g.say("Now the link is back.");
        await g.click('button[aria-label="Earth link"]', { focus: card, sound: false });
        playSfx("link-up");
        await g.until(() => /status: sent/.test(handoffStatus()), 25000);
        g.say("Sent. From Mars it would take 3 to 22 minutes to arrive.");
        await g.point(`${card} [role=status]`, { focus: card });
      },
    },
    {
      line: "Your daily list keeps your normal up to date.",
      async run(g) {
        await g.nav("/checklist");
        await g.point('section[aria-label="Progress"] .seg-progress', { focus: 'section[aria-label="Progress"]' });
        await g.read();
        g.say("This morning's heart rate is saved here, and it now counts toward your normal.");
        await g.point(checkRow("Morning heart rate"), { focus: section("grp-vitals"), tag: true });
      },
    },
    {
      line: "Read your dosimeter once a day. I'll keep the running total.",
      async run(g) {
        await g.nav("/radiation");
        const readings = section("readings-title");
        await g.click(button("Add reading", readings), { focus: readings });
        g.say("I'm typing 6.3 micrograys an hour. That's about 151 a day, a normal ISS day.", "type");
        await g.type('input[aria-label="Dose rate"]', "6.3", { focus: readings, tag: true });
        await g.click(button("Save reading", readings), { focus: readings, tag: true });
        await g.find(`${readings} [role=status]`);
      },
    },
    {
      line: "A quick check on how you feel. Private notes stay on the station.",
      async run(g) {
        await g.nav("/psych");
        const card = section("checkin-title");
        await g.focus(card);
        await g.read();
        g.say("I'm picking example scores.");
        for (const [label, n] of [
          ["Mood", 4],
          ["Sleep quality", 4],
          ["Stress", 2],
          ["Team strain", 2],
        ] as const) {
          await g.click(`[role="radiogroup"][aria-label="${label}"] button[aria-label="${n} of 5"]`, { focus: card, tag: true });
        }
        g.say("A private note stays on the station. It never goes to Earth.", "type");
        await g.type("#psych-note", "Example note: better after resting.", { focus: section("note-title"), tag: true });
        await g.click(button("Save check-in"), { focus: card });
        await g.find(`${card} [role=status]`);
      },
    },
    { line: WIPE_LINE },
    { line: DONE_LINE },
  ],
};

// ---------------------------------------------------------------------------------------------
// Choking (shorter)

const choking: Scenario = {
  id: "choking",
  title: "Choking",
  kicker: "CHOKING",
  blurb: "Fast airway steps. In space, brace first. About 3 minutes.",
  minutes: "About 3 minutes",
  scenes: [
    { line: PICKER_LINE },
    {
      line: "Choking needs speed. I press Emergency and say it in a few words.",
      async run(g) {
        await openEmergency(g);
        await describe(g, "Choking on food, can't speak.", "Just now");
      },
    },
    {
      line: "I tap the head, where the airway is.",
      async run(g) {
        await nextFromSituation(g);
        await pinpoint(g, ["Head"]);
      },
    },
    {
      line: "Can't speak, cough or breathe is in the red box. That means act right away.",
      async run(g) {
        await nextFromPinpoint(g);
        await nextFromCheck(g);
        await showRedBox(g);
      },
    },
    {
      line: "First check: can they speak or cough? Here the answer is no.",
      async run(g) {
        await g.click(button("Next: tests", section("diff-title")));
        await g.find(testsPanel);
        await typeTest(g, "Can they speak or cough?", "No");
      },
    },
    {
      line: "In space, brace first. Wedge your feet or back so the thrusts move them, not you.",
      async run(g) {
        await toSteps(g);
        await tick(g, "Ask if they are choking");
        await tick(g, "If they cannot speak or breathe, call the crew");
        await tick(g, "Brace yourself behind them");
        await tick(g, "Give thrusts");
        await tick(g, "After the object comes out");
      },
    },
    {
      line: "Once the airway is clear, I check oxygen and pulse. These are example values.",
      async run(g) {
        await g.click({ sel: ".stage-strip button", text: "Tests" });
        await typeTest(g, "Oxygen level after the airway is clear", "97");
        await typeTest(g, "Pulse after the airway is clear", "88");
        await g.click(button("Back to the current stage"));
      },
    },
    {
      line: "One tap sends the whole case to the flight surgeon.",
      async run(g) {
        await toKit(g);
        await toSend(g);
        await send(g);
        await g.until(() => /status: sent/.test(handoffStatus()), 20000);
      },
    },
    { line: WIPE_LINE },
    { line: DONE_LINE },
  ],
};

// ---------------------------------------------------------------------------------------------
// Smoke or burns (shorter)

const smokeBurns: Scenario = {
  id: "smoke-burns",
  title: "Smoke or burns",
  kicker: "SMOKE OR BURNS",
  blurb: "Mask on first, then the app. About 3 minutes.",
  minutes: "About 3 minutes",
  scenes: [
    { line: PICKER_LINE },
    {
      line: "Mask on first. Then I press Emergency and say what happened.",
      async run(g) {
        await openEmergency(g);
        await describe(g, "Small fire at a panel, smoke, burned right hand.", "Just now");
      },
    },
    {
      line: "I tap the right arm and the skin.",
      async run(g) {
        await nextFromSituation(g);
        await pinpoint(g, ["R arm", "Skin"]);
      },
    },
    {
      line: "Soot around the mouth or trouble breathing is in the red box. That means act right away.",
      async run(g) {
        await nextFromPinpoint(g);
        await nextFromCheck(g);
        await showRedBox(g);
      },
    },
    {
      line: "Oxygen reads 98 here. After smoke, don't trust a normal oxygen reading.",
      async run(g) {
        await g.click(button("Next: tests", section("diff-title")));
        await g.find(testsPanel);
        await typeTest(g, "Oxygen level", "98");
        await g.read();
        g.say("I note the burn size. It's an example.", "type");
        await typeTest(g, "Burn size", "Smaller than a palm");
      },
    },
    {
      line: "Mask first, get out of the smoke, then cool and cover the burn.",
      async run(g) {
        await toSteps(g);
        await tick(g, "Fire or smoke: put on your mask first");
        await tick(g, "Get the person out of the smoke");
        await tick(g, "Do not trust a normal oxygen reading");
        await tick(g, "Cool the burn");
        await tick(g, "Cover the burn");
      },
    },
    {
      line: "These kit items match the card. I never pick a dose. The flight surgeon does.",
      async run(g) {
        await toKit(g);
        await g.point(`${section("kit-title")} .kit-card`, { focus: section("kit-title") });
      },
    },
    {
      line: "One tap sends the whole case to the flight surgeon.",
      async run(g) {
        await toSend(g);
        await send(g);
        await g.until(() => /status: sent/.test(handoffStatus()), 20000);
      },
    },
    { line: WIPE_LINE },
    { line: DONE_LINE },
  ],
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  "motion-sickness": motionSickness,
  choking,
  "smoke-burns": smokeBurns,
};

export const SCENARIO_ORDER: ScenarioId[] = ["motion-sickness", "choking", "smoke-burns"];
