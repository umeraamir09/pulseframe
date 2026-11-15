import type { ProtocolCard } from "../protocols";

/**
 * Optional researcher fields of a protocol card. Renders nothing for team cards
 * that do not carry them. Shows no dose (decisions.md section 1).
 */
export function ProtocolDetails({ card }: { card: ProtocolCard }) {
  const lifeThreat = card.redFlagsLifeThreat ?? [];
  const callGround = card.redFlagsCallGround ?? [];
  const timeLimits = card.timeLimits ?? [];
  const sources = card.sources ?? [];
  const ground = card.whenGroundUnavailable;

  if (!lifeThreat.length && !callGround.length && !timeLimits.length && !ground && !sources.length) return null;

  return (
    <div className="em-protocol-details">
      {lifeThreat.length ? (
        <section className="em-redflags is-act" aria-label="Life threat red flags">
          <p className="em-field-label">Act now if any of these</p>
          <ul>
            {lifeThreat.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {callGround.length ? (
        <section className="em-redflags" aria-label="Call the flight surgeon red flags">
          <p className="em-field-label">Call the flight surgeon if any of these</p>
          <ul>
            {callGround.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {timeLimits.length ? (
        <section aria-label="Time limits">
          <p className="em-field-label">Time limits</p>
          <ul className="em-time-limits">
            {timeLimits.map((limit) => (
              <li key={limit.item}>{limit.item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {ground ? (
        <details className="em-ground">
          <summary>If the ground cannot be reached</summary>
          <p className="muted small">{ground.status}</p>
          <p>{ground.detail}</p>
          {ground.firstAidThatNeedsNoGround.length ? (
            <ul>
              {ground.firstAidThatNeedsNoGround.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
      {sources.length ? (
        <details className="em-sources">
          <summary>Sources ({sources.length})</summary>
          <ol>
            {sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <span className="muted small">
                  {" "}
                  · {source.section} · confidence {source.confidence} · accessed {source.accessed}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
