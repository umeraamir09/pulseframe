/** Visible copy shared by the assistant page, the providers, the confirm dialog, and the API prompt. */
export const NO_OPEN_CASE_REPLY = "No open case. Start one in Emergency.";
export const NO_ONBOARD_ITEM = "No onboard item suggested in the demonstration data. Contact the flight surgeon.";
export const LIVE_FALLBACK_NOTE = "Offline mode: live assistant unavailable";
export const PROVENANCE_LABEL = "Historical ISS kit list (2015), not a current flight kit";
export const DOSE_PROMPT = "Pulseframe does not suggest doses. Enter what the flight surgeon directed.";
export const DOSE_LINE = "Dose: see onboard medical checklist JSC 48522 or the flight surgeon.";
export const NOT_FOUND_TEXT = "Not in Pulseframe research. Contact the flight surgeon.";
export const GENERAL_LABEL = "General info, not from onboard research";
export const RED_FLAG_LINE = "If they stop breathing or lose consciousness, start CPR and call the flight surgeon now.";
export const ASSISTANT_DISCLAIMER = "Decision support only, contact the flight surgeon.";
export const CONFIRM_BEFORE_GIVEN = "Confirm before given";
export const REJECTED_LINE = "Rejected: not in onboard inventory";
export const SURGEON_CHECK = "I confirm a flight surgeon approved this";
export const CONFIRMED_BY_DEFAULT = "Crew A (simulated)";
export const MODE_OFFLINE = "Offline mode: protocol cards";
export const MODE_LIVE = "Live: Groq";
export const OFFLINE_COMMANDS_ONLY = "Offline mode answers commands only. Try help.";
export const NOT_IN_RESEARCH_TITLE = "Not in research";
export const RESEARCH_ANSWER_TITLE = "From Pulseframe research";
export const GENERAL_ANSWER_TITLE = "General answer";
export const GENERAL_NOTE = `${GENERAL_LABEL}. ${ASSISTANT_DISCLAIMER}`;

export function canLogGiven(input: { doseText: string; confirmedBy: string; surgeonApproved: boolean }): boolean {
  return input.doseText.trim().length > 0 && input.confirmedBy.trim().length > 0 && input.surgeonApproved;
}
