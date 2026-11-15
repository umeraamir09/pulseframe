/**
 * How to use Pulseframe, written from the real routes (App.tsx) and the page components.
 * The assistant answers "how do I ..." from this file. It is not medical research.
 */
export const APP_ROUTE_PATHS = [
  "/",
  "/alerts",
  "/emergency",
  "/checklist",
  "/fitness",
  "/radiation",
  "/psych",
  "/assistant",
  "/sources",
] as const;

export type AppRoutePath = (typeof APP_ROUTE_PATHS)[number];

export interface AppGuideEntry {
  id: string;
  title: string;
  path?: AppRoutePath;
  about: string;
  steps: string[];
  /** Distinctive phrases. Multi-word phrases count more when matching a question. */
  keywords: string[];
}

export const APP_GUIDE: AppGuideEntry[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    path: "/",
    about: "The dashboard is the home page. It shows this week's simulated crew status at a glance.",
    steps: [
      "Open Dashboard from the side menu, or Home on a phone.",
      "Open alerts sit on the left. Act alerts are listed before Watch alerts. Ack on a card marks it seen.",
      "Today shows checklist, fitness, and psych progress. Each row opens that page.",
      "The charts cover heart rate and sleep. Switch Week or Today. The band is your own average plus or minus 2 standard deviations, not a population norm.",
      "The metric cards show blood pressure, temperature, oxygen saturation, and glucose. When the assistant is live, a card can show a short AI note. Refresh AI notes asks for a new one.",
      "NASA's five hazards are tiles that jump to radiation, psych, emergency, fitness, and the checklist.",
      "Reset demo data clears anything you entered and restores the 7-day simulation. It asks you to confirm first.",
    ],
    keywords: ["dashboard", "home page", "weekly dashboard", "reset demo", "hazard tile", "week or today"],
  },
  {
    id: "alerts",
    title: "Alerts",
    path: "/alerts",
    about:
      "Alerts compare a new reading with your own previous 7 days. z = (value - your average) / your standard deviation. This is a demonstration method, not a diagnosis.",
    steps: [
      "Open Alerts from the side menu. The bell in the header shows how many are still open.",
      "Watch means the reading is at least 2 standard deviations from your own average (|z| at least 2). Repeat the reading, log it, and send it with the next case.",
      "Act means at least 3 standard deviations (|z| at least 3). Call the flight surgeon and open Emergency so the matching card can start.",
      "Before there is enough history, only the demonstration hard bounds can raise an alert. Those limits are marked as demonstration thresholds.",
      "Ack marks an alert seen. Why? on a card opens the math and the readings that were used.",
      "The scale on this page places open alerts from Normal to Act.",
    ],
    keywords: [
      "alert",
      "alerts",
      "act mean",
      "what does act",
      "does act",
      "act means",
      "watch alert",
      "z score",
      "personal baseline",
      "ack",
      "acknowledged",
      "hard bound",
      "burn in",
    ],
  },
  {
    id: "emergency",
    title: "Emergency",
    path: "/emergency",
    about:
      "Emergency is an 8-step case. It is decision support only. It does not diagnose, and it does not give a dose.",
    steps: [
      "Open Emergency from the red button in the side menu, or the siren on a phone.",
      "1 Situation: describe what is happening in a few words. Quick picks cover chest pain, breathing, injury, fever, and other.",
      "2 Pinpoint: tap the body or a region pill. Head, chest, abdomen, spine, arms, legs, and skin.",
      "3 Check: review the current readings already on station.",
      "4 Differential: the station matches a protocol card from the words and the region. The ideas are working ideas, not a diagnosis.",
      "5 Tests: enter the measurements the card asks for.",
      "6 Steps: follow the immediate actions on the card and check them off.",
      "7 Kit: the card names onboard items only, if any. Nothing is given until you confirm.",
      "8 Send: send the case to the flight surgeon. That queues a high-priority Earth packet, then the case stays in monitoring so you can re-check heart rate and blood pressure.",
    ],
    keywords: [
      "emergency",
      "emergency page",
      "8 steps",
      "eight steps",
      "situation",
      "pinpoint",
      "protocol card",
      "open emergency",
      "new case",
    ],
  },
  {
    id: "checklist",
    title: "Daily checklist",
    path: "/checklist",
    about: "The daily checklist is the mission-day task list, grouped by type.",
    steps: [
      "Open Daily checklist. The top shows how many items are done today.",
      "Groups are Meds, Vitals, Exercise, Radiation, Psych, and Other.",
      "Check a row to complete it. Vitals ask for a number. Blood pressure asks for both numbers.",
      "Scheduled meds open a confirm step before the check is saved. The as-needed row is a plain check. The page does not suggest a dose.",
      "Exercise, radiation, and psych rows link to those pages (Log, Read, Start).",
      "Use the mission-day menu to look at another day. A past day is read-only until you choose Edit day.",
    ],
    keywords: ["checklist", "daily checklist", "check off", "meds row", "vitals", "edit day", "mission day"],
  },
  {
    id: "fitness",
    title: "Fitness",
    path: "/fitness",
    about: "Fitness tracks planned resistive and aerobic sessions against what you actually completed.",
    steps: [
      "Open Fitness. The ring shows sessions done this week against the demonstration plan.",
      "By type splits resistive and aerobic.",
      "Log a session: pick Resistive or Aerobic, enter minutes, set effort from 1 to 5, and add a note if you want.",
      "Saving updates today's planned row, or adds an extra session if that row is already done. The matching checklist row is marked done too.",
    ],
    keywords: ["fitness", "workout", "log a session", "log workout", "resistive", "aerobic", "exercise countermeasure"],
  },
  {
    id: "radiation",
    title: "Radiation log",
    path: "/radiation",
    about:
      "The radiation log stores a simulated dosimeter rate in µGy/h and a cumulative dose in mGy. It is a trend, not a dose-limit check. No limit line is shown.",
    steps: [
      "Open Radiation log.",
      "Rate now is the latest reading. This week is the cumulative change since the first reading in the demo window.",
      "Choose Add reading.",
      "Type the dose rate shown on the dosimeter, in µGy/h.",
      "Choose Save reading. Cumulative dose updates from your last reading and the hours since it.",
      "The table lists day, time, rate, cumulative dose, source, and status. A reading outside your usual range raises an alert.",
    ],
    keywords: [
      "radiation log",
      "log radiation",
      "dosimeter",
      "add reading",
      "save reading",
      "dose rate",
      "radiation page",
      "ugy",
    ],
  },
  {
    id: "psych",
    title: "Psych check-in",
    path: "/psych",
    about:
      "Psych check-in is a one-minute self-report. It is not WinSCAT and it is not a test. Isolation and confinement is one of NASA's five hazards.",
    steps: [
      "Open Psych check-in.",
      "Score mood, sleep quality, stress, and team strain from 1 to 5.",
      "The private note stays on station and is not sent to Earth. Turn the switch off if the flight surgeon should see the note.",
      "Choose Save check-in. If an answer is outside your usual range, an alert is shown.",
      "The bars show mood for the last check-ins.",
    ],
    keywords: ["psych", "check-in", "check in", "mood", "stress", "team strain", "private note", "winscat"],
  },
  {
    id: "earth-sync",
    title: "Earth sync",
    path: undefined,
    about:
      "Earth sync is not its own page. It is the store-and-forward queue that sends packets to the flight surgeon. The link is a simulation, not a real delay to Earth.",
    steps: [
      "Emergency step 8, Send, queues a high-priority packet. Emergency packets go out before routine ones.",
      "After send, monitoring shows the packet status: queued, sending to Earth, sent, or failed. A failed packet is retried by the sync loop.",
      "The loop runs in the background while the station is open. A packet left in sending (for example if the tab closed) is put back in the queue.",
      "A routine summary can include recent measurements, open alerts, today's checklist, the last psych check, and today's workouts. A private psych note is not included.",
      "Demonstration settings are a one-way delay, whether the link is up, and a chance a packet is dropped. They are not flight values.",
    ],
    keywords: ["earth sync", "sync to earth", "packet status", "store and forward", "handoff", "queued for earth", "ground link"],
  },
  {
    id: "sources",
    title: "Sources",
    path: "/sources",
    about: "Sources and credits lists what the station is built on.",
    steps: [
      "Open Sources from the side menu.",
      "Rows cover simulated crew data, NASA's five hazards, the historical ISS medical kit list, the personal baseline method, demonstration hard bounds, the 3D body, the typeface, and the icon set.",
      "A row with an arrow opens the in-app page or the external source.",
      "The kit list is a historical list. Item fields come from that source. Doses are not shown.",
    ],
    keywords: ["sources", "credits", "source page", "where does this come from", "kit list"],
  },
  {
    id: "assistant",
    title: "AI assistant",
    path: "/assistant",
    about:
      "The assistant answers from the onboard kit, your alerts, the pages of this station, and short general notes. It does not suggest a dose.",
    steps: [
      "Open AI assistant from the side menu, or use the round mic button that sits on every page (the dock).",
      "Commands: suggest (items named on the open case's protocol card, onboard kit only), find plus text (search item name and comments), item plus an id (one onboard item), alerts (open alerts), help (this list).",
      "You can also type a sentence: a symptom opens Emergency, a how-to explains a page, and a general question gets a short note labeled as general info.",
      "On the dock, tap the mic and speak, or type. Audio is not stored. Speech-to-text may need a connection. Typing works offline.",
      "suggest needs an open Emergency case. find and item only show kit rows that are on board.",
      "If a kit item is named, confirm before it is given. The text you type in that dialog is the only dose text that is saved.",
    ],
    keywords: [
      "assistant",
      "assistant dock",
      "dock",
      "microphone",
      "mic button",
      "voice",
      "spoken",
      "suggest command",
      "find item",
      "help command",
    ],
  },
];

export function guideForPath(path: AppRoutePath): AppGuideEntry | undefined {
  return APP_GUIDE.find((entry) => entry.path === path);
}
