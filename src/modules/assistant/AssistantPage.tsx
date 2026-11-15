import { useEffect, useRef, useState } from "react";
import type { Alert, InventoryItem } from "../../contracts";
import { KEY_LABELS } from "../../contracts";
import { SIM_CREW, missionDayLabel, missionDayOf, store, useLive } from "../../data/db";
import { Disclaimer } from "../../ui/Disclaimer";
import { Formulary } from "./Formulary";
import { GivenDialog } from "./GivenDialog";
import { KitSuggestions } from "./KitSuggestions";
import { LIVE_FALLBACK_NOTE, MODE_LIVE, MODE_OFFLINE, PROVENANCE_LABEL, REJECTED_LINE } from "./copy";
import { getProvider } from "./providers";
import { validateRecommendation } from "./validate";

interface Turn {
  id: string;
  command: string;
  text: string;
  rejectedItemIds: string[];
  kept: InventoryItem[];
  alerts?: Alert[];
}

const QUICK = [
  { id: "suggest", label: "Suggest", run: "suggest" },
  { id: "find", label: "Find item", fill: "find " },
  { id: "item", label: "Item details", fill: "item " },
  { id: "alerts", label: "Explain alerts", run: "alerts" },
  { id: "help", label: "Help", run: "help" },
] as const;

function commandVerb(command: string): string {
  return command.trim().toLowerCase();
}

export function AssistantPage() {
  const inventory = useLive(() => store.listInventory(), []);
  const openCase = useLive(() => store.getOpenCase(SIM_CREW.id), []);
  const alerts = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [lastCommand, setLastCommand] = useState("");
  const [giving, setGiving] = useState<{ item: InventoryItem; caseId?: string } | null>(null);
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
    setDraft("");
    setLoggedName(undefined);
    try {
      const provider = getProvider();
      const current = openCase.data;
      const reply = await provider.ask({
        command,
        inventory: rows,
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
      const validation =
        reply.draft !== undefined ? validateRecommendation(reply.draft, rows, current?.id ?? "no-case", offline) : undefined;
      const kept = (validation?.recommendation?.itemIds ?? [])
        .map((id) => rows.find((item) => item.id === id))
        .filter((item): item is InventoryItem => item !== undefined);
      const verb = commandVerb(command);
      const openAlerts = (alerts.data ?? []).filter((alert) => !alert.ackedAt);
      setHistory((turns) => [
        ...turns,
        {
          id: crypto.randomUUID(),
          command,
          text: reply.text,
          rejectedItemIds: validation?.rejectedItemIds ?? [],
          kept,
          alerts: verb === "alerts" || verb === "explain alerts" ? openAlerts : undefined,
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
      if (alive.current) setPending(false);
    }
  }

  function quick(action: (typeof QUICK)[number]) {
    if ("fill" in action) {
      setDraft(action.fill);
      inputRef.current?.focus();
      return;
    }
    void run(action.run);
  }

  const lastVerb = commandVerb(lastCommand);

  return (
    <section className="assistant">
      <Disclaimer variant="emergency" />
      <div className="assistant-grid">
        <div className="assistant-main">
          <header className="assistant-head">
            <h1>AI assistant</h1>
            <p>Onboard kit only · answers as cards</p>
          </header>

          <div className="command-row">
            <form
              className="command-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(draft);
              }}
            >
              <input
                ref={inputRef}
                value={draft}
                placeholder="Ask about the onboard kit or your alerts"
                aria-label="Assistant command"
                onChange={(event) => setDraft(event.target.value)}
                disabled={pending || inventory.data === undefined}
              />
              <button type="submit" className="send-btn" aria-label="Send command" disabled={pending || !draft.trim()}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M4 12h12.2l-4.6-4.6L13 6l7 6-7 6-1.4-1.4 4.6-4.6H4z" />
                </svg>
              </button>
            </form>
            <p className={live ? "mode-chip live" : "mode-chip"}>{live ? MODE_LIVE : MODE_OFFLINE}</p>
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
                <button key={action.id} type="button" className={on ? "quick-chip on" : "quick-chip"} onClick={() => quick(action)}>
                  {action.label}
                </button>
              );
            })}
          </div>

          {loggedName ? (
            <p className="logged-note" role="status">
              Logged {loggedName}. The text saved is only what you typed.
            </p>
          ) : null}

          <ol className="history">
            {history.map((turn) => (
              <li key={turn.id}>
                <p className="command-pill">{turn.command}</p>
                <article className="reply-card">
                  {turn.alerts ? <AlertBars alerts={turn.alerts} /> : null}
                  {turn.alerts ? (
                    <details className="why-details">
                      <summary>Why?</summary>
                      <ReplyBody text={turn.text} />
                    </details>
                  ) : (
                    <ReplyBody text={turn.text} />
                  )}
                  {turn.kept.length > 0 ? (
                    <ul className="kept-list">
                      {turn.kept.map((item) => (
                        <li key={item.id}>
                          <span>
                            {item.name} · {item.strength} · {item.route}
                          </span>
                          <button
                            type="button"
                            className="give-btn"
                            onClick={() => setGiving({ item, caseId: openCase.data?.id })}
                          >
                            Mark as given
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {turn.rejectedItemIds.length > 0 ? (
                    <p className="rejected-line">
                      {REJECTED_LINE}
                      <span className="rejected-ids">{turn.rejectedItemIds.join(", ")}</span>
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>

          {openCase.data ? (
            <KitSuggestions
              caseId={openCase.data.id}
              onGive={(item) => setGiving({ item, caseId: openCase.data?.id })}
            />
          ) : null}
        </div>

        <Formulary
          items={inventory.data}
          onConfirm={(item) => setGiving({ item, caseId: openCase.data?.id })}
        />
      </div>
      <p className="assistant-foot muted">{PROVENANCE_LABEL}</p>

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
    </section>
  );
}

function ReplyBody({ text }: { text: string }) {
  return (
    <div className="reply-text">
      {text.split("\n").map((line, index) =>
        line === "" ? (
          <div key={index} className="reply-gap" />
        ) : (
          <p key={index} className={line === LIVE_FALLBACK_NOTE ? "fallback-note" : undefined}>
            {line}
          </p>
        ),
      )}
    </div>
  );
}

function AlertBars({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="alert-bars">
      <h2>
        {alerts.length} open alert{alerts.length === 1 ? "" : "s"}
      </h2>
      {alerts.length === 0 ? <p>No open alerts.</p> : null}
      <ul>
        {alerts.map((alert) => {
          const width = Math.min(100, (Math.abs(alert.zScore ?? 0) / 8) * 100);
          return (
            <li key={alert.id}>
              <span>
                {KEY_LABELS[alert.key]} · {missionDayLabel(missionDayOf(alert.openedAt))}
              </span>
              <span className={`zbar ${alert.severity}`} aria-hidden="true">
                <span style={{ width: `${width}%` }} />
              </span>
              <span className="zscore">{alert.zScore !== undefined ? `z ${alert.zScore.toFixed(2)}` : alert.severity}</span>
            </li>
          );
        })}
      </ul>
      {alerts.some((alert) => alert.zScore !== undefined) ? (
        <p className="muted small">Bar = distance from your own baseline</p>
      ) : null}
    </div>
  );
}
