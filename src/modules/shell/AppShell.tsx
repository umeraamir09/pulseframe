import { useCallback, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayLabel, store, useLive } from "../../data/db";
import { AssistantDock } from "../assistant/AssistantDock";
import { Disclaimer } from "../../ui/Disclaimer";
import { Icon, type IconName } from "../../ui/Icon";
import { PageMetaContext, type PageMeta } from "../../ui/pageMeta";
import { NavSyncCount, SyncChip } from "./SyncChip";

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Dashboard", icon: "grid" },
  { to: "/alerts", label: "Alerts", icon: "bell" },
  { to: "/assistant", label: "AI assistant", icon: "sparkles" },
  { to: "/checklist", label: "Daily checklist", icon: "checklist" },
  { to: "/fitness", label: "Fitness", icon: "dumbbell" },
  { to: "/radiation", label: "Radiation log", icon: "radiation" },
  { to: "/psych", label: "Psych check-in", icon: "smile" },
  { to: "/sync", label: "Earth sync", icon: "satellite" },
  { to: "/sources", label: "Sources", icon: "book" },
];

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Home", icon: "grid" },
  { to: "/alerts", label: "Alerts", icon: "bell" },
  { to: "/emergency", label: "Emergency", icon: "siren" },
  { to: "/assistant", label: "Assistant", icon: "sparkles" },
  { to: "/checklist", label: "Daily", icon: "checklist" },
];

/** Routes that carry the strong, not-a-diagnosis disclaimer. */
const STRONG_ROUTES = ["/emergency", "/assistant"];

function initials(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function EmergencyButton({ caseOpen }: { caseOpen: boolean }) {
  return (
    <NavLink to="/emergency" className={`emergency-btn${caseOpen ? " case-open" : ""}`}>
      <span className="badge">
        <Icon name="siren" size={20} />
      </span>
      <span className="grow">{caseOpen ? "Case open" : "Emergency"}</span>
      <Icon name="chevron" size={18} />
    </NavLink>
  );
}

function Brand({ sub }: { sub: string }) {
  return (
    <Link to="/" className="brand-lockup">
      <span className="brand-mark">
        <Icon name="pulse" size={22} />
      </span>
      <span>
        <span className="brand">Pulseframe</span>
        <span className="brand-sub">{sub}</span>
      </span>
    </Link>
  );
}

/** "Simulated Crew Member A" reads as "Crew A" in the chrome; the simulated tag is added where shown. */
function crewName(displayName: string): string {
  return displayName.replace(/^Simulated\s+/i, "").replace(/\bCrew Member\b/i, "Crew");
}

export function AppShell() {
  const [meta, setMeta] = useState<PageMeta>({ title: "Pulseframe" });
  const setPageMeta = useCallback((m: PageMeta) => {
    setMeta((cur) => (cur.title === m.title && cur.subtitle === m.subtitle ? cur : m));
  }, []);
  const { pathname } = useLocation();
  const { data: openCase } = useLive(() => store.getOpenCase(SIM_CREW.id), []);
  const { data: alerts } = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const openAlerts = (alerts ?? []).filter((a) => !a.ackedAt).length;
  const crewLabel = `${crewName(SIM_CREW.displayName)} (simulated)`;
  const strong = STRONG_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <PageMetaContext.Provider value={setPageMeta}>
      <div className="app">
        <aside className="sidebar">
          <Brand sub="Crew medical station" />
          <EmergencyButton caseOpen={Boolean(openCase)} />
          <p className="nav-kicker">Station</p>
          <nav className="side-nav" aria-label="Station">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"}>
                <Icon name={link.icon} size={20} />
                <span className="grow">{link.label}</span>
                {link.to === "/sync" ? <NavSyncCount /> : null}
                {link.to === "/alerts" && openAlerts ? <span className="nav-count urgent">{openAlerts}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="mode-card">
            <strong>
              <span className="dot normal" aria-hidden="true" />
              Offline-first demo
            </strong>
            <span className="brand-sub">Simulated crew data only</span>
          </div>
        </aside>

        <div className="main">
          <div className="mobile-top mobile-only">
            <Brand sub={crewLabel} />
            <span className="head-chip">{missionDayLabel(MISSION_DAY_TODAY)}</span>
            <SyncChip short />
          </div>
          <div className="mobile-emergency mobile-only">
            <EmergencyButton caseOpen={Boolean(openCase)} />
          </div>

          <header className="topbar">
            <div className="page-titles">
              <h1>{meta.title}</h1>
              {meta.subtitle ? <p>{meta.subtitle}</p> : null}
            </div>
            <span className="head-chip crew">
              <span className="crew-badge" aria-hidden="true">
                {initials(crewName(SIM_CREW.displayName))}
              </span>
              {crewLabel}
            </span>
            <span className="head-chip desktop-md">
              <Icon name="calendar" size={18} />
              {missionDayLabel(MISSION_DAY_TODAY)}
            </span>
            <SyncChip />
            <Link
              to="/alerts"
              className="icon-round"
              aria-label={openAlerts ? `Alerts, ${openAlerts} open` : "Alerts, none open"}
            >
              <Icon name="bell" size={20} />
              {openAlerts ? <span className="ping" aria-hidden="true" /> : null}
            </Link>
          </header>

          <div className="stage">
            <Outlet />
          </div>
          <Disclaimer variant={strong ? "emergency" : "banner"} />
        </div>

        <nav className="tab-bar mobile-only" aria-label="Quick">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={t.to === "/emergency" ? "sos" : undefined}
              aria-label={t.to === "/emergency" ? "Emergency" : undefined}
            >
              <Icon name={t.icon} size={t.to === "/emergency" ? 28 : 22} />
              {t.to === "/emergency" ? null : t.label}
            </NavLink>
          ))}
        </nav>
        <AssistantDock />
      </div>
    </PageMetaContext.Provider>
  );
}
