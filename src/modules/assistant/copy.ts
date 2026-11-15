/** Visible copy shared by the assistant page, the providers, and the confirm dialog. */
export const NO_OPEN_CASE_REPLY = "No open case. Start one in Emergency.";
export const NO_ONBOARD_ITEM = "No onboard item suggested in the demonstration data. Contact the flight surgeon.";
export const LIVE_FALLBACK_NOTE = "Offline mode: live assistant unavailable";
export const PROVENANCE_LABEL = "Historical ISS kit list (2015), not a current flight kit";
export const DOSE_PROMPT = "Pulseframe does not suggest doses. Enter what the flight surgeon directed.";
export const REJECTED_LINE = "Rejected: not in onboard inventory";
export const SURGEON_CHECK = "I confirm a flight surgeon approved this";
export const CONFIRMED_BY_DEFAULT = "Crew A (simulated)";
export const MODE_OFFLINE = "Offline mode: protocol cards";
export const MODE_LIVE = "Live: Groq";
export const OFFLINE_COMMANDS_ONLY = "Offline mode answers commands only. Try help.";
export const NOT_IN_RESEARCH_TITLE = "Not in research";
export const RESEARCH_ANSWER_TITLE = "From Pulseframe research";

export function canLogGiven(input: { doseText: string; confirmedBy: string; surgeonApproved: boolean }): boolean {
  return input.doseText.trim().length > 0 && input.confirmedBy.trim().length > 0 && input.surgeonApproved;
}
