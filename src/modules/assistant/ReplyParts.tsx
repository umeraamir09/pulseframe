import { Icon } from "../../ui/Icon";
import { numberMarkers, type ResolvedCitations } from "./citations";
import { REJECTED_LINE } from "./copy";

/** Body of a live answer: the text with numbered source markers, then one chip per source. */
export function ResearchReply({ text, citations }: { text: string; citations: ResolvedCitations }) {
  const lines = numberMarkers(text, citations.byChunk).split("\n");
  return (
    <>
      <div className="reply-text">
        {lines.map((line, index) => (line === "" ? <span key={index} style={{ height: 6 }} /> : <p key={index}>{line}</p>))}
      </div>
      {citations.sources.length ? (
        <ol className="source-chips" aria-label="Sources">
          {citations.sources.map((source) => (
            <li key={source.id}>
              <a
                className="source-chip"
                href={source.url}
                target="_blank"
                rel="noreferrer"
                title={source.section ? `${source.title}, ${source.section}` : source.title}
              >
                <span className="n">{source.n}</span>
                <Icon name="book" size={14} />
                <span className="label">{source.title}</span>
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

/** The research pack does not cover the question: show only the server's fixed line, never a guess. */
export function NotInResearch({ text }: { text: string }) {
  return (
    <p className="note watch" role="status">
      <Icon name="info" size={16} /> {text}
    </p>
  );
}

/** Draft item ids that validateRecommendation() dropped because they are not in the onboard kit. */
export function RejectedItems({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="row wrap">
      <span className="tag act" style={{ height: 36, padding: "0 14px", fontSize: 14 }}>
        <Icon name="ban" size={16} /> {REJECTED_LINE}
      </span>
      <span className="muted small">Only onboard kit items are shown. Dropped: {ids.join(", ")}</span>
    </div>
  );
}
