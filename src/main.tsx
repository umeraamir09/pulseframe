import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { initData, queueEmergencyCase, queuePacket, rebuildAlerts, resetDemoData, store } from "./data/db";

void initData();

if (import.meta.env.DEV) {
  Object.assign(window, { pf: { store, queuePacket, queueEmergencyCase, resetDemoData, rebuildAlerts } });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
