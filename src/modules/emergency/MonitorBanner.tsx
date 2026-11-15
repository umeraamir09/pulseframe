import { useState, type FormEvent } from "react";
import { UNITS, type Alert } from "../../contracts";
import { store, useLive } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { errorMessage, recordCaseMeasurement } from "./caseActions";

const FIELDS = [
  { key: "heartRate", label: "Heart rate" },
  { key: "systolicBP", label: "Systolic BP" },
  { key: "diastolicBP", label: "Diastolic BP" },
] as const;

function packetLine(status: string | undefined): string {
  if (!status) return "Packet status: waiting for the outbox.";
  if (status === "queued" || status === "sending") return `Packet status: ${status}. Awaiting surgeon reply.`;
  if (status === "sent") return "Packet status: sent. Awaiting surgeon reply.";
  if (status === "failed") return "Packet status: failed. The sync loop will retry.";
  return `Packet status: ${status}.`;
}

export function MonitorBanner({
  caseId,
  packetId,
  onClose,
}: {
  caseId: string;
  packetId?: string;
  onClose: () => Promise<void>;
}) {
  const packets = useLive(() => store.listPackets(), []);
  const packet = packets.data?.find((row) => row.id === packetId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const filled = FIELDS.some((field) => values[field.key]?.trim());

  async function remeasure(event: FormEvent) {
    event.preventDefault();
    if (!filled || busy) return;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const next: Alert[] = [];
      for (const field of FIELDS) {
        const raw = values[field.key]?.trim();
        if (!raw) continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          setError(`Enter a number for ${field.label}.`);
          setBusy(false);
          return;
        }
        const result = await recordCaseMeasurement(caseId, field.key, value);
        if (result.alert) next.push(result.alert);
      }
      setAlerts(next);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="em-monitor" aria-label="Monitoring">
      <div className="em-monitor-copy">
        <h2>Monitoring</h2>
        <p>Monitoring. Re-check heart rate and blood pressure and enter them below.</p>
        <p role="status">{packetLine(packet?.status)}</p>
      </div>
      <form className="em-retest" onSubmit={(event) => void remeasure(event)}>
        {FIELDS.map((field) => (
          <label key={field.key}>
            {field.label}
            <span>
              <input
                type="number"
                inputMode="decimal"
                value={values[field.key] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              />
              <span className="unit">{UNITS[field.key]}</span>
            </span>
          </label>
        ))}
        <button type="submit" className="primary" disabled={!filled || busy}>
          {busy ? "Saving…" : "Re-measure now"}
        </button>
      </form>
      {saved ? <p className="em-saved">Saved on this case.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
      <button type="button" className="em-close" onClick={() => void onClose().catch((err: unknown) => setError(errorMessage(err)))}>
        Close case
      </button>
    </section>
  );
}
