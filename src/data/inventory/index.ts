import { DEMO_ISS_KIT_SUBSET } from "./demoIssKit";
import { RESEARCHER_KIT } from "./researcherKit";

export const ACTIVE_INVENTORY = RESEARCHER_KIT.length ? RESEARCHER_KIT : DEMO_ISS_KIT_SUBSET;
