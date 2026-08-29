/** Wire types. Mirrored by frontend/src/lib/api.ts. */

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

export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  classes: ClassInfo[];
  timing: { compileMs: number; totalMs: number };
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
  raw: string;
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

/** ── shapes returned by studio.baml ─────────────────────────────────────── */

export interface BamlNote {
  code: string;
  message: string;
  file: string | null;
  start: number | bigint;
  end: number | bigint;
}

export interface BamlMember {
  name: string;
  type: string;
  description: string | null;
}

export interface BamlRecord {
  name: string;
  fields: BamlMember[];
}

export interface BamlCompilation {
  ok: boolean;
  records: BamlRecord[];
  notes: BamlNote[];
  micros: number | bigint;
}

export interface BamlExtraction {
  prompt: string;
  response: string;
}

export interface BamlSchemaDraft {
  prompt: string;
  schema: string;
}
