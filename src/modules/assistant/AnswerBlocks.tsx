import type { CSSProperties } from "react";
import { Icon } from "../../ui/Icon";
import type { AnswerBlock, FactsBlock, ListBlock, RangeBlock, StepsBlock, WarningBlock } from "./answerBlocks";

type ByChunk = Record<string, number[]>;

/** Source numbers for a set of chunk ids, matching the numbered source chips. */
export function CiteRefs({ cite, byChunk }: { cite: readonly string[]; byChunk: ByChunk }) {
  const numbers = [...new Set(cite.flatMap((id) => byChunk[id] ?? []))].sort((a, b) => a - b);
  if (!numbers.length) return null;
  return (
    <span className="cite-refs" aria-label={`Sources ${numbers.join(", ")}`}>
      {numbers.map((n) => (
        <sup key={n}>{n}</sup>
      ))}
    </span>
  );
}

function BlockTitle({ text }: { text: string }) {
  return text ? <h3 className="block-title">{text}</h3> : null;
}

function Facts({ block, byChunk }: { block: FactsBlock; byChunk: ByChunk }) {
  return (
    <section className="ans-block">
      <BlockTitle text={block.title} />
      <dl className="fact-grid">
        {block.items.map((item, i) => (
          <div key={i} className="fact">
            <dt>{item.label}</dt>
            <dd>
              {item.value}
              <CiteRefs cite={item.cite} byChunk={byChunk} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** A normal-range bar: the band is the stated range; an open bound runs to the end of the track. */
function Range({ block, byChunk }: { block: RangeBlock; byChunk: ByChunk }) {
  const { low, high, unit } = block;
  const u = unit ? ` ${unit}` : "";
  const value =
    low !== null && high !== null
      ? `${formatNumber(low)}–${formatNumber(high)}${u}`
      : low !== null
        ? `≥ ${formatNumber(low)}${u}`
        : `≤ ${formatNumber(high!)}${u}`;
  const band: CSSProperties = { left: low !== null ? "18%" : "0%", right: high !== null ? "18%" : "0%" };
  return (
    <section className="ans-block range-block">
      <div className="range-head">
        <span className="range-label">{block.label}</span>
        <span className="range-value">
          {value}
          <CiteRefs cite={block.cite} byChunk={byChunk} />
        </span>
      </div>
      <div className="range-track" role="img" aria-label={`${block.label}: ${value}`}>
        <span className="range-band" style={band} />
        {low !== null ? (
          <span className="range-tick" style={{ left: "18%" }}>
            {formatNumber(low)}
          </span>
        ) : null}
        {high !== null ? (
          <span className="range-tick" style={{ left: "82%" }}>
            {formatNumber(high)}
          </span>
        ) : null}
      </div>
      {block.note ? <p className="muted small">{block.note}</p> : null}
    </section>
  );
}

function Steps({ block, byChunk }: { block: StepsBlock; byChunk: ByChunk }) {
  return (
    <section className="ans-block">
      <BlockTitle text={block.title} />
      <ol className="step-list">
        {block.items.map((item, i) => (
          <li key={i}>
            <span className="step-n" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <div className="step-t">
                {item.title}
                <CiteRefs cite={item.cite} byChunk={byChunk} />
              </div>
              {item.detail ? <div className="muted small">{item.detail}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Warning({ block, byChunk }: { block: WarningBlock; byChunk: ByChunk }) {
  return (
    <section className="ans-block warn-block" role="note">
      <div className="warn-head">
        <Icon name="alert" size={18} />
        <span>{block.title || "Contact the flight surgeon if"}</span>
        <CiteRefs cite={block.cite} byChunk={byChunk} />
      </div>
      <ul>
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function List({ block, byChunk }: { block: ListBlock; byChunk: ByChunk }) {
  return (
    <section className="ans-block">
      <BlockTitle text={block.title} />
      <ul className="point-list">
        {block.items.map((item, i) => (
          <li key={i}>
            <Icon name="check" size={14} />
            <span>
              {item.text}
              <CiteRefs cite={item.cite} byChunk={byChunk} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AnswerBlockView({ block, byChunk }: { block: AnswerBlock; byChunk: ByChunk }) {
  switch (block.type) {
    case "facts":
      return <Facts block={block} byChunk={byChunk} />;
    case "range":
      return <Range block={block} byChunk={byChunk} />;
    case "steps":
      return <Steps block={block} byChunk={byChunk} />;
    case "warning":
      return <Warning block={block} byChunk={byChunk} />;
    case "list":
      return <List block={block} byChunk={byChunk} />;
  }
}

/** Blocks in order; `reveal` staggers a fade-in after the lead text finishes typing. */
export function AnswerBlocks({ blocks, byChunk, reveal }: { blocks: readonly AnswerBlock[]; byChunk: ByChunk; reveal: boolean }) {
  if (!blocks.length) return null;
  return (
    <div className="ans-blocks">
      {blocks.map((block, i) => (
        <div key={i} className={reveal ? "reveal" : undefined} style={reveal ? { animationDelay: `${i * 90}ms` } : undefined}>
          <AnswerBlockView block={block} byChunk={byChunk} />
        </div>
      ))}
    </div>
  );
}
