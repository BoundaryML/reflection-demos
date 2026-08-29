import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const BAML_SRC = join(here, '..', '..', 'baml_src');

type Bridge = typeof import('@boundaryml/baml-bridge');
type Runtime = ReturnType<Bridge['getRuntime']>;

let bridge: Bridge | null = null;
let runtime: Runtime | null = null;
let loadError: string | null = null;
let version: string | null = null;

/**
 * Boot the BAML runtime straight from `baml_src` — no code generation step, so
 * the demo runs from a fresh clone. The bridge compiles the sources once here;
 * `reflect.Package.compile` inside them is what runs per request.
 */
export async function boot(): Promise<void> {
  try {
    bridge = await import('@boundaryml/baml-bridge');
    const files: Record<string, string> = {};
    for (const name of readdirSync(BAML_SRC)) {
      if (name.endsWith('.baml')) files[name] = readFileSync(join(BAML_SRC, name), 'utf8');
    }
    runtime = bridge.BamlRuntime.initializeRuntime(BAML_SRC, files);
    version = bridge.getVersion?.() ?? null;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    runtime = null;
  }
}

export function runtimeStatus(): { ok: boolean; error: string | null; version: string | null } {
  return { ok: runtime !== null, error: loadError, version };
}

export class BamlUnavailable extends Error {}

async function call<T>(fn: string, kwargs: Record<string, unknown>): Promise<T> {
  if (!bridge || !runtime) throw new BamlUnavailable(loadError ?? 'the BAML runtime is not loaded');
  const result = await bridge.callFunction(runtime, fn, kwargs);
  return result.result() as T;
}

/**
 * One compile at a time, newest source wins.
 *
 * `reflect.Package.compile` is a full compiler run; letting a burst of
 * keystrokes queue up behind each other only ever delivers stale answers. Any
 * request that is superseded before it starts resolves to the newer one's
 * result instead.
 */
class LatestOnly<T> {
  private running = false;
  private pending: { key: string; run: () => Promise<T>; waiters: Array<[(v: T) => void, (e: unknown) => void]> } | null = null;

  submit(key: string, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.pending && this.pending.key === key) {
        this.pending.waiters.push([resolve, reject]);
      } else {
        const superseded = this.pending;
        this.pending = { key, run, waiters: [[resolve, reject]] };
        // Anyone waiting on a source we are about to skip gets the newer answer.
        if (superseded) this.pending.waiters.push(...superseded.waiters);
      }
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending) {
        const job = this.pending;
        this.pending = null;
        try {
          const value = await job.run();
          for (const [resolve] of job.waiters) resolve(value);
        } catch (err) {
          for (const [, reject] of job.waiters) reject(err);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

const compileQueue = new LatestOnly<unknown>();

/** Identical text compiles to an identical package; remember the last few. */
const recent = new Map<string, unknown>();
const RECENT_LIMIT = 16;

function remember(source: string, value: unknown): void {
  recent.set(source, value);
  if (recent.size > RECENT_LIMIT) recent.delete(recent.keys().next().value as string);
}

/** The editor's own loop. Always really compiles, so the reported time is real. */
export async function compileSchema<T>(source: string): Promise<T> {
  // Remembering happens inside the job, not around `submit`: a superseded
  // request resolves with the *newer* source's package, and filing that under
  // the older source would hand `describeSchema` the wrong class list.
  const value = await compileQueue.submit(source, async () => {
    const compiled = await call<unknown>('CompileSchema', { source });
    remember(source, compiled);
    return compiled;
  });
  return value as T;
}

/** What the extract handler needs to know about a schema it did not just compile. */
export async function describeSchema<T>(source: string): Promise<T> {
  const hit = recent.get(source);
  return (hit !== undefined ? (hit as T) : await compileSchema<T>(source));
}

export function runExtraction<T>(args: {
  source: string;
  record: string;
  document: string;
  reply: string | null;
}): Promise<T> {
  return call<T>('RunExtraction', args);
}

export function draftSchema<T>(args: { description: string; reply: string | null }): Promise<T> {
  return call<T>('DraftSchema', args);
}
