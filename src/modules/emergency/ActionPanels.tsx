import { useEffect, useState, type FormEvent } from "react";
import { UNITS, type Alert, type InventoryItem, type MeasurementKey, type ProtocolStep } from "../../contracts";
import { SIM_CREW, store, useLive } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { Chip } from "../../ui/Chip";
import { Progress, UnitInput } from "../../ui/controls";
import { Icon, type IconName } from "../../ui/Icon";
import { GivenDialog } from "../assistant/GivenDialog";
import { KitSuggestions } from "../assistant/KitSuggestions";
import type { EmergencyApi } from "./useEmergencyCase";

/** Event-time timestamp. */
function nowIso(): string {
  return new Date().toISOString();
}

function stepIcon(title: string): IconName {
  const t = title.toLowerCase();
  if (/^stop|rest/.test(t)) return "pause";
  if (/crewmate|tell/.test(t)) return "users";
  if (/do not|until|no /.test(t)) return "ban";
  if (/re-measure|measure/.test(t)) return "refresh";
  if (/send|surgeon/.test(t)) return "send";
  return "check";
}

export function StepsPanel({ api }: { api: EmergencyApi }) {
  const actions = api.steps.filter((s) => s.kind === "action");
  const done = actions.filter((s) => s.completed).length;

  async function toggle(step: ProtocolStep) {
    const completed = !step.completed;
    const at = nowIso();
    await api.saveStep({ ...step, completed, completedAt: completed ? at : undefined });
    const allDone = actions.every((s) => (s.id === step.id ? completed : s.completed));
    if (allDone && api.c?.stage === "immediate") await api.advance("kit");
  }

  return (
    <section className="card em-card" aria-labelledby="steps-title">
      <div className="card-head" style={{ alignItems: "flex-end" }}>
        <div className="titles">
          <p className="overline">6 Steps</p>
          <h2 id="steps-title" className="h2">
            Do these now
          </h2>
        </div>
        <div style={{ width: 160 }} className="stack">
          <span className="small" style={{ textAlign: "right", color: "var(--normal-ink)", fontWeight: 600 }}>
            {done} of {actions.length} done
          </span>
          <Progress pct={actions.length ? (done / actions.length) * 100 : 0} tone="normal" label="Steps done" />
        </div>
      </div>
      <ol className="stack">
        {actions.map((s, i) => (
          <li key={s.id} className={`step-card${s.completed ? " done" : ""}`}>
            <span className="num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="pict" aria-hidden="true">
              <Icon name={stepIcon(s.title)} size={26} />
            </span>
            <span className="t" title={s.instruction}>
              {s.title}
            </span>
            <button
              type="button"
              className="step-check"
              aria-pressed={s.completed}
              aria-label={`${s.completed ? "Undo" : "Done"}: ${s.title}`}
              onClick={() => void toggle(s)}
            >
              <Icon name="check" size={24} />
            </button>
          </li>
        ))}
      </ol>
      {api.c?.stage === "immediate" && done < actions.length ? (
        <button type="button" className="btn ghost" style={{ alignSelf: "flex-end" }} onClick={() => void api.advance("kit")}>
          Continue to kit
        </button>
      ) : null}
    </section>
  );
}

export function KitPanel({ api }: { api: EmergencyApi }) {
  const [giving, setGiving] = useState<InventoryItem | null>(null);
  const [logged, setLogged] = useState<string>();
  if (!api.c) return null;
  return (
    <section className="card em-card" aria-labelledby="kit-title">
      <div className="card-head" style={{ alignItems: "center" }}>
        <div className="titles">
          <p className="overline">7 Kit</p>
          <h2 id="kit-title" className="h3" style={{ fontSize: 20 }}>
            From the onboard kit
          </h2>
        </div>
        <span className="tag watch">
          <Icon name="shield" size={14} /> Confirm before given
        </span>
      </div>
      <KitSuggestions caseId={api.c.id} card={api.card} embedded onGive={setGiving} />
      {logged ? (
        <p className="note normal" role="status">
          <Icon name="check" size={16} /> Logged {logged}. Only what you typed was saved.
        </p>
      ) : null}
      {api.c.stage === "kit" ? (
        <button type="button" className="btn secondary" style={{ alignSelf: "flex-end" }} onClick={() => void api.advance("handoff")}>
          <Icon name="arrowR" size={18} /> Next: send
        </button>
      ) : null}
      {giving ? (
        <GivenDialog
          item={giving}
          caseId={api.c.id}
          onClose={() => setGiving(null)}
          onLogged={() => {
            setLogged(giving.name);
            setGiving(null);
          }}
        />
      ) : null}
    </section>
  );
}

