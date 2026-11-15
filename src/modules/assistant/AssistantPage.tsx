import { useEffect, useRef, useState } from "react";
import { DictateButton } from "../../ui/DictateButton";
import { mergeTranscript } from "../../ui/dictation";
import { Link } from "react-router-dom";
import type { Alert, InventoryItem } from "../../contracts";
import { KEY_LABELS } from "../../contracts";
import { SIM_CREW, missionDayLabel, missionDayOf, store, useLive } from "../../data/db";
import { Icon, type IconName } from "../../ui/Icon";
import { usePageMeta } from "../../ui/pageMeta";
import { ActionCard } from "./ActionCard";
import { Formulary } from "./Formulary";
import { GivenDialog } from "./GivenDialog";
import { KitSuggestions } from "./KitSuggestions";
import { EMPTY_CITATIONS, loadCitations, type ResolvedCitations } from "./citations";
import {
  LIVE_FALLBACK_NOTE,
  MODE_LIVE,
  MODE_OFFLINE,
  GENERAL_ANSWER_TITLE,
  NOT_IN_RESEARCH_TITLE,
  RESEARCH_ANSWER_TITLE,
} from "./copy";
import { getProvider, isOfflineCommand, type LastTurn } from "./providers";
import type { ReplyAction } from "./types";
import type { AnswerBlock } from "./answerBlocks";
import { AstronautAvatar } from "./AstronautAvatar";
import type { AstronautPose } from "./AstronautScene";
import { LiveAnswer, NotInResearch, RejectedItems } from "./ReplyParts";
import { validateRecommendation } from "./validate";

interface Turn {
  id: string;
  command: string;
  text: string;
  rejectedItemIds: string[];
  kept: InventoryItem[];
  alerts?: Alert[];
  /** Items matched by `find` or shown by `item`, for card rendering. */
  items?: InventoryItem[];
  /** Live free-text answer: cited ("answer"), general and uncited ("general"), or outside the research pack ("notFound"). */
  research?: "answer" | "general" | "notFound";
  citations?: ResolvedCitations;
  blocks?: AnswerBlock[];
  /** Emergency or app-help card. Shown instead of a text wall. */
  action?: {
    kind: "emergency" | "app";
    title?: string;
    steps?: string[];
    actions?: ReplyAction[];
    redFlag?: string;
    badge?: string;
  };
}

/** Example questions shown before the first message in live mode. */
const SUGGESTED = [
  "What is normal in-flight heart rate?",
  "What causes headaches on the ISS?",
  "What do I do if a crewmate is choking?",
  "How does microgravity affect sleep?",
];

const QUICK: ({ id: string; label: string; icon: IconName } & ({ run: string } | { fill: string }))[] = [
  { id: "suggest", label: "Suggest", icon: "sparkles", run: "suggest" },
  { id: "find", label: "Find item", icon: "search", fill: "find " },
  { id: "item", label: "Item details", icon: "info", fill: "item " },
  { id: "alerts", label: "Explain alerts", icon: "bell", run: "alerts" },
  { id: "help", label: "Help", icon: "help", run: "help" },
];

function commandVerb(command: string): string {
  return command.trim().toLowerCase();
}

/** Same match rule as the offline provider's `find`. */
function findItems(inventory: InventoryItem[], query: string): InventoryItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return inventory.filter((item) => item.name.toLowerCase().includes(needle) || item.comments.toLowerCase().includes(needle));
}

function commandLabel(command: string, inventory: InventoryItem[]): string {
  const v = commandVerb(command);
  if (v === "alerts" || v === "explain alerts") return "Explain alerts";
  if (v === "suggest") return "Suggest";
  if (v === "help") return "Help";
  if (v.startsWith("find ")) return `Find item: ${command.trim().slice(5)}`;
  if (v.startsWith("item ")) {
    const id = command.trim().slice(5).trim();
    return `Item details: ${inventory.find((i) => i.id.toLowerCase() === id.toLowerCase())?.name ?? id}`;
  }
  return command;
}

