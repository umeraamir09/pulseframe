import { useState, type FormEvent } from "react";
import type { Alert } from "../../contracts";
import { AlertCard } from "../../ui/AlertCard";
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
    <form className="log-form" onSubmit={(e) => void submit(e)}>
      <h2>Log a dosimeter reading</h2>
      <div className="check-input flush">
        <label htmlFor="rad-rate">Dose rate</label>
        <input
          id="rad-rate"
          type="number"
          step="any"
          min={0}
          inputMode="decimal"
          placeholder="e.g. 18.0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        <span className="muted">µGy/h</span>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save reading"}
        </button>
      </div>
      <p className="muted small">The cumulative dose is updated from your last reading and the hours since it.</p>
      {error ? <p className="error">{error}</p> : null}
      {saved ? (
        <div role="status">
          <p className="muted small">
            Saved {saved.rate} µGy/h · cumulative {saved.cumulative.toFixed(3)} mGy since log start.
            {saved.alert ? "" : " Within your usual range."}
          </p>
          {saved.alert ? <AlertCard alert={saved.alert} compact /> : null}
        </div>
      ) : null}
    </form>
  );
}
