import { useCallback, useEffect, useState } from "react";
import type { FunctionInfo } from "./types";
import { fetchFunctions } from "./api";
import { FunctionCard } from "./components/FunctionCard";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; functions: FunctionInfo[]; mock: boolean };

export function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    fetchFunctions()
      .then(({ functions, mock }) => setState({ status: "ready", functions, mock }))
      .catch((err: unknown) =>
        setState({ status: "error", message: err instanceof Error ? err.message : String(err) }),
      );
  }, []);

  useEffect(load, [load]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>API Explorer</h1>
          <p className="subtitle">
            Every card below was generated from <code>reflect.Package.current()</code> — nothing
            in this UI names a function. Add one to <code>baml_src/functions.baml</code>, restart
            the backend, and it appears here.
          </p>
        </div>
        <div className="header-actions">
          {state.status === "ready" && state.mock && (
            <span className="badge badge-mock" title="MOCK_LLM=1 — SummarizeText replays a canned response">
              mock LLM
            </span>
          )}
          <button className="refresh" onClick={load}>
            Refresh
          </button>
        </div>
      </header>

      {state.status === "loading" && <p className="status">Reflecting on the package…</p>}
      {state.status === "error" && (
        <div className="status status-error">
          <p>Could not load functions: {state.message}</p>
          <p className="hint">Is the backend running on port 4460?</p>
        </div>
      )}
      {state.status === "ready" && (
        <div className="grid">
          {state.functions.map((fn) => (
            <FunctionCard key={fn.name} fn={fn} />
          ))}
        </div>
      )}
    </div>
  );
}
