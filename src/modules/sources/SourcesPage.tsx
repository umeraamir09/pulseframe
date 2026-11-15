import { Link } from "react-router-dom";
import { HRP_HAZARDS_URL } from "../../contracts";
import { Icon, type IconName } from "../../ui/Icon";
import { usePageMeta } from "../../ui/pageMeta";

interface Source {
  icon: IconName;
  title: string;
  desc: string;
  tag: string;
  href?: string;
  /** In-app route instead of an external link. */
  to?: string;
}

const SOURCES: Source[] = [
  {
    icon: "users",
    title: "Simulated crew data",
    desc: "Crew A and all readings are generated for this demo.",
    tag: "Data",
    to: "/",
  },
  {
    icon: "globe",
    title: "NASA Human Research Program",
    desc: "Five hazards of human spaceflight, used as hazard chips.",
    tag: "Context",
    href: HRP_HAZARDS_URL,
  },
  {
    icon: "globe",
    title: "NASA HRP: Risks of human spaceflight",
    desc: "The risk catalogue behind the hazards.",
    tag: "Context",
    href: "https://www.nasa.gov/hrp/risks/",
  },
  {
    icon: "kit",
    title: "NASA ISS medical kit list",
    desc: "Historical 2015 list, transcribed by the researcher. Item fields from the source PDF. No doses shown.",
    tag: "Kit",
    href: "https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf",
  },
  {
    icon: "target",
    title: "Personal baseline z-score",
    desc: "z = (x − μ) / σ on your own 7 days. Not NASA-validated.",
    tag: "Method",
    to: "/alerts",
  },
  {
    icon: "flask",
    title: "Hard bounds",
    desc: "Every fixed limit is a demonstration threshold.",
    tag: "Method",
    to: "/alerts",
  },
  {
    icon: "cube",
    title: "3D body viewport",
    desc: "Blender Human Base Meshes, CC0, split into regions for the emergency flow.",
    tag: "3D",
    href: "https://www.blender.org/download/demo-files/#assets",
  },
  {
    icon: "book",
    title: "Manrope typeface",
    desc: "Open Font License, via Google Fonts.",
    tag: "Font",
    href: "https://fonts.google.com/specimen/Manrope",
  },
  {
    icon: "sparkles",
    title: "Pulseframe icon set",
    desc: "Custom 24 px line icons made for this project.",
    tag: "Icons",
  },
  {
    icon: "flask",
    title: "NASA Space Apps 2026 challenge",
    desc: "Health monitoring software for long-duration crews.",
    tag: "Brief",
    href: "https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details",
  },
];

function Go({ s }: { s: Source }) {
  if (s.to)
    return (
      <Link to={s.to} className="icon-round" style={{ background: "var(--surface2)" }} aria-label={`Open ${s.title}`}>
        <Icon name="arrowUR" size={18} />
      </Link>
    );
  if (s.href)
    return (
      <a href={s.href} target="_blank" rel="noreferrer" className="icon-round" style={{ background: "var(--surface2)" }} aria-label={`Open ${s.title} (new tab)`}>
        <Icon name="arrowUR" size={18} />
      </a>
    );
  return <span style={{ width: 48 }} />;
}

export function SourcesPage() {
  usePageMeta("Sources and credits", "What Pulseframe is built on");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card source-list" aria-label="Sources">
        {SOURCES.map((s) => (
          <div key={s.title} className="source-row">
            <span className="icon-badge lg accent sq">
              <Icon name={s.icon} size={20} />
            </span>
            <div className="grow">
              <div className="t">{s.title}</div>
              <div className="d">{s.desc}</div>
            </div>
            <span className="tag">{s.tag}</span>
            <Go s={s} />
          </div>
        ))}
      </section>
      <section className="card source-row" style={{ borderBottom: 0 }}>
        <span className="icon-badge lg sq">
          <Icon name="pulse" size={20} />
        </span>
        <div className="grow">
          <div className="t">Pulseframe, NASA Space Apps 2026 prototype</div>
          <div className="d">
            Decision support only. Not medical authority. No real crew data, no photos of people. Thresholds marked demonstration are not
            clinical limits.
          </div>
        </div>
      </section>
    </div>
  );
}
