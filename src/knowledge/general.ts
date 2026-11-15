/**
 * Short general notes for reasonable health, space, and how-to questions.
 * These are not onboard research and must not include a dose.
 */
import { hasPhrase } from "../modules/assistant/text.ts";

export interface GeneralNote {
  id: string;
  title: string;
  /** Any hit selects the note. More specific notes are listed first. */
  phrases: string[];
  text: string;
}

export const GENERAL_NOTES: GeneralNote[] = [
  {
    id: "float",
    title: "Why people float",
    phrases: ["float", "floating", "weightless", "microgravity", "zero gravity"],
    text: "In orbit the spacecraft and the crew are falling together around Earth, so people and objects float. This is called microgravity. It is not a place with no gravity. Muscles and bones do less work, which is why the Fitness page tracks resistive and aerobic sessions.",
  },
  {
    id: "fluid",
    title: "Fluid shift",
    phrases: ["fluid shift", "puffy face", "fluids shift"],
    text: "In microgravity, body fluids shift toward the head. The face can look puffy and the legs can look thinner. That is a normal direction of change in flight, not a diagnosis. Log new symptoms in Emergency if someone feels worse.",
  },
  {
    id: "radiation",
    title: "Space radiation",
    phrases: ["space radiation", "cosmic ray", "cosmic rays", "radiation in space", "why is radiation"],
    text: "Space radiation is higher than on Earth because there is less air and less magnetic shielding. The Radiation log on this station stores a simulated rate so you can see a trend. It does not set a personal limit. Ask the flight surgeon about limits.",
  },
  {
    id: "sleep",
    title: "Sleep in flight",
    phrases: ["sleep in space", "sleep on the station", "cannot sleep", "circadian", "sleep schedule"],
    text: "Sleep is often shorter in flight. Noise, light, work schedule, and a weak day-night signal all play a part. Log sleep on the checklist and look at the sleep chart on the Dashboard. The Psych check-in also asks about sleep quality.",
  },
  {
    id: "exercise",
    title: "Exercise in flight",
    phrases: ["bone loss", "muscle loss", "why do astronauts exercise", "why exercise in space", "countermeasure"],
    text: "Crew exercise to slow muscle and bone loss in microgravity, and to support the heart and circulation. Log resistive or aerobic minutes on the Fitness page. Stop and open Emergency if exercise brings chest pain, trouble breathing, or severe pain.",
  },
  {
    id: "surgeon",
    title: "Flight surgeon",
    phrases: ["what is a flight surgeon", "who is the flight surgeon", "flight surgeon do"],
    text: "The flight surgeon is the physician on the ground who directs crew medical care. This station can prepare a case and queue it for Earth. It does not replace that physician.",
  },
  {
    id: "cabin",
    title: "Cabin air",
    phrases: ["carbon dioxide", "cabin air", "co2", "stuffy cabin"],
    text: "A closed cabin can build up carbon dioxide. Headache, a stuffy feeling, or slower thinking are reasons to check the cabin system and to open Emergency if someone feels unwell. This note is general info, not a cabin procedure.",
  },
  {
    id: "cpr",
    title: "CPR",
    phrases: ["cpr", "cardiopulmonary"],
    text: "CPR means pressing on the chest, and giving breaths if you are trained, for a person who is not breathing or not responsive. If that is happening now, open Emergency. If they stop breathing or lose consciousness, start CPR and call the flight surgeon now.",
  },
  {
    id: "day-night",
    title: "A day in orbit",
    phrases: ["how long is a day", "sunrise", "orbital night", "16 sunrises", "day night cycle"],
    text: "A spacecraft in low Earth orbit goes through many sunrises and sunsets in one Earth day, about every 90 minutes. Crew schedules still use a 24-hour day. That mismatch is one reason sleep can be hard.",
  },
];

export function matchGeneral(question: string): GeneralNote | undefined {
  let best: { note: GeneralNote; score: number } | undefined;
  for (const note of GENERAL_NOTES) {
    let score = 0;
    for (const phrase of note.phrases) {
      if (hasPhrase(question, phrase)) score += phrase.includes(" ") ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { note, score };
  }
  return best?.note;
}
