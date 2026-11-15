import { Link } from "react-router-dom";
import { Icon } from "../../ui/Icon";
import { ASSISTANT_DISCLAIMER, GENERAL_LABEL } from "./copy";
import type { ReplyAction } from "./types";

interface CardReply {
  text: string;
  kind?: string;
  steps?: string[];
  actions?: ReplyAction[];
  redFlag?: string;
  badge?: string;
}

function visibleBody(text: string): string {
  return text
    .replaceAll(GENERAL_LABEL, "")
    .replaceAll(ASSISTANT_DISCLAIMER, "")
    .replace(/^[\s.]+/, "")
    .trim();
}

/** Short action card for emergency, app help, and general answers. */
export function ActionCard({ reply, showBadge = true }: { reply: CardReply; showBadge?: boolean }) {
  if (reply.kind !== "emergency" && reply.kind !== "app" && reply.kind !== "general") return null;
  const urgent = reply.kind === "emergency";
  const body = visibleBody(reply.text);
  return (
    <div className={`action-card${urgent ? " is-emergency" : ""}`}>
      {showBadge && reply.badge ? <span className={`tag${urgent ? " act" : ""}`}>{reply.badge}</span> : null}
      {reply.redFlag ? (
        <p className="action-flag">
          <Icon name="alert" size={16} /> {reply.redFlag}
        </p>
      ) : null}
      {reply.steps?.length ? (
        <ol className="action-steps">
          {reply.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : body ? (
        <p>{body}</p>
      ) : null}
      {reply.actions?.length ? (
        <div className="action-actions">
          {reply.actions.map((action, index) => (
            <Link
              key={`${action.label}-${action.to}`}
              to={action.to}
              className={urgent && index === 0 ? "btn danger" : "btn secondary"}
            >
              <Icon name={urgent && index === 0 ? "siren" : "arrowR"} size={18} />
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
      <p className="muted small">{ASSISTANT_DISCLAIMER}</p>
    </div>
  );
}
