import { useCallback, useEffect, useRef, useState } from 'react';

import * as api from './api';
import { Editor } from './components/Editor';
import { Note } from './components/Note';
import { Output } from './components/Output';
import type { Cell, NotebookInfo, SeedCell } from './types';

const STORAGE_KEY = 'baml-notebook-id';

let cellSeq = 0;
const nextCellId = (): string => `cell-${(cellSeq += 1)}`;

type Boot = { notebook: NotebookInfo; seed: SeedCell[]; live: number };

/**
 * One session per tab, exactly once — shared across React's double-invoked
 * StrictMode effects so a single tab never mints two sessions.
 *
 * `sessionStorage` is per-tab, so a duplicated or newly opened tab gets its own
 * notebook while a plain reload reattaches to the session it left behind.
 */
let bootOnce: Promise<Boot> | null = null;

function boot(): Promise<Boot> {
  bootOnce ??= (async () => {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing !== null) {
      const reattached = await api.reattachNotebook(existing).catch(() => null);
      if (reattached) {
        return reattached;
      }
    }
    const opened = await api.openNotebook();
    sessionStorage.setItem(STORAGE_KEY, opened.notebook.id);
    return opened;
  })();
  return bootOnce;
}

export function App() {
  const [notebook, setNotebook] = useState<NotebookInfo | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [live, setLive] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);
  const runCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { notebook: info, seed, live: liveCount } = await boot();
        if (cancelled) {
          return;
        }
        setNotebook(info);
        setLive(liveCount);
        setCells(
          seed.map((cell) => ({
            id: nextCellId(),
            kind: cell.kind,
            source: cell.source,
            state: 'idle',
            runIndex: null,
            result: null,
          })),
        );
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Release the session when the tab goes away.
  useEffect(() => {
    if (!notebook) {
      return;
    }
    const release = (): void => api.releaseNotebook(notebook.id);
    window.addEventListener('pagehide', release);
    return () => {
      window.removeEventListener('pagehide', release);
    };
  }, [notebook]);

  // A quiet heartbeat so the "notebooks open" counter reflects other tabs.
  useEffect(() => {
    if (!notebook) {
      return;
    }
    const timer = window.setInterval(() => {
      void api.liveNotebooks().then(setLive).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [notebook]);

  const patch = useCallback((id: string, changes: Partial<Cell>): void => {
    setCells((current) =>
      current.map((cell) => (cell.id === id ? { ...cell, ...changes } : cell)),
    );
  }, []);

  const run = useCallback(
    async (id: string): Promise<void> => {
      if (!notebook) {
        return;
      }
      const cell = cells.find((candidate) => candidate.id === id);
      if (!cell || cell.kind !== 'baml' || cell.source.trim().length === 0) {
        return;
      }

      runCounter.current += 1;
      patch(id, { state: 'running', runIndex: runCounter.current, result: null });
      try {
        const result = await api.runCell(notebook.id, cell.source);
        setLive(result.live);
        patch(id, { state: 'idle', result });
      } catch (error) {
        patch(id, {
          state: 'idle',
          result: {
            outcome: {
              status: 'runtime-error',
              message: error instanceof Error ? error.message : String(error),
              trace: [],
            },
            elapsedMs: 0,
            live,
          },
        });
      }
    },
    [cells, live, notebook, patch],
  );

  const runAndAdvance = useCallback(
    (id: string): void => {
      void run(id);
      const index = cells.findIndex((cell) => cell.id === id);
      const next = cells.slice(index + 1).find((cell) => cell.kind === 'baml');
      if (next) {
        document
          .querySelector<HTMLTextAreaElement>(`[data-cell="${next.id}"] .editor-input`)
          ?.focus();
      }
    },
    [cells, run],
  );

  const addCell = useCallback((afterId: string | null): void => {
    setCells((current) => {
      const cell: Cell = {
        id: nextCellId(),
        kind: 'baml',
        source: '',
        state: 'idle',
        runIndex: null,
        result: null,
      };
      if (afterId === null) {
        return [...current, cell];
      }
      const index = current.findIndex((candidate) => candidate.id === afterId);
      const copy = [...current];
      copy.splice(index + 1, 0, cell);
      return copy;
    });
  }, []);

  const removeCell = useCallback((id: string): void => {
    setCells((current) => current.filter((cell) => cell.id !== id));
  }, []);

  const restart = useCallback(async (): Promise<void> => {
    if (!notebook) {
      return;
    }
    const { notebook: info, live: liveCount } = await api.restartNotebook(notebook.id);
    runCounter.current = 0;
    setNotebook(info);
    setLive(liveCount);
    setCells((current) =>
      current.map((cell) => ({ ...cell, state: 'idle', runIndex: null, result: null })),
    );
  }, [notebook]);

  if (bootError !== null) {
    return (
      <div className="boot-error">
        <h1>The notebook could not start</h1>
        <pre>{bootError}</pre>
      </div>
    );
  }

  if (!notebook) {
    return <div className="booting">opening a session…</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <span className="logo">◼</span>
          <div>
            <h1>BAML Notebook</h1>
            <p>support-inbox package, mounted live as <code>app</code></p>
          </div>
        </div>

        <div className="header-status">
          <div className="session-chip" style={{ borderColor: tint(notebook.id) }}>
            <span className="session-dot" style={{ background: tint(notebook.id) }} />
            <span className="session-label">session</span>
            <code>{notebook.id.slice(0, 8)}</code>
          </div>
          <div className="live-count">
            {live} notebook{live === 1 ? '' : 's'} open
          </div>
          <button
            className="button"
            onClick={() => window.open(window.location.href, '_blank', 'noopener')}
          >
            Open a second notebook
          </button>
          <button className="button button-quiet" onClick={() => void restart()}>
            Restart session
          </button>
        </div>
      </header>

      <main className="notebook">
        {cells.map((cell) => (
          <section className={`cell cell-${cell.kind}`} key={cell.id} data-cell={cell.id}>
            {cell.kind === 'note' ? (
              <Note source={cell.source} />
            ) : (
              <>
                <div className="cell-body">
                  <div className="gutter">
                    <button
                      className="run"
                      title="Run (⌘/Ctrl + Enter)"
                      disabled={cell.state === 'running'}
                      onClick={() => void run(cell.id)}
                    >
                      {cell.state === 'running' ? <span className="spinner" /> : '▶'}
                    </button>
                    <span className="run-index">
                      {cell.state === 'running' ? '[*]' : cell.runIndex ? `[${cell.runIndex}]` : '[ ]'}
                    </span>
                  </div>
                  <Editor
                    value={cell.source}
                    disabled={cell.state === 'running'}
                    onChange={(source) => patch(cell.id, { source })}
                    onRun={() => void run(cell.id)}
                    onRunAndAdvance={() => runAndAdvance(cell.id)}
                  />
                  <div className="cell-tools">
                    <button className="tool" title="Add a cell below" onClick={() => addCell(cell.id)}>
                      +
                    </button>
                    <button className="tool" title="Delete this cell" onClick={() => removeCell(cell.id)}>
                      ×
                    </button>
                  </div>
                </div>
                {cell.result ? <Output result={cell.result} /> : null}
              </>
            )}
          </section>
        ))}

        <button className="add-cell" onClick={() => addCell(null)}>
          + new cell
        </button>
      </main>
    </div>
  );
}

/** A stable colour per session id, so two tabs are told apart at a glance. */
function tint(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return `hsl(${hash} 70% 62%)`;
}
