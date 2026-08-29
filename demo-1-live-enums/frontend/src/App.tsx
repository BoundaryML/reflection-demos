import { useEffect, useState } from "react";
import { api } from "./api";
import type { Category, Config, Ticket } from "./types";
import { TicketList } from "./components/TicketList";
import { CategoryPanel } from "./components/CategoryPanel";

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [classifyingIds, setClassifyingIds] = useState<Set<number>>(new Set());

  async function loadAll() {
    setError(null);
    const [cfg, cats, tix] = await Promise.all([api.getConfig(), api.getCategories(), api.getTickets()]);
    setConfig(cfg);
    setCategories(cats);
    setTickets(tix);
  }

  useEffect(() => {
    loadAll()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function withError<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    }
  }

  async function runTriage() {
    setRunningAll(true);
    setError(null);
    try {
      const { tickets: updated, failed } = await api.classifyAll();
      setTickets(updated);
      if (failed.length > 0) {
        setError(
          `Triage failed for ${failed.length} of ${updated.length} tickets — ${failed[0]!.error}`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunningAll(false);
    }
  }

  async function classifyOne(id: number) {
    setClassifyingIds((prev) => new Set(prev).add(id));
    await withError(async () => {
      const { ticket } = await api.classifyTicket(id);
      setTickets((prev) => prev.map((t) => (t.id === id ? ticket : t)));
    });
    setClassifyingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function addTicket(customer: string, subject: string, body: string) {
    await withError(async () => {
      const created = await api.addTicket(customer, subject, body);
      setTickets((prev) => [...prev, created]);
    });
  }

  async function resetDemo() {
    if (!window.confirm("Reset tickets and categories back to the seed data?")) return;
    await withError(async () => {
      const { categories: cats, tickets: tix } = await api.resetDemo();
      setCategories(cats);
      setTickets(tix);
    });
  }

  async function addCategory(name: string, description: string | null) {
    await withError(async () => {
      const created = await api.addCategory(name, description);
      setCategories((prev) => [...prev, created]);
    });
  }

  async function updateCategory(id: number, fields: { name?: string; description?: string | null }) {
    await withError(async () => {
      const updated = await api.updateCategory(id, fields);
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    });
  }

  async function deleteCategory(id: number) {
    await withError(async () => {
      await api.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-title">
          <h1>Live Triage</h1>
          <p className="app-subtitle">Support inbox where the category list is data, not code.</p>
        </div>
        <div className="app-header-actions">
          {config ? (
            <span className={`mode-badge mode-${config.mode}`}>
              {config.mode === "mock" ? "Mock mode" : `Live · ${config.model}`}
            </span>
          ) : null}
          <button type="button" className="btn" onClick={() => void resetDemo()}>
            Reset demo
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void runTriage()} disabled={runningAll}>
            {runningAll ? "Running triage…" : "Run Triage"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="loading-hint">Loading inbox…</p>
      ) : (
        <main className="app-grid">
          <TicketList
            tickets={tickets}
            categories={categories}
            onClassify={classifyOne}
            onAdd={addTicket}
            classifyingIds={classifyingIds}
          />
          <CategoryPanel
            categories={categories}
            onAdd={addCategory}
            onUpdate={updateCategory}
            onDelete={deleteCategory}
          />
        </main>
      )}
    </div>
  );
}
