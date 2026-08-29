import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import type { FormField, ModeInfo } from "./types";
import DesignTab from "./components/DesignTab";
import ExtractTab from "./components/ExtractTab";

type Tab = "design" | "extract";

export default function App() {
  const [tab, setTab] = useState<Tab>("design");
  const [fields, setFields] = useState<FormField[]>([]);
  const [mode, setMode] = useState<ModeInfo | null>(null);
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshFields = useCallback(async () => {
    setLoadingFields(true);
    try {
      const list = await api.listFields();
      setFields(list);
      setLoadError(null);
    } catch (err) {
      // Without this the rejection is swallowed and the Design tab just says
      // "No fields yet", which looks identical to a backend that isn't running.
      setLoadError(
        err instanceof Error ? err.message : "could not reach the backend",
      );
    } finally {
      setLoadingFields(false);
    }
  }, []);

  useEffect(() => {
    refreshFields();
    api.mode().then(setMode).catch(() => setMode(null));
  }, [refreshFields]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Design-a-Form Extraction</h1>
          <p className="subtitle">
            Design a form. Paste anything. Watch it fill itself in.
          </p>
        </div>
        {mode && (
          <span className={`mode-badge ${mode.mock ? "mode-mock" : "mode-live"}`}>
            {mode.mock ? "Mock mode" : "Live LLM"}
          </span>
        )}
      </header>

      <nav className="tabs">
        <button
          className={tab === "design" ? "tab active" : "tab"}
          onClick={() => setTab("design")}
        >
          1. Design
        </button>
        <button
          className={tab === "extract" ? "tab active" : "tab"}
          onClick={() => setTab("extract")}
        >
          2. Extract
        </button>
      </nav>

      <main className="tab-panel">
        {loadError && <p className="error">{loadError}</p>}
        {tab === "design" && (
          <DesignTab
            fields={fields}
            loading={loadingFields}
            onChange={refreshFields}
            onDone={() => setTab("extract")}
          />
        )}
        {tab === "extract" && <ExtractTab fields={fields} />}
      </main>
    </div>
  );
}
