import { useState } from "react";
import type { Failure, Plugin, Report, SampleDocument } from "../api.js";
import { DiagnosticPanel } from "./DiagnosticPanel.js";

export type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; report: Report }
  | { kind: "failed"; error: Failure };

export function RunPanel({
  plugin,
  documents,
  documentId,
  state,
  mode,
  onDocument,
  onRun,
}: {
  plugin: Plugin;
  documents: SampleDocument[];
  documentId: string;
  state: RunState;
  mode: "mock" | "live";
  onDocument: (id: string) => void;
  onRun: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const document = documents.find((d) => d.id === documentId);

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>
            Run <span className="mono">{plugin.name}</span>
          </h2>
          <p className="sub">
            by {plugin.vendor} · installed {new Date(plugin.installedAt).toLocaleTimeString()}
          </p>
        </div>
        <span className={`badge badge-${mode}`}>{mode === "mock" ? "mock model" : "live model"}</span>
      </header>

      <div className="chips">
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            className={`chip${doc.id === documentId ? " chip-on" : ""}`}
            onClick={() => onDocument(doc.id)}
          >
            {doc.title}
          </button>
        ))}
      </div>

      {document && <p className="document">{document.body.split("\n\n")[0]}</p>}

      <div className="actions">
        <button
          className="primary"
          type="button"
          disabled={state.kind === "running"}
          onClick={onRun}
        >
          {state.kind === "running" ? "Running…" : "Run plugin"}
        </button>
      </div>

      {state.kind === "failed" && (
        <DiagnosticPanel failure={state.error} source={plugin.source} />
      )}

      {state.kind === "done" && (
        <div className="report">
          <div className="report-block">
            <div className="report-label">
              Through the contract
              <span className="tag tag-typed">typed</span>
            </div>
            <p className="report-summary">{state.report.summary}</p>
            <ul className="report-points">
              {state.report.key_points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>

          {Object.keys(state.report.extras).length > 0 && (
            <div className="report-block">
              <div className="report-label">
                This plugin&rsquo;s own fields
                <span className="tag tag-reflected">read reflectively</span>
              </div>
              <dl className="extras">
                {Object.entries(state.report.extras).map(([key, value]) => (
                  <div className="extra" key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <button
            type="button"
            className="disclosure"
            onClick={() => setShowPrompt((open) => !open)}
          >
            {showPrompt ? "Hide" : "Show"} the request this plugin&rsquo;s schema produced
          </button>
          {showPrompt && <pre className="code">{state.report.prompt}</pre>}
        </div>
      )}
    </section>
  );
}
