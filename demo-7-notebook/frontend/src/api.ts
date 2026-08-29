import type { NotebookInfo, RunResult, SeedCell } from './types';

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((detail as { error?: string }).error ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function openNotebook(): Promise<{
  notebook: NotebookInfo;
  seed: SeedCell[];
  live: number;
}> {
  return json(await fetch('/api/notebooks', { method: 'POST' }));
}

/** Reattaches to a session that outlived a page reload; null if it is gone. */
export async function reattachNotebook(
  id: string,
): Promise<{ notebook: NotebookInfo; seed: SeedCell[]; live: number } | null> {
  const response = await fetch(`/api/notebooks/${id}`);
  if (response.status === 404) {
    return null;
  }
  return json(response);
}

export async function runCell(id: string, source: string): Promise<RunResult> {
  return json(
    await fetch(`/api/notebooks/${id}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source }),
    }),
  );
}

export async function restartNotebook(
  id: string,
): Promise<{ notebook: NotebookInfo; live: number }> {
  return json(await fetch(`/api/notebooks/${id}/restart`, { method: 'POST' }));
}

export async function liveNotebooks(): Promise<number> {
  const body = await json<{ live: number }>(await fetch('/api/notebooks'));
  return body.live;
}

/** Best-effort release on tab close; sendBeacon survives unload, fetch may not. */
export function releaseNotebook(id: string): void {
  const url = `/api/notebooks/${id}/close`;
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([''], { type: 'text/plain' }));
    return;
  }
  void fetch(url, { method: 'POST', keepalive: true });
}
