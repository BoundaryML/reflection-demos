/**
 * Wire types shared with the backend (backend/src/types.ts mirrors this file).
 *
 * Everything here is produced by real BAML runtime reflection:
 *   - `diagnostics` come from `reflect.Package.compile` rejecting the source
 *   - `classes` come from walking the compiled package (`pkg.classes()` / `get_class`)
 *   - `extract` runs the LLM seam with `unreflect(class.as_type())` as the output type
 */

export interface Span {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Diagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  span: Span | null;
}

export interface FieldInfo {
  name: string;
  type: string;
  description: string | null;
}

export interface ClassInfo {
  name: string;
  qualifiedName: string;
  fields: FieldInfo[];
}

export interface CompileTiming {
  /** Wall time of `reflect.Package.compile(...)` measured inside the BAML program. */
  compileMs: number;
  /** Wall time of the whole backend handler, including the bridge hop. */
  totalMs: number;
}

export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  classes: ClassInfo[];
  timing: CompileTiming;
  /** Monotonic request id so the UI can drop out-of-order responses. */
  revision: number;
}

export interface ExtractRow {
  field: string;
  type: string;
  value: string;
  missing: boolean;
}

export interface ExtractResult {
  ok: boolean;
  className: string;
  rows: ExtractRow[];
  json: unknown;
  /** The raw JSON the model (or the mock) produced, before BAML parsed it. */
  raw: string;
  /** The prompt BAML rendered for the runtime type, including `ctx.output_format`. */
  prompt: string;
  source: 'live' | 'mock';
  model: string | null;
  latencyMs: number;
  error: { code: string; message: string } | null;
}

export interface GenerateResult {
  ok: boolean;
  schema: string;
  source: 'live' | 'mock';
  model: string | null;
  latencyMs: number;
  prompt: string;
  error: { code: string; message: string } | null;
}

export interface StatusResult {
  mode: 'live' | 'mock';
  model: string | null;
  runtime: 'baml' | 'unavailable';
  runtimeError: string | null;
  bamlVersion: string | null;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  status: () => get<StatusResult>('/api/status'),
  compile: (schema: string, revision: number, signal?: AbortSignal) =>
    post<CompileResult>('/api/compile', { schema, revision }, signal),
  extract: (schema: string, className: string, document: string, signal?: AbortSignal) =>
    post<ExtractResult>('/api/extract', { schema, className, document }, signal),
  generate: (description: string, signal?: AbortSignal) =>
    post<GenerateResult>('/api/generate-schema', { description }, signal),
};
