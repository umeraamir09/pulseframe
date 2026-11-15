import { Routes, Route } from "react-router-dom";
import { AppShell } from "./modules/shell/AppShell";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { EmergencyPage } from "./modules/emergency/EmergencyPage";
import { ChecklistPage } from "./modules/checklist/ChecklistPage";
import { FitnessPage } from "./modules/fitness/FitnessPage";
import { RadiationPage } from "./modules/radiation/RadiationPage";
import { PsychPage } from "./modules/psych/PsychPage";
import { AssistantPage } from "./modules/assistant/AssistantPage";
import { SyncPage } from "./modules/sync/SyncPage";
import { SourcesPage } from "./modules/sources/SourcesPage";
import { NotFound } from "./modules/shell/NotFound";
import { SkeletonDemo } from "./modules/skeleton/SkeletonDemo";

function EmergencyWithSkeleton() {
  return (
    <div className="split">
      <EmergencyPage />
      <SkeletonDemo />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/emergency" element={<EmergencyWithSkeleton />} />
        <Route path="/checklist" element={<ChecklistPage />} />
        <Route path="/fitness" element={<FitnessPage />} />
        <Route path="/radiation" element={<RadiationPage />} />
        <Route path="/psych" element={<PsychPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
