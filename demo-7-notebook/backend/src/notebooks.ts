/**
 * Notebook lifecycle.
 *
 * One browser tab ⇒ one notebook id ⇒ one `reflect.Session`. The session
 * handle is held here and nowhere else, so the rules are simple:
 *
 *   created   on the tab's first request
 *   kept      in this map, keyed by notebook id
 *   serialised one eval at a time (a Session refuses concurrent evals)
 *   dropped   RELEASE_MS after the tab says goodbye, or after IDLE_MS of silence
 *
 * Dropping the handle is the whole of "closing" a notebook: the session's
 * committed image, its declarations and its mounted package become garbage as
 * soon as nothing references them.
 *
 * The goodbye is deferred by RELEASE_MS for one reason: `pagehide` fires on a
 * reload as well as on a close, and the reloaded page cannot reattach to a
 * session the beacon has already deleted. The short hold makes a reload
 * deterministic — the returning tab reclaims its own session — while a tab
 * that really went away is still collected seconds later.
 */
import { randomUUID } from 'node:crypto';

import {
  type CellOutcome,
  type NotebookSession,
  openNotebook,
  runCell,
} from './baml.js';

const IDLE_MS = 30 * 60 * 1000;
const SWEEP_MS = 60 * 1000;
const RELEASE_MS = 15 * 1000;
const MAX_NOTEBOOKS = 200;

interface Notebook {
  id: string;
  session: NotebookSession;
  openedAt: number;
  lastSeen: number;
  cellsRun: number;
  /** Serialises evals so a fast double-click can't trip SessionBusy. */
  queue: Promise<unknown>;
  /** Pending deletion after a `pagehide`; cleared if the tab comes back. */
  release: NodeJS.Timeout | null;
}

const notebooks = new Map<string, Notebook>();

export interface NotebookInfo {
  id: string;
  openedAt: number;
  cellsRun: number;
}

function info(notebook: Notebook): NotebookInfo {
  return {
    id: notebook.id,
    openedAt: notebook.openedAt,
    cellsRun: notebook.cellsRun,
  };
}

/** Marks a notebook as in use, cancelling a goodbye the tab has changed its mind about. */
function touch(notebook: Notebook): void {
  notebook.lastSeen = Date.now();
  if (notebook.release !== null) {
    clearTimeout(notebook.release);
    notebook.release = null;
  }
}

export async function createNotebook(): Promise<NotebookInfo> {
  if (notebooks.size >= MAX_NOTEBOOKS) {
    dropOldest();
  }
  const now = Date.now();
  const notebook: Notebook = {
    id: randomUUID(),
    session: await openNotebook(),
    openedAt: now,
    lastSeen: now,
    cellsRun: 0,
    queue: Promise.resolve(),
    release: null,
  };
  notebooks.set(notebook.id, notebook);
  return info(notebook);
}

export function getNotebook(id: string): NotebookInfo | null {
  const notebook = notebooks.get(id);
  if (!notebook) {
    return null;
  }
  touch(notebook);
  return info(notebook);
}

/** Runs one cell, queued behind whatever this notebook is already doing. */
export async function runNotebookCell(
  id: string,
  source: string,
): Promise<{ outcome: CellOutcome; elapsedMs: number } | null> {
  const notebook = notebooks.get(id);
  if (!notebook) {
    return null;
  }
  touch(notebook);

  const run = notebook.queue.then(async () => {
    const startedAt = Date.now();
    const outcome = await runCell(notebook.session, source);
    notebook.lastSeen = Date.now();
    notebook.cellsRun += 1;
    return { outcome, elapsedMs: Date.now() - startedAt };
  });

  // Keep the chain alive even when this run rejects.
  notebook.queue = run.catch(() => undefined);
  return run;
}

/** Throws the session away and mints a fresh one under the same id. */
export async function restartNotebook(id: string): Promise<NotebookInfo | null> {
  const notebook = notebooks.get(id);
  if (!notebook) {
    return null;
  }
  await notebook.queue.catch(() => undefined);
  touch(notebook);
  notebook.session = await openNotebook();
  notebook.openedAt = Date.now();
  notebook.lastSeen = notebook.openedAt;
  notebook.cellsRun = 0;
  return info(notebook);
}

/**
 * The tab said goodbye. The session stops counting as open immediately, and
 * is dropped for real RELEASE_MS later — long enough that a reload reattaches
 * to it, short enough that a closed tab frees its image while you watch.
 */
export function closeNotebook(id: string): boolean {
  const notebook = notebooks.get(id);
  if (!notebook) {
    return false;
  }
  if (notebook.release !== null) {
    clearTimeout(notebook.release);
  }
  notebook.release = setTimeout(() => notebooks.delete(id), RELEASE_MS);
  notebook.release.unref();
  return true;
}

/** Notebooks with a tab still attached — the number the header reports. */
export function liveCount(): number {
  let live = 0;
  for (const notebook of notebooks.values()) {
    if (notebook.release === null) {
      live += 1;
    }
  }
  return live;
}

function dropOldest(): void {
  let oldest: Notebook | null = null;
  for (const notebook of notebooks.values()) {
    if (oldest === null || notebook.lastSeen < oldest.lastSeen) {
      oldest = notebook;
    }
  }
  if (oldest) {
    notebooks.delete(oldest.id);
  }
}

export function startSweeper(): NodeJS.Timeout {
  const timer = setInterval(() => {
    const cutoff = Date.now() - IDLE_MS;
    for (const [id, notebook] of notebooks) {
      if (notebook.lastSeen < cutoff) {
        notebooks.delete(id);
      }
    }
  }, SWEEP_MS);
  timer.unref();
  return timer;
}
