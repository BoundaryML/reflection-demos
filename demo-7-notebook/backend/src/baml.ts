/**
 * The BAML runtime boundary.
 *
 * `baml_src/` is compiled in-process at boot with the bridge's source-loading
 * entry point — no generated SDK, no build step, and no embedded-bytecode
 * version gate to trip over. Everything below this file is plain Express;
 * everything above it is BAML. There are exactly two entry points: open a
 * notebook, run a cell.
 *
 * The bridge is loaded lazily and every failure is captured rather than
 * thrown at import time, so a broken native addon yields a server that
 * explains itself instead of a process that will not start.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** An opaque handle to a live `reflect.Session` on the BAML heap. */
export type NotebookSession = unknown;

/** One diagnostic exactly as the BAML compiler reported it. */
export interface Diagnostic {
  code: string;
  message: string;
  file: string | null;
}

export type CellOutcome =
  | { status: 'ok'; value: unknown }
  | { status: 'compile-error'; message: string; diagnostics: Diagnostic[] }
  | { status: 'runtime-error'; message: string; trace: string[] }
  | { status: 'busy'; message: string };

export type BamlStatus =
  | { ok: true; version: string; files: string[] }
  | { ok: false; error: string };

interface Bridge {
  BamlRuntime: {
    initializeRuntime(rootPath: string, files: Record<string, string>): unknown;
  };
  callFunction(
    runtime: unknown,
    name: string,
    kwargs: Record<string, unknown>,
  ): Promise<{ result(): unknown }>;
  getVersion(): string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
export const BAML_SRC_DIR = join(HERE, '..', '..', 'baml_src');

let bridge: Bridge | null = null;
let runtime: unknown = null;
let status: BamlStatus = { ok: false, error: 'not initialised' };

function readBamlSrc(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(BAML_SRC_DIR).sort()) {
    if (name.endsWith('.baml')) {
      files[name] = readFileSync(join(BAML_SRC_DIR, name), 'utf8');
    }
  }
  if (Object.keys(files).length === 0) {
    throw new Error(`no .baml files found in ${BAML_SRC_DIR}`);
  }
  return files;
}

/** Compiles `baml_src/` once. Never throws; inspect the returned status. */
export async function initBaml(): Promise<BamlStatus> {
  try {
    bridge = (await import('@boundaryml/baml-bridge')) as unknown as Bridge;
  } catch (error) {
    status = {
      ok: false,
      error:
        `the @boundaryml/baml-bridge native addon failed to load: ${describe(error)}\n` +
        'Rebuild it with `pnpm build:debug` in ' +
        'baml_language/sdks/typescript/bridge_typescript, or install the ' +
        'published build (see README).',
    };
    return status;
  }

  try {
    const files = readBamlSrc();
    runtime = bridge.BamlRuntime.initializeRuntime(BAML_SRC_DIR, files);
    status = { ok: true, version: bridge.getVersion(), files: Object.keys(files) };
  } catch (error) {
    status = {
      ok: false,
      error:
        `baml_src/ failed to compile: ${describe(error)}\n` +
        'The embedding API reports compile failures without diagnostics; run ' +
        '`baml-dev check` in baml_src/ to see them.',
    };
  }
  return status;
}

export function bamlStatus(): BamlStatus {
  return status;
}

function ready(): { bridge: Bridge; runtime: unknown } {
  if (bridge === null || runtime === null || !status.ok) {
    throw new Error(status.ok ? 'BAML is not initialised' : status.error);
  }
  return { bridge, runtime };
}

/**
 * `OpenNotebook()` — mints a `reflect.Session` with the app package mounted.
 * The returned handle keeps the session and its whole committed image alive on
 * the BAML heap; dropping every reference to it is what frees them.
 */
export async function openNotebook(): Promise<NotebookSession> {
  const { bridge: b, runtime: rt } = ready();
  const result = await b.callFunction(rt, 'OpenNotebook', {});
  return result.result();
}

/** `RunCell(notebook, source)` — one submission against one session. */
export async function runCell(
  notebook: NotebookSession,
  source: string,
): Promise<CellOutcome> {
  const { bridge: b, runtime: rt } = ready();
  try {
    const result = await b.callFunction(rt, 'RunCell', { notebook, source });
    return { status: 'ok', value: result.result() };
  } catch (error) {
    return classify(error);
  }
}

// The three things `Session.eval` throws. `reflect` is a root package as of
// canary #4543, so this is both how `notebook.baml` spells them and — verified
// against the addon built from a50430fba — the FQN the bridge puts on
// `className`.
const COMPILATION_ERROR = 'reflect.errors.CompilationError';
const EVALUATION_ERROR = 'reflect.errors.EvaluationError';
const SESSION_BUSY = 'reflect.errors.SessionBusy';

/**
 * The class name to match on, normalised across the root-package rename.
 *
 * Before #4543 the same classes came over the wire as `baml.reflect.errors.…`.
 * These demos run against a locally built canary addon that can lag the CLI,
 * and a mismatch here fails silently — the compile-error panel and its
 * diagnostics would just stop appearing — so accept either spelling rather
 * than betting on one.
 */
