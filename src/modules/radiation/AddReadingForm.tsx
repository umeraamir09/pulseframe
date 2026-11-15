import { useState, type FormEvent } from "react";
import type { Alert } from "../../contracts";
import { AlertCard } from "../../ui/AlertCard";
import { UnitInput } from "../../ui/controls";
import { Icon } from "../../ui/Icon";
import { saveReading } from "./saveReading";

export function AddReadingForm() {
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<{ rate: number; cumulative: number; alert?: Alert }>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (rate.trim() === "") {
      setError("Enter the dose rate shown on the dosimeter.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const { reading, alert } = await saveReading(Number(rate));
      setSaved({ rate: reading.rateUgyPerHour ?? Number(rate), cumulative: reading.cumulativeMgy, alert });
      setRate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="add-reading" onSubmit={(e) => void submit(e)} style={{ marginTop: 0 }}>
        <div className="field" style={{ width: 240 }}>
          <span className="field-label">Dose rate on the dosimeter</span>
          <UnitInput unit="µGy/h" min={0} placeholder="18.0" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Dose rate" />
        </div>
        <button type="submit" className="btn primary" disabled={busy}>
          <Icon name="check" size={18} /> {busy ? "Saving…" : "Save reading"}
        </button>
        <span className="muted small grow">Cumulative dose is updated from your last reading and the hours since it.</span>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {saved ? (
        <div role="status" className="stack">
          <p className={`note ${saved.alert ? "watch" : "normal"}`}>
            <Icon name={saved.alert ? "alert" : "check"} size={16} />
            Saved {saved.rate} µGy/h · cumulative {saved.cumulative.toFixed(3)} mGy.
            {saved.alert ? "" : " Within your usual range."}
          </p>
          {saved.alert ? <AlertCard alert={saved.alert} compact /> : null}
        </div>
      ) : null}
    </div>
  );
}
