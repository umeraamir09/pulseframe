import type { ReactNode } from "react";

export function StageCard({
  kicker,
  title,
  meta,
  children,
}: {
  kicker: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="em-card">
      <p className="em-kicker">{kicker}</p>
      <div className="em-card-head">
        <h2>{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

export function MiniProgress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="em-mini">
      <span>
        {done} of {total} done
      </span>
      <span className="em-mini-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
