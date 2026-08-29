import { useCallback, useEffect, useState } from "react";
import { api, type Bootstrap, type Example, type Failure, type Plugin, type Report } from "./api.js";
import { ContractCard } from "./components/ContractCard.js";
import { RegistryRail } from "./components/RegistryRail.js";
import { SubmitPanel, type Draft } from "./components/SubmitPanel.js";
import { DiagnosticPanel } from "./components/DiagnosticPanel.js";
import { RunPanel, type RunState } from "./components/RunPanel.js";

type Verdict =
  | { kind: "none" }
  | { kind: "accepted"; plugin: Plugin }
  | { kind: "rejected"; error: Failure; draft: Draft };

/** What happened when a rejected plugin was loaded unchecked and used anyway. */
type Bypass =
  | { kind: "none" }
  | { kind: "blocked"; error: Failure; draft: Draft }
  | { kind: "escaped"; report: Report };

const EMPTY_DRAFT: Draft = {
  exampleId: null,
  vendor: "unlisted vendor",
  source: "class MyPlugin {\n  summary string\n  key_points string[]\n}",
  bindings: { summary: "summary", key_points: "key_points" },
};

export function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "none" });
  const [bypass, setBypass] = useState<Bypass>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState("incident");
  const [runState, setRunState] = useState<RunState>({ kind: "idle" });

  const refresh = useCallback(async () => {
    const data = await api.bootstrap();
    setBoot(data);
    setPlugins(data.plugins);
    setSelected((current) => current ?? data.plugins[0]?.name ?? null);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const data = await refresh();
      if (!cancelled && data.host.status === "starting") setTimeout(tick, 700);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (boot && draft === EMPTY_DRAFT && boot.examples.length > 0) {
      const first = boot.examples[0]!;
      setDraft({
        exampleId: first.id,
        vendor: first.vendor,
        source: first.source,
        bindings: { ...first.bindings },
      });
    }
  }, [boot, draft]);

  const pick = (example: Example) => {
    setDraft({
      exampleId: example.id,
      vendor: example.vendor,
      source: example.source,
      bindings: { ...example.bindings },
    });
    setVerdict({ kind: "none" });
    setBypass({ kind: "none" });
  };

  const install = async () => {
    setBusy(true);
    setVerdict({ kind: "none" });
    setBypass({ kind: "none" });
    const result = await api.install(draft.source, draft.bindings, draft.vendor);
    setBusy(false);
    if (result.ok) {
      setVerdict({ kind: "accepted", plugin: result.plugin });
      setSelected(result.plugin.name);
      setRunState({ kind: "idle" });
      await refresh();
    } else {
      setVerdict({ kind: "rejected", error: result.error, draft });
    }
  };

  const force = async (rejected: Draft) => {
    setBusy(true);
    const result = await api.force(rejected.source, rejected.bindings, documentId);
    setBusy(false);
    setBypass(
      result.ok
        ? { kind: "escaped", report: result.report }
        : { kind: "blocked", error: result.error, draft: rejected },
    );
  };

  const run = async () => {
    if (!selected) return;
    setRunState({ kind: "running" });
    const result = await api.run(selected, documentId);
    setRunState(
      result.ok ? { kind: "done", report: result.report } : { kind: "failed", error: result.error },
    );
  };

  const remove = async (name: string) => {
    const result = await api.uninstall(name);
    setPlugins(result.plugins);
    if (selected === name) {
      setSelected(null);
      setRunState({ kind: "idle" });
    }
  };

  if (!boot) {
    return (
      <div className="app">
        <div className="booting">Connecting to Digest…</div>
      </div>
    );
  }

  const current = plugins.find((p) => p.name === selected) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">◈</span>
          <span className="wordmark">Digest</span>
          <span className="section">Plugin Registry</span>
        </div>
        <div className="topbar-right">
          <span className={`badge badge-${boot.mode}`}>
            {boot.mode === "mock" ? "mock model" : `live · ${boot.model}`}
          </span>
          <span className={`status status-${boot.host.status}`}>
            {boot.host.status === "ready"
              ? "host ready"
              : boot.host.status === "starting"
                ? "host starting…"
                : "host down"}
          </span>
        </div>
      </header>

      {boot.host.status !== "ready" && (
        <div className={`banner banner-${boot.host.status}`}>
          {boot.host.status === "starting"
            ? "The plugin host is compiling. This takes a couple of seconds on first boot."
            : (boot.host.error ?? "The plugin host is unavailable.")}
        </div>
      )}

      <main className="layout">
        <aside className="rail">
          <ContractCard fields={boot.contract} />
          <RegistryRail
            plugins={plugins}
            selected={selected}
            onSelect={(name) => {
              setSelected(name);
              setRunState({ kind: "idle" });
              setVerdict({ kind: "none" });
              setBypass({ kind: "none" });
            }}
            onRemove={remove}
          />
        </aside>

        <div className="stage">
          <SubmitPanel
            contract={boot.contract}
            examples={boot.examples}
            draft={draft}
            busy={busy}
            onDraft={setDraft}
            onPick={pick}
            onInstall={install}
          />

          {verdict.kind === "accepted" && (
            <section className="card verdict verdict-ok">
              <header className="card-head">
                <div>
                  <h2>
                    <span className="mono">{verdict.plugin.name}</span> passed the gate
                  </h2>
                  <p className="sub">
                    It is now callable from Digest, exactly like a plugin we shipped ourselves.
                  </p>
                </div>
              </header>
              <div className="report-label">Registered manifest</div>
              <pre className="code">{verdict.plugin.manifest}</pre>
              <p className="verdict-note">
                The <code>implements</code> block is the registry&rsquo;s proof: it records which
                of this plugin&rsquo;s fields answer each contract field.
              </p>
            </section>
          )}

          {verdict.kind === "rejected" && (
            <section className="card verdict verdict-bad">
              <header className="card-head">
                <div>
                  <h2>Rejected at install</h2>
                  <p className="sub">Nothing was registered, and no model was called.</p>
                </div>
              </header>
              <DiagnosticPanel failure={verdict.error} source={verdict.draft.source} />
              {bypass.kind === "none" && verdict.error.diagnostics[0]?.code === "E0001" && (
                <div className="actions">
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => force(verdict.draft)}
                  >
                    {busy ? "Trying…" : "Load it unchecked and run it anyway →"}
                  </button>
                  <span className="actions-note">
                    What an unchecked plugin loader would do with this submission.
                  </span>
                </div>
              )}
            </section>
          )}

          {bypass.kind === "blocked" && (
            <section className="card verdict verdict-bad">
              <header className="card-head">
                <div>
                  <h2>Blocked at the call site</h2>
                  <p className="sub">
                    The type was loaded without a contract check, and Digest still refused to
                    call it — before rendering a prompt, before spending a token.
                  </p>
                </div>
              </header>
              <DiagnosticPanel
                failure={bypass.error}
                source={bypass.draft.source}
                tone="block"
              />
            </section>
          )}

          {bypass.kind === "escaped" && (
            <section className="card verdict verdict-bad">
              <header className="card-head">
                <div>
                  <h2>It ran</h2>
                  <p className="sub">That should not happen — the bound let an unchecked plugin through.</p>
                </div>
              </header>
              <pre className="code">{JSON.stringify(bypass.report, null, 2)}</pre>
            </section>
          )}

          {current && verdict.kind !== "rejected" && (
            <RunPanel
              plugin={current}
              documents={boot.documents}
              documentId={documentId}
              state={runState}
              mode={boot.mode}
              onDocument={(id) => {
                setDocumentId(id);
                setRunState({ kind: "idle" });
              }}
              onRun={run}
            />
          )}
        </div>
      </main>
    </div>
  );
}
