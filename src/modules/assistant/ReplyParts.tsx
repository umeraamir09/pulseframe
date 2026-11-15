import { Icon } from "../../ui/Icon";
import { numberMarkers, type ResolvedCitations } from "./citations";
import { AnswerBlocks } from "./AnswerBlocks";
import type { AnswerBlock } from "./answerBlocks";
import { GENERAL_NOTE, REJECTED_LINE } from "./copy";
import { useTypewriter } from "./useTypewriter";

/** One numbered chip per source, linking to the source page. */
export function SourceChips({ citations }: { citations: ResolvedCitations }) {
  if (!citations.sources.length) return null;
  return (
    <div className="sources-row">
      <span className="muted small">Sources</span>
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
    </div>
  );
}

/**
 * A live answer: the lead text (typed out when `animate`), then the visual
 * blocks, then the source chips. Research answers show source numbers; general
 * answers say they are not from Pulseframe research.
 */
export function LiveAnswer({
  kind,
  text,
  citations,
  blocks,
  animate = false,
}: {
  kind: "research" | "general";
  text: string;
  citations: ResolvedCitations;
  blocks: readonly AnswerBlock[];
  animate?: boolean;
}) {
  const lead = numberMarkers(text, citations.byChunk);
  const { shown, done } = useTypewriter(lead, animate);
  return (
    <>
      <p className="lead-text">
        {shown}
        {done ? null : <span className="caret" aria-hidden="true" />}
      </p>
      {done ? (
        <>
          <AnswerBlocks blocks={blocks} byChunk={citations.byChunk} reveal={animate} />
          {kind === "general" ? (
            <p className={`muted small${animate ? " reveal" : ""}`}>{GENERAL_NOTE}</p>
          ) : (
            <SourceChips citations={citations} />
          )}
        </>
      ) : null}
    </>
  );
}

/** Body of a cited answer with no blocks (kept for callers that only have text). */
export function ResearchReply({ text, citations }: { text: string; citations: ResolvedCitations }) {
  return <LiveAnswer kind="research" text={text} citations={citations} blocks={[]} />;
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
