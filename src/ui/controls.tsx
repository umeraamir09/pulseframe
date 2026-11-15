import type { InputHTMLAttributes, ReactNode } from "react";

/** Number field with its unit on the right (Figma "Input with unit"). */
export function UnitInput({
  unit,
  size,
  className,
  ...input
}: { unit: string; size?: "sm"; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "size">) {
  return (
    <label className={`unit-input${size ? ` ${size}` : ""}${className ? ` ${className}` : ""}`}>
      <input type="number" inputMode="decimal" step="any" {...input} />
      <span className="u">{unit}</span>
    </label>
  );
}

/** 1 to 5 picker with 56 px targets. Values below the pick are tinted, the pick is solid. */
export function Scale5({
  value,
  onChange,
  low,
  high,
  label,
  before,
  after,
}: {
  value: number;
  onChange: (v: number) => void;
  low: string;
  high: string;
  label: string;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div className="scale5">
      <div className="row">
        {before}
        <div className="scale5-dots" role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} of 5`}
              className={n < value ? "below" : undefined}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {after}
      </div>
      <div className="scale5-ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Segmented pill control backed by radio semantics. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`seg${className ? ` ${className}` : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ pct, tone, label }: { pct: number; tone?: "normal" | "watch"; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      className={`progress${tone ? ` ${tone}` : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label}
    >
      <span style={{ width: `${v}%` }} />
    </div>
  );
}
