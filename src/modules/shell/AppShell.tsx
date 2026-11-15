import { NavLink, Outlet } from "react-router-dom";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayLabel } from "../../data/db";
import { AssistantDock } from "../assistant/AssistantDock";
import { Disclaimer } from "../../ui/Disclaimer";
import { SyncChip as NavSyncCount } from "../../ui/SyncChip";
import { StationIcon } from "./StationIcon";
import { SyncChip } from "./SyncChip";

const LINKS = [
  { to: "/emergency", label: "Emergency", icon: "emergency" },
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/checklist", label: "Checklist", icon: "checklist" },
  { to: "/fitness", label: "Fitness", icon: "fitness" },
  { to: "/radiation", label: "Radiation", icon: "radiation" },
  { to: "/psych", label: "Psychology", icon: "psych" },
  { to: "/assistant", label: "Assistant", icon: "assistant" },
  { to: "/sync", label: "Ground sync", icon: "sync" },
  { to: "/sources", label: "Sources", icon: "sources" },
] as const;

function initials(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function AppShell() {
  const [emergency, ...station] = LINKS;
  const crewLabel = `${SIM_CREW.displayName} (simulated)`;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <StationIcon name="pulse" />
          </span>
          <div>
            <p className="brand">Pulseframe</p>
            <p className="brand-sub">Crew medical station</p>
          </div>
        </div>
        <nav aria-label="Station">
          <NavLink to={emergency.to} className="nav-emergency">
            <span className="nav-item">
              <StationIcon name={emergency.icon} />
              {emergency.label}
            </span>
            <StationIcon name="chevron" />
          </NavLink>
          <p className="nav-kicker">Station</p>
          {station.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"}>
              <span className="nav-item">
                <StationIcon name={link.icon} />
                {link.label}
              </span>
              {link.to === "/sync" ? <NavSyncCount /> : null}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-note">
          <span className="live-dot" aria-hidden="true" />
          <span>
            <strong>Offline-first demo</strong>
            <span className="brand-sub">Simulated crew data only</span>
          </span>
        </p>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="identity-chip">
            <span className="avatar" aria-hidden="true">
              {initials(SIM_CREW.displayName)}
            </span>
            {crewLabel}
          </span>
          <span className="identity-chip">
            <span className="chip-icon" aria-hidden="true">
              <StationIcon name="calendar" />
            </span>
            {missionDayLabel(MISSION_DAY_TODAY)}
          </span>
          <SyncChip />
        </header>
        <Disclaimer />
        <div className="stage">
          <Outlet />
        </div>
      </div>
      <AssistantDock />
    </div>
  );
}