function kb(json: string): string {
  const bytes = new TextEncoder().encode(json).length;
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

export function HandoffPanel({ api, caseAlerts }: { api: EmergencyApi; caseAlerts: Alert[] }) {
  const { c, steps } = api;
  const [busy, setBusy] = useState(false);
  const { data: packets } = useLive(() => store.listPackets(), []);
  if (!c) return null;
  const packet = c.packetId ? packets?.find((p) => p.id === c.packetId) : undefined;
  const queued = (packets ?? []).filter((p) => p.status === "queued" || p.status === "failed");
  const position = packet ? queued.filter((p) => p.priority === "emergency" && p.createdAt <= packet.createdAt).length : undefined;
  const tests = steps.filter((s) => s.kind === "test");
  const actions = steps.filter((s) => s.kind === "action");
  const act = caseAlerts.some((a) => a.severity === "act");
  const sent = Boolean(c.packetId);

  async function send() {
    setBusy(true);
    try {
      const sendStep = actions.find((s) => /send/i.test(s.title) && !s.completed);
      const at = nowIso();
      if (sendStep) await api.saveStep({ ...sendStep, completed: true, completedAt: at });
      await api.handoff();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card em-card handoff-card" aria-labelledby="send-title">
      <div className="card-head" style={{ alignItems: "center" }}>
        <div className="row">
          <span className="icon-badge act">
            <Icon name="send" size={18} />
          </span>
          <div className="titles">
            <p className="overline">8 Send</p>
            <h2 id="send-title" className="h3" style={{ fontSize: 18 }}>
              Flight surgeon handoff
            </h2>
          </div>
        </div>
        {act ? <Chip tone="act" /> : null}
      </div>
      <div className="check-chips">
        <span>
          <Icon name="check" size={12} /> Summary
        </span>
        <span>
          <Icon name="check" size={12} /> Tests {tests.filter((s) => s.completed).length} of {tests.length}
        </span>
        <span>
          <Icon name="check" size={12} /> Steps {actions.filter((s) => s.completed).length} of {actions.length}
        </span>
        <span>
          <Icon name="check" size={12} /> Kit notes
        </span>
      </div>
      <button type="button" className="btn danger block" disabled={busy || sent} onClick={() => void send()}>
        <Icon name="send" size={18} /> {sent ? "Sent to flight surgeon" : "Send to flight surgeon (high priority)"}
      </button>
      <p className="row muted small">
        <Icon name="clock" size={14} />
        {packet
          ? `Packet ${kb(packet.payloadJson)} · ${position ? `queue position ${position} · ` : ""}status: ${packet.status}`
          : "Emergency packets go before routine ones · status: ready"}
      </p>
    </section>
  );
}

const RETEST: { key: MeasurementKey; label: string }[] = [
  { key: "heartRate", label: "Heart rate" },
  { key: "systolicBP", label: "Systolic" },
  { key: "diastolicBP", label: "Diastolic" },
];

const CHECK_EVERY_MS = 15 * 60 * 1000;

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function MonitorBanner({ api }: { api: EmergencyApi }) {
  const { c } = api;
  const [now, setNow] = useState(() => Date.now());
  const [retest, setRetest] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastCheck, setLastCheck] = useState<number>();
  const [busy, setBusy] = useState(false);
  const { data: packets } = useLive(() => store.listPackets(), []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!c) return null;
  const packet = packets?.find((p) => p.id === c.packetId);
  const from = lastCheck ?? (packet ? Date.parse(packet.createdAt) : Date.parse(c.startedAt));
  const status =
    packet?.status === "sent"
      ? "Awaiting surgeon reply"
      : packet?.status === "sending"
        ? "Sending to Earth"
        : packet?.status === "failed"
          ? "Link down, retrying"
          : "Queued for Earth";

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!c) return;
    setBusy(true);
    try {
      const at = nowIso();
      const out: Alert[] = [];
      for (const r of RETEST) {
        const raw = values[r.key]?.trim();
        if (!raw || !Number.isFinite(Number(raw))) continue;
        const { alert } = await store.recordMeasurement({
          crewId: SIM_CREW.id,
          key: r.key,
          value: Number(raw),
          unit: UNITS[r.key],
          source: "emergency-test",
          takenAt: at,
          caseId: c.id,
        });
        if (alert) out.push(alert);
      }
      setAlerts(out);
      setValues({});
      setLastCheck(Date.now());
      setRetest(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="monitor-banner" aria-label="Monitoring">
      <span className="icon-badge">
        <Icon name="pulse" size={20} />
      </span>
      <div className="grow">
        <p className="t">Monitoring</p>
        <p className="d">Sent. Watch for changes, re-measure soon.</p>
      </div>
      <span className="pill">
        <Icon name="clock" size={18} /> Next check in {mmss(from + CHECK_EVERY_MS - now)}
      </span>
      <span className="pill">
        <span className={`dot ${packet?.status === "failed" ? "act" : "watch"}`} /> {status}
      </span>
      <button type="button" className="btn primary" aria-expanded={retest} onClick={() => setRetest((r) => !r)}>
        <Icon name="refresh" size={18} /> Re-measure now
      </button>
      <button
        type="button"
        className="btn"
        style={{ background: "transparent", color: "#fff", borderColor: "rgb(255 255 255 / 0.3)" }}
        onClick={() => {
          if (window.confirm("Close this case? A new Emergency visit will start at intake.")) void api.closeCase();
        }}
      >
        Close case
      </button>
      {retest ? (
        <form className="retest" onSubmit={(e) => void save(e)}>
          {RETEST.map((r) => (
            <div key={r.key} className="field" style={{ width: 180 }}>
              <span className="d">{r.label}</span>
              <UnitInput
                unit={UNITS[r.key]}
                value={values[r.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
                aria-label={r.label}
              />
            </div>
          ))}
          <button type="submit" className="btn primary" disabled={busy}>
            <Icon name="check" size={18} /> Save readings
          </button>
        </form>
      ) : null}
      {alerts.length ? (
        <div className="alert-pattern-grid" style={{ width: "100%", marginTop: 4 }}>
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} compact />
          ))}
        </div>
      ) : null}
    </section>
  );
}
