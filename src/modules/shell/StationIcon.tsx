type IconName =
  | "pulse"
  | "emergency"
  | "dashboard"
  | "checklist"
  | "fitness"
  | "radiation"
  | "psych"
  | "assistant"
  | "sync"
  | "sources"
  | "calendar"
  | "chevron";

const COMMON = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function StationIcon({ name }: { name: IconName }) {
  switch (name) {
    case "pulse":
      return (
        <svg {...COMMON}>
          <path d="M3 12h4l2.2-5.5L13 18l2.2-6H21" />
        </svg>
      );
    case "emergency":
      return (
        <svg {...COMMON}>
          <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...COMMON}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "checklist":
      return (
        <svg {...COMMON}>
          <rect x="6" y="3.5" width="12" height="17" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "fitness":
      return (
        <svg {...COMMON}>
          <path d="M6 9v6M18 9v6M6 12h12M4 10v4M20 10v4" />
        </svg>
      );
    case "radiation":
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
        </svg>
      );
    case "psych":
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 13.2c.7 1.5 2 2.3 3.5 2.3s2.8-.8 3.5-2.3" />
          <path d="M9 10h.01M15 10h.01" />
        </svg>
      );
    case "assistant":
      return (
        <svg {...COMMON}>
          <path d="M12 3.2 13.2 8 18 9.2 13.2 10.5 12 15.2 10.8 10.5 6 9.2 10.8 8 12 3.2z" />
          <path d="M18 14.2 18.7 16.3 20.8 17 18.7 17.7 18 19.8 17.3 17.7 15.2 17 17.3 16.3 18 14.2z" />
        </svg>
      );
    case "sync":
      return (
        <svg {...COMMON}>
          <path d="M20 12a8 8 0 0 1-13.5 5.8" />
          <path d="M4 12a8 8 0 0 1 13.5-5.8" />
          <path d="M4 5.5V10h4.5M20 18.5V14H15.5" />
        </svg>
      );
    case "sources":
      return (
        <svg {...COMMON}>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5z" />
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 8H20" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...COMMON}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v4M16 3.5v4M4 10h16" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...COMMON} width="16" height="16">
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
  }
}