export function AssistantPage() {
  usePageMeta(
    "AI assistant",
    import.meta.env.VITE_ASSISTANT_MODE === "live" ? "Answers from Pulseframe research · onboard kit" : "Onboard kit only · answers as cards",
  );
  const inventory = useLive(() => store.listInventory(), []);
  const openCase = useLive(() => store.getOpenCase(SIM_CREW.id), []);
  const alerts = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [pendingCommand, setPendingCommand] = useState<string>();
  /** Only the newest live answer types itself out. */
  const [animateId, setAnimateId] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const [lastCommand, setLastCommand] = useState("");
  const lastTurn = useRef<LastTurn | undefined>(undefined);
  const [giving, setGiving] = useState<{ item: InventoryItem; caseId?: string } | null>(null);
  const [selected, setSelected] = useState<string>();
  const [loggedName, setLoggedName] = useState<string>();
  const alive = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const live = import.meta.env.VITE_ASSISTANT_MODE === "live";

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function run(raw: string) {
    const command = raw.trim();
    const rows = inventory.data;
    if (!command || pending || !rows) return;
    setPending(true);
    setPendingCommand(command);
    setDraft("");
    setLoggedName(undefined);
    try {
      const provider = getProvider();
      const current = openCase.data;
      const reply = await provider.ask({
        command,
        inventory: rows,
        lastTurn: lastTurn.current,
        caseCtx: current
          ? {
              caseId: current.id,
              crewId: current.crewId,
              narrative: current.narrative,
              regionIds: current.regionIds,
              protocolId: current.protocolId,
            }
          : undefined,
      });
      if (!alive.current) return;
      const offline = provider.name === "offline" || reply.text.includes(LIVE_FALLBACK_NOTE);
      const action: Turn["action"] =
        reply.kind === "emergency" || reply.kind === "app"
          ? {
              kind: reply.kind,
              title: reply.title,
              steps: reply.steps,
              actions: reply.actions,
              redFlag: reply.redFlag,
              badge: reply.badge,
            }
          : undefined;
      const research: Turn["research"] =
        action || reply.kind === "formulary" || offline || isOfflineCommand(command)
          ? undefined
          : reply.notFound || reply.kind === "notFound"
            ? "notFound"
            : reply.kind === "general"
              ? "general"
              : "answer";
      let citations: ResolvedCitations | undefined;
      if (research === "answer") {
        citations = await loadCitations(reply.citations ?? []).catch(() => EMPTY_CITATIONS);
        if (!alive.current) return;
      }
      if (research === "answer" || research === "general") lastTurn.current = { question: command, answer: reply.text };
      const validation =
        reply.draft !== undefined ? validateRecommendation(reply.draft, rows, current?.id ?? "no-case", offline) : undefined;
      const kept = (validation?.recommendation?.itemIds ?? [])
        .map((id) => rows.find((item) => item.id === id))
        .filter((item): item is InventoryItem => item !== undefined);
      const verb = commandVerb(command);
      const openAlerts = (alerts.data ?? []).filter((alert) => !alert.ackedAt);
      const items = verb.startsWith("find ")
        ? findItems(rows, command.trim().slice(5))
        : verb.startsWith("item ")
          ? rows.filter((i) => i.id.toLowerCase() === command.trim().slice(5).trim().toLowerCase())
          : undefined;
      if (items?.length === 1) setSelected(items[0]!.id);
      const id = crypto.randomUUID();
      if (research) setAnimateId(id);
      setHistory((turns) => [
        ...turns,
        {
          id,
          command,
          text: reply.text,
          rejectedItemIds: validation?.rejectedItemIds ?? [],
          kept,
          items,
          alerts: verb === "alerts" || verb === "explain alerts" ? openAlerts : undefined,
          research,
          citations,
          blocks: reply.blocks,
          action,
        },
      ]);
      setLastCommand(command);
    } catch (err) {
      if (!alive.current) return;
      setHistory((turns) => [
        ...turns,
        {
          id: crypto.randomUUID(),
          command,
          text: err instanceof Error ? err.message : "The assistant could not answer. Try again.",
          rejectedItemIds: [],
          kept: [],
        },
      ]);
    } finally {
      if (alive.current) {
        setPending(false);
        setPendingCommand(undefined);
      }
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [history.length, pending]);

  function quick(action: (typeof QUICK)[number]) {
    if ("fill" in action) {
      setDraft(action.fill);
      inputRef.current?.focus();
      return;
    }
    void run(action.run);
  }

  const lastVerb = commandVerb(lastCommand);
  const give = (item: InventoryItem) => setGiving({ item, caseId: openCase.data?.id });

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="card assistant-top" aria-label="Ask the assistant">
        <div className="command-row">
          <form
            className="command-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(draft);
            }}
          >
            <Icon name="sparkles" size={22} />
            <input
              ref={inputRef}
              value={draft}
              placeholder={live ? "Ask a question, or type a command like find" : "Ask about the onboard kit or your alerts"}
              aria-label="Assistant command"
              onChange={(event) => setDraft(event.target.value)}
              disabled={pending || inventory.data === undefined}
            />
            <DictateButton
              disabled={pending || inventory.data === undefined}
              onTranscript={(text) => {
                setDraft((current) => mergeTranscript(current, text));
                inputRef.current?.focus();
              }}
            />
            <button type="submit" className="send-btn" aria-label="Send command" disabled={pending || !draft.trim()}>
              <Icon name="arrowR" size={20} />
            </button>
          </form>
          <div className="mode-seg" aria-label="Assistant mode">
            <span className={live ? undefined : "on"}>
              <span className="dot" /> {MODE_OFFLINE}
            </span>
            <span className={live ? "on" : undefined}>
              <span className="dot" /> {live ? MODE_LIVE : "Live"}
            </span>
          </div>
        </div>
        <div className="quick-row" role="group" aria-label="Commands">
          {QUICK.map((action) => {
            const on =
              action.id === "find"
                ? lastVerb.startsWith("find")
                : action.id === "item"
                  ? lastVerb.startsWith("item")
                  : action.id === "alerts"
                    ? lastVerb === "alerts" || lastVerb === "explain alerts"
                    : lastVerb === action.id || lastVerb.startsWith(`${action.id} `);
            return (
              <button key={action.id} type="button" className={on ? "chip on" : "chip"} onClick={() => quick(action)}>
                <Icon name={action.icon} size={18} />
                {action.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="assistant-grid">
        <div className="history" aria-live="polite">
          {loggedName ? (
            <p className="note normal" role="status">
              <Icon name="check" size={16} /> Logged {loggedName}. The text saved is only what you typed.
            </p>
          ) : null}
          <AssistantPresence
            pose={pending ? "type" : history.length ? "point" : "wave"}
            message={presenceMessage(pending, live, history.at(-1))}
            suggestions={live && !history.length ? SUGGESTED : []}
            onAsk={(q) => void run(q)}
          />
          {history.map((turn) => (
            <TurnView
              key={turn.id}
              turn={turn}
              animate={turn.id === animateId}
              inventory={inventory.data ?? []}
              onRun={(c) => void run(c)}
              onGive={give}
            />
          ))}
          {pendingCommand ? (
            <>
              <p className="command-pill">
                <Icon name="chat" size={16} />
                {commandLabel(pendingCommand, inventory.data ?? [])}
              </p>
              <div className="bot-row">
                <BotFace />
                <div className="typing-bubble" role="status" aria-label="The assistant is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </>
          ) : null}
          <div ref={endRef} />
          {openCase.data ? <KitSuggestions caseId={openCase.data.id} onGive={give} /> : null}
        </div>

        <Formulary items={inventory.data} selected={selected} onConfirm={give} />
      </div>

      {giving ? (
        <GivenDialog
          item={giving.item}
          caseId={giving.caseId}
          onClose={() => setGiving(null)}
          onLogged={(row) => {
            const name = inventory.data?.find((item) => item.id === row.itemId)?.name ?? "item";
            setLoggedName(name);
            setGiving(null);
          }}
        />
      ) : null}
    </div>
  );
}

function commandTitle(turn: Turn, lines: string[], rejected: boolean): string {
  return turn.alerts
    ? `${turn.alerts.length} open alert${turn.alerts.length === 1 ? "" : "s"}`
    : rejected
      ? "Not available"
      : turn.items && commandVerb(turn.command).startsWith("find")
        ? turn.items.length
          ? `${turn.items.length} match${turn.items.length === 1 ? "" : "es"} in onboard kit`
          : "No match in onboard kit"
        : lines[0]!.replace(/[.:]$/, "");
}

function sourceCount(citations: ResolvedCitations | undefined): string {
  const n = citations?.sources.length ?? 0;
  return n ? `${n} source${n === 1 ? "" : "s"}` : "Research";
}

function presenceMessage(pending: boolean, live: boolean, last: Turn | undefined): string {
  if (pending) return live ? "Looking through Pulseframe research…" : "Checking the onboard kit…";
  if (!last) {
    return live
      ? "Hi, I'm the Pulseframe assistant. Ask me about crew health, vitals or the onboard kit, or say hello."
      : "Hi, I'm the Pulseframe assistant. Try Explain alerts, or type find with part of an item name.";
  }
  if (last.action?.kind === "emergency") return "Open Emergency now. If they stop breathing or lose consciousness, start CPR and call the flight surgeon.";
  if (last.action?.kind === "app") return "Here is how that part of the station works.";
  if (last.research === "notFound") return "That isn't in Pulseframe research. For anything serious, contact the flight surgeon.";
  if (last.research === "general") return "That's general knowledge. Ask me about crew health for a cited answer.";
  return "Here's what I found. Ask a follow-up any time.";
}

function BotFace() {
  return <img className="bot-face" src="/mascot.jpg" alt="" />;
}

function AssistantPresence({
  pose,
  message,
  suggestions,
  onAsk,
}: {
  pose: AstronautPose;
  message: string;
  suggestions: string[];
  onAsk: (question: string) => void;
}) {
  return (
    <section className="assistant-presence" aria-label="Assistant">
      <AstronautAvatar pose={pose} label={pose === "type" ? "Astronaut typing" : pose === "point" ? "Astronaut pointing" : "Astronaut waving"} />
      <div className="presence-body">
        <p className="speech" aria-live="polite">
          {message}
        </p>
        {suggestions.length ? (
          <div className="suggest-row" role="group" aria-label="Suggested questions">
            {suggestions.map((q) => (
              <button key={q} type="button" className="chip sm" onClick={() => onAsk(q)}>
                {q}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TurnView({
  turn,
  animate,
  inventory,
  onRun,
  onGive,
}: {
  turn: Turn;
  animate: boolean;
  inventory: InventoryItem[];
  onRun: (command: string) => void;
  onGive: (item: InventoryItem) => void;
}) {
  const [why, setWhy] = useState(false);
  const lines = turn.text.split("\n");
  const rejected = turn.rejectedItemIds.length > 0;
  const title = turn.action?.title
    ? turn.action.title
    : turn.research === "notFound"
      ? NOT_IN_RESEARCH_TITLE
      : turn.research === "answer"
        ? RESEARCH_ANSWER_TITLE
        : turn.research === "general"
          ? GENERAL_ANSWER_TITLE
          : commandTitle(turn, lines, rejected);
  const body = turn.action || turn.research || turn.alerts || (turn.items && turn.items.length) ? [] : lines.slice(1);
  const tag = turn.action?.badge
    ? turn.action.badge
    : turn.research === "general"
      ? "General"
      : turn.research === "answer"
        ? sourceCount(turn.citations)
        : turn.research
          ? "Research"
          : rejected
            ? "Guardrail"
            : "Protocol card";

  return (
    <>
      <p className="command-pill">
        <Icon name="chat" size={16} />
        {commandLabel(turn.command, inventory)}
      </p>
      <div className="bot-row">
        <BotFace />
        <article className={animate ? "reply-card enter" : "reply-card"}>
          <div className="reply-head">
            <span className="icon-badge sm accent sq">
              <Icon name="sparkles" size={16} />
            </span>
            <h2 className="h3">{title}</h2>
            <span className="tag">{tag}</span>
          </div>

          {turn.action ? (
            <ActionCard
              showBadge={false}
              reply={{
                text: turn.text,
                kind: turn.action.kind,
                steps: turn.action.steps,
                actions: turn.action.actions,
                redFlag: turn.action.redFlag,
                badge: turn.action.badge,
              }}
            />
          ) : null}
          {turn.action && turn.text.includes(LIVE_FALLBACK_NOTE) ? <p className="tag">{LIVE_FALLBACK_NOTE}</p> : null}

          {turn.research === "notFound" ? <NotInResearch text={turn.text} /> : null}
          {turn.research === "answer" || turn.research === "general" ? (
            <LiveAnswer
              kind={turn.research === "answer" ? "research" : "general"}
              text={turn.text}
              citations={turn.citations ?? EMPTY_CITATIONS}
              blocks={turn.blocks ?? []}
              animate={animate}
            />
          ) : null}

          {turn.alerts ? (
            <>
              <AlertBars alerts={turn.alerts} />
              {why ? (
                <div className="reply-text muted">
                  {lines.map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </div>
              ) : null}
              <div className="row wrap">
                <span className="muted small grow">Bar = distance from your own baseline</span>
                <button type="button" className="btn ghost" aria-expanded={why} onClick={() => setWhy((w) => !w)}>
                  Why?
                </button>
                <Link to="/alerts" className="btn primary">
                  <Icon name="arrowR" size={18} /> Open alerts
                </Link>
              </div>
            </>
          ) : null}

          {turn.items && turn.items.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {turn.items.map((item) =>
                commandVerb(turn.command).startsWith("item") ? (
                  <ItemDetail key={item.id} item={item} onGive={onGive} />
                ) : (
                  <div key={item.id} className="item-row">
                    <span className="icon-badge white">
                      <Icon name="pill" size={18} />
                    </span>
                    <div className="grow">
                      <div className="t">{item.name}</div>
                      <div className="d">
                        {item.strength} · {item.route}
                      </div>
                    </div>
                    <button type="button" className="btn secondary" onClick={() => onRun(`item ${item.id}`)}>
                      Item details
                    </button>
                  </div>
                ),
              )}
            </div>
          ) : null}

          {body.filter(Boolean).length ? (
            <div className="reply-text">
              {body.map((line, index) =>
                line === "" ? (
                  <span key={index} style={{ height: 6 }} />
                ) : (
                  <p key={index} className={line === LIVE_FALLBACK_NOTE ? "tag" : undefined}>
                    {line}
                  </p>
                ),
              )}
            </div>
          ) : null}

          {turn.kept.length > 0 ? (
            <div className="stack" style={{ gap: 8 }}>
              {turn.kept.map((item) => (
                <div key={item.id} className="item-row">
                  <span className="icon-badge white">
                    <Icon name="pill" size={18} />
                  </span>
                  <div className="grow">
                    <div className="t">{item.name}</div>
                    <div className="d">
                      {item.strength} · {item.route}
                    </div>
                  </div>
                  <button type="button" className="btn watch-outline" onClick={() => onGive(item)}>
                    <Icon name="shield" size={14} /> Confirm before given
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <RejectedItems ids={turn.rejectedItemIds} />
        </article>
      </div>
    </>
  );
}

function ItemDetail({ item, onGive }: { item: InventoryItem; onGive: (item: InventoryItem) => void }) {
  return (
    <div className="kit-card">
      <div className="row">
        <span className="icon-badge sm white">
          <Icon name="pill" size={16} />
        </span>
        <span className="name">{item.name}</span>
      </div>
      <dl className="kit-dl">
        <div>
          <dt>Pack</dt>
          <dd>{item.pack}</dd>
        </div>
        <div>
          <dt>Strength</dt>
          <dd>{item.strength}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{item.route}</dd>
        </div>
        <div>
          <dt>Qty in pack</dt>
          <dd>{item.quantityOnBoard ?? "Not stated"}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{item.location || "Not stated"}</dd>
        </div>
        <div>
          <dt>Side effects</dt>
          <dd>{item.sideEffects || "Not stated"}</dd>
        </div>
        <div>
          <dt>Comments</dt>
          <dd>{item.comments || "Not stated in the checklist"}</dd>
        </div>
      </dl>
      <div className="row wrap">
        <a className="small" href={item.sourceUrl} target="_blank" rel="noreferrer">
          NASA checklist PDF{item.sourcePage ? `, page ${item.sourcePage}` : ""}
        </a>
        <span className="grow" />
        <button type="button" className="btn watch-outline" onClick={() => onGive(item)}>
          <Icon name="shield" size={14} /> Confirm before given
        </button>
      </div>
    </div>
  );
}

function AlertBars({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return <p className="muted">No open alerts.</p>;
  return (
    <ul className="zbars">
      {alerts.map((alert) => {
        const z = alert.zScore;
        const width = Math.min(100, (Math.abs(z ?? 0) / 12) * 100);
        const hard = alert.ruleId === "hard-bound" || z === undefined;
        return (
          <li key={alert.id}>
            <span>
              {KEY_LABELS[alert.key]} <span className="muted">{missionDayLabel(missionDayOf(alert.openedAt))}</span>
            </span>
            <span className={`zbar ${alert.severity}`} aria-hidden="true">
              <span style={{ width: `${hard ? 12 : Math.max(6, width)}%` }} />
            </span>
            <span className={`zscore ${alert.severity}`}>{hard ? "Demo threshold" : `z ${z!.toFixed(2)}`}</span>
          </li>
        );
      })}
    </ul>
  );
}