function reflectClass(className: string): string {
  return className.startsWith('baml.reflect.') ? className.slice('baml.'.length) : className;
}

/** The error shape the bridge throws: see `bridge_typescript`'s `BamlError`. */
interface BridgeError {
  className?: string;
  message?: string;
  bamlTrace?: string[];
  value?: unknown;
}

/**
 * Sorts a thrown BAML error into the three things a notebook cares about.
 *
 * `Session.eval` flattens an application `throw` into a bare EvaluationError,
 * but panics (index out of range and friends) arrive intact with a BAML
 * traceback — so those keep their detail.
 */
function classify(error: unknown): CellOutcome {
  const err = error as BridgeError;
  const className = reflectClass(err.className ?? '');
  const trace = readerFrames(err);

  if (className === COMPILATION_ERROR) {
    const message = plainMessage(err, 'the cell does not compile');
    const raw = (thrownValue(err)?.diagnostics ?? []) as {
      code?: string;
      message?: string;
      span?: { file?: string };
    }[];
    const diagnostics = raw.map((diagnostic) => ({
      code: diagnostic.code ?? 'error',
      message: demangle(diagnostic.message ?? ''),
      file: diagnostic.span?.file ?? null,
    }));
    return {
      status: 'compile-error',
      message,
      diagnostics:
        diagnostics.length > 0 ? diagnostics : [{ code: 'error', message, file: null }],
    };
  }

  if (className === SESSION_BUSY) {
    return { status: 'busy', message: plainMessage(err, 'another eval holds this session') };
  }

  if (className === EVALUATION_ERROR) {
    // The stdlib's `eval` catches every application throw and rethrows a bare
    // `EvaluationError { message: "session evaluation failed" }`, so the value
    // the cell threw is genuinely not available here. Say what is true.
    return { status: 'runtime-error', message: 'the cell threw while running', trace };
  }

  // Panics, and anything else the engine chose not to flatten.
  return { status: 'runtime-error', message: describePanic(err), trace };
}

function thrownValue(err: BridgeError): Record<string, unknown> | null {
  return err.value !== null && typeof err.value === 'object' && !Array.isArray(err.value)
    ? (err.value as Record<string, unknown>)
    : null;
}

const FRAME = /^File "/;

/**
 * The stack frames the reader's own submission produced.
 *
 * The engine puts them in two different places: `bamlTrace` carries the
 * rendered BAML stack, while an `SdkPanic` renders its whole traceback into
 * the thrown value's `message` instead. Read both, then drop everything that
 * is not a `$submission_N.baml` frame — `RunCell` and `Session.eval` are host
 * plumbing the reader did not write.
 */
function readerFrames(err: BridgeError): string[] {
  const rendered = Array.isArray(err.bamlTrace) ? err.bamlTrace : [];
  const message = thrownValue(err)?.message;
  const embedded = typeof message === 'string' ? message.split('\n') : [];
  return [...rendered, ...embedded]
    .map((line) => line.trim())
    .filter((line) => FRAME.test(line) && line.includes('$submission'))
    .map(demangle);
}

/**
 * The human half of a thrown value's message, with any rendered stack removed.
 *
 * `err.message` is the bridge's formatted blob — `baml error: <fqn>: <message>`
 * followed by the whole stack — so it is never surfaced as-is.
 */
function plainMessage(err: BridgeError, fallback: string): string {
  const message = thrownValue(err)?.message;
  if (typeof message === 'string' && message.length > 0) {
    return demangle(prose(message)) || fallback;
  }
  const head = (err.message ?? '').split('\n')[0] ?? '';
  const formatted = /^baml (?:error|panic): [\w.]+(?:: (.*))?$/.exec(head);
  const recovered = formatted ? (formatted[1] ?? '') : head;
  return demangle(recovered) || fallback;
}

/** Drops `Traceback:` headers and `File "…"` frames, keeping the reason. */
function prose(message: string): string {
  return message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !FRAME.test(line) && !line.startsWith('Traceback'))
    .join(' ');
}

/**
 * A panic's one-line summary: its short class name, plus whatever detail the
 * thrown value carries — a rendered reason for `SdkPanic`, named fields for a
 * structured panic like `IndexOutOfBounds { index, length }`.
 */
function describePanic(err: BridgeError): string {
  const short = err.className?.split('.').pop() ?? '';
  const value = thrownValue(err);
  let detail = '';

  if (value !== null && typeof value.message === 'string') {
    detail = prose(value.message);
  } else if (value !== null) {
    detail = Object.entries(value)
      .map(([key, item]) => `${key}=${JSON.stringify(item)}`)
      .join(', ');
  }
  if (detail.length === 0) {
    detail = plainMessage(err, '');
  }

  const summary = [short, demangle(detail)].filter((part) => part.length > 0).join(': ');
  return summary.length > 0 ? summary : 'the cell panicked';
}

/**
 * Session declarations are lowered to `__baml_session_<n>_<Name>`. Diagnostics
 * quote the lowered spelling; the reader typed the short one.
 */
function demangle(text: string): string {
  return text.replace(/__baml_session_\d+_/g, '');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
