import type { ComponentType } from "react";
import { Route, Routes } from "react-router-dom";
import { APP_ROUTE_PATHS, type AppRoutePath } from "./knowledge/app-guide";
import { AlertsPage } from "./modules/alerts/AlertsPage";
import { AssistantPage } from "./modules/assistant/AssistantPage";
import { ChecklistPage } from "./modules/checklist/ChecklistPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { EmergencyPage } from "./modules/emergency/EmergencyPage";
import { FitnessPage } from "./modules/fitness/FitnessPage";
import { PsychPage } from "./modules/psych/PsychPage";
import { RadiationPage } from "./modules/radiation/RadiationPage";
import { AppShell } from "./modules/shell/AppShell";
import { NotFound } from "./modules/shell/NotFound";
import { SourcesPage } from "./modules/sources/SourcesPage";

const PAGES: Record<AppRoutePath, ComponentType> = {
  "/": DashboardPage,
  "/alerts": AlertsPage,
  "/emergency": EmergencyPage,
  "/checklist": ChecklistPage,
  "/fitness": FitnessPage,
  "/radiation": RadiationPage,
  "/psych": PsychPage,
  "/assistant": AssistantPage,
  "/sources": SourcesPage,
};

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {APP_ROUTE_PATHS.map((path) => {
          const Page = PAGES[path];
          return <Route key={path} path={path} element={<Page />} />;
        })}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
