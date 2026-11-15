import { useEffect, useState } from "react";

const listeners = new Set<() => void>();

/** Called by every store write. Re-runs all live queries. */
export function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export interface LiveResult<T> {
  data: T | undefined;
  loading: boolean;
  error?: Error;
}

/** Runs `query` on mount, when `deps` change, and after every store write. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ data: undefined, loading: true });

  useEffect(() => {
    let alive = true;
    let run = 0;
    const load = () => {
      const mine = ++run;
      query().then(
        (data) => {
          if (alive && mine === run) setState({ data, loading: false });
        },
        (err: unknown) => {
          if (alive && mine === run)
            setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err : new Error(String(err)) }));
        },
      );
    };
    load();
    const off = subscribeStore(load);
    return () => {
      alive = false;
      off();
    };
    // Callers pass deps explicitly, like useEffect.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
