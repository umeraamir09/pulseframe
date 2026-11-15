import { useEffect, useState } from "react";
import { useLive } from "../../data/db";
import { Icon } from "../../ui/Icon";
import { numberMarkers } from "../assistant/citations";
import { SourceChips } from "../assistant/ReplyParts";
import { getBrief, loadBriefSummary, resolveBrief, type ShownBrief as Shown } from "./briefClient";
import type { BriefSummary } from "./briefSummary";

/** The cited bullets and their source chips. */
export function BriefBody({ bullets, citations }: Shown) {
  return (
    <>
      <ul className="stack" style={{ paddingLeft: 18, margin: 0 }}>
        {bullets.map((b, i) => (
          <li key={i}>{numberMarkers(b.text, citations.byChunk)}</li>
        ))}
      </ul>
      <SourceChips citations={citations} />
    </>
  );
}

/** Exported for tests; the dashboard renders AiBrief, which also checks the mode. */
export function AiBriefCard({ summary }: { summary: BriefSummary | undefined }) {
  const [shown, setShown] = useState<Shown>();
  const [refreshing, setRefreshing] = useState(false);
  // The summary is rebuilt on every store change; only its content matters.
  const summaryJson = summary ? JSON.stringify(summary) : undefined;

  useEffect(() => {
    if (!summaryJson) return;
    let alive = true;
    void getBrief(JSON.parse(summaryJson) as BriefSummary).then(async (bullets) => {
      const next = bullets ? await resolveBrief(bullets) : undefined;
      if (alive) setShown(next);
    });
    return () => {
      alive = false;
    };
  }, [summaryJson]);

  async function refresh() {
    if (!summaryJson) return;
    setRefreshing(true);
    try {
      const bullets = await getBrief(JSON.parse(summaryJson) as BriefSummary, true);
      // A failed refresh keeps the brief already on screen.
      if (bullets) setShown(await resolveBrief(bullets));
    } finally {
      setRefreshing(false);
    }
  }

  // Offline, failed or still loading: show nothing, never an error.
  if (!shown) return null;
  return (
    <section className="card ai-brief" aria-labelledby="ai-brief">
      <div className="card-head" style={{ alignItems: "center" }}>
        <h2 id="ai-brief" className="h3" style={{ fontSize: 20 }}>
          AI brief
        </h2>
        <button type="button" className="btn ghost sm" onClick={() => void refresh()} disabled={refreshing}>
          <Icon name="reset" size={16} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <BriefBody {...shown} />
      <p className="muted small" style={{ marginTop: 8 }}>
        Decision support only, not a diagnosis. Contact the flight surgeon for anything serious.
      </p>
    </section>
  );
}

function LiveAiBrief() {
  const { data: summary } = useLive(loadBriefSummary, []);
  return <AiBriefCard summary={summary} />;
}

/** Renders only in live assistant mode. */
export function AiBrief() {
  if (import.meta.env.VITE_ASSISTANT_MODE !== "live") return null;
  return <LiveAiBrief />;
}
