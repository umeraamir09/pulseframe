import { KEY_LABELS, type Alert } from "../../contracts";
import { SIM_CREW, Z_ACT, Z_WATCH, store, useLive } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { Icon, type IconName } from "../../ui/Icon";
import { usePageMeta } from "../../ui/pageMeta";

const RANK: Record<Alert["severity"], number> = { act: 2, watch: 1 };

const METHOD: { icon: IconName; label: string }[] = [
  { icon: "calendar", label: "7 days of your data" },
  { icon: "target", label: "Your own μ and σ" },
  { icon: "pulse", label: "z = (x − μ) / σ" },
  { icon: "bell", label: "Chip, then Ack" },
];

/** z range drawn on the scale, end to end. */
const Z_SPAN = 6;

function shortName(a: Alert): string {
  return a.key === "heartRate" ? "HR" : KEY_LABELS[a.key].split(" ")[0]!;
}

function ZScale({ alerts }: { alerts: Alert[] }) {
  const pos = (z: number) => Math.max(2, Math.min(98, ((z + Z_SPAN) / (2 * Z_SPAN)) * 100));
  const w = (a: number, b: number) => `${pos(b) - pos(a)}%`;
  const marks = alerts.filter((a) => a.zScore !== undefined && a.ruleId !== "hard-bound");
  return (
    <div className="zscale" role="img" aria-label="Open alerts placed on the z scale from Normal to Act">
      <div className="bar">
        <span style={{ width: w(-Z_SPAN, -Z_ACT), background: "var(--act-soft)" }} />
        <span style={{ width: w(-Z_ACT, -Z_WATCH), background: "var(--watch-soft)" }} />
        <span style={{ width: w(-Z_WATCH, Z_WATCH), background: "var(--normal-soft)" }} />
        <span style={{ width: w(Z_WATCH, Z_ACT), background: "var(--watch-soft)" }} />
        <span style={{ flex: 1, background: "var(--act-soft)" }} />
      </div>
      <span className="mu" style={{ left: "50%" }} />
      <span className="mu-label" style={{ left: "50%" }}>
        μ
      </span>
      {marks.map((a) => {
        const c = a.severity === "act" ? "var(--act)" : "var(--watch)";
        return (
          <span key={a.id} className="mark" style={{ left: `${pos(a.zScore!)}%`, background: c }}>
            <i style={{ background: c }} />
            <b style={{ color: a.severity === "act" ? "var(--act-ink)" : "var(--watch-ink)" }}>
              {shortName(a)} z {a.zScore!.toFixed(2)}
            </b>
          </span>
        );
      })}
    </div>
  );
}

export function AlertsPage() {
  usePageMeta("Abnormal-reading alerts", "Personal baseline method, simulated data");
  const { data: alerts } = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const all = [...(alerts ?? [])].sort(
    (a, b) =>
      Number(Boolean(a.ackedAt)) - Number(Boolean(b.ackedAt)) ||
      RANK[b.severity] - RANK[a.severity] ||
      Date.parse(b.openedAt) - Date.parse(a.openedAt),
  );
  const open = all.filter((a) => !a.ackedAt);
  // Most recent open alert per metric for the scale, so labels do not pile up.
  const perKey = [...new Map(open.map((a) => [a.key, a])).values()].slice(0, 4);

  return (
    <div className="alerts-grid">
      <section className="card pad-lg" aria-labelledby="alerts-title">
        <p className="overline">Pattern</p>
        <h2 id="alerts-title" className="h2" style={{ marginTop: 4 }}>
          {open.length} open, {all.length - open.length} acknowledged
        </h2>
        {alerts && !all.length ? (
          <p className="note normal" style={{ marginTop: 16 }}>
            <Icon name="check" size={18} /> No alerts. Every reading is inside your personal baseline.
          </p>
        ) : null}
        <div className="alert-pattern-grid">
          {all.map((a) => (
            <AlertCard key={a.id} alert={a} onAck={a.ackedAt ? undefined : () => void store.ackAlert(a.id)} />
          ))}
        </div>
        <p className="note" style={{ marginTop: 16 }}>
          <Icon name="help" size={18} /> Why? opens the full math and the 7 readings used.
        </p>
      </section>

      <div className="stack" style={{ gap: 24 }}>
        <section className="card pad-lg" aria-labelledby="method-title">
          <p className="overline">Method</p>
          <h2 id="method-title" className="h2" style={{ marginTop: 4 }}>
            From reading to chip
          </h2>
          <ol className="method-steps">
            {METHOD.map((m, i) => (
              <li key={m.label} className="method-step">
                <span className="num-dot">{i + 1}</span>
                <span className="icon-badge sm white">
                  <Icon name={m.icon} size={16} />
                </span>
                {m.label}
              </li>
            ))}
          </ol>
        </section>

        <section className="card pad-lg" aria-labelledby="scale-title">
          <p className="overline">Scale</p>
          <h2 id="scale-title" className="h2" style={{ marginTop: 4 }}>
            Where each reading sits
          </h2>
          <ZScale alerts={perKey} />
          <div className="row wrap" style={{ marginTop: 8 }}>
            <span className="tag normal">Normal</span>
            <span className="tag watch">Watch |z| ≥ {Z_WATCH}</span>
            <span className="tag act">Act |z| ≥ {Z_ACT}</span>
          </div>
          <p className="note watch pill" style={{ marginTop: 14 }}>
            <Icon name="flask" size={16} /> Zone edges: demonstration threshold
          </p>
          <p className="note pill" style={{ marginTop: 10 }}>
            <Icon name="info" size={16} /> Not NASA-validated. Demo method.
          </p>
        </section>
      </div>
    </div>
  );
}
