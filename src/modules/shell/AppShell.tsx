import { NavLink, Outlet } from "react-router-dom";

const LINKS = [
  ["/", "Dashboard"],
  ["/emergency", "Emergency"],
  ["/checklist", "Checklist"],
  ["/fitness", "Fitness"],
  ["/radiation", "Radiation"],
  ["/psych", "Psychology"],
  ["/assistant", "Assistant"],
  ["/sync", "Ground sync"],
  ["/sources", "Sources"],
] as const;

export function AppShell() {
  return (
    <div className="app">
      <aside>
        <p className="brand">Pulseframe</p>
        <nav>
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <div className="disclaimer" role="note">
          Decision support only. Not medical authority. Simulated crew data. Flight-surgeon review
          is required for treatment decisions.
        </div>
        <Outlet />
      </div>
    </div>
  );
}
