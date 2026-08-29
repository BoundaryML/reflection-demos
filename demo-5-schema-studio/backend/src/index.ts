import express, { type Request, type Response } from 'express';
import { boot, compileSchema, describeSchema, draftSchema, runExtraction, runtimeStatus } from './baml.js';
import { cannedDraft, parseType, sampleResponse } from './mock.js';
import { EDITOR_FILE, toDiagnostics } from './spans.js';
import type {
  BamlCompilation,
  BamlSchemaDraft,
  BamlExtraction,
  BamlRecord,
  ClassInfo,
  CompileResult,
  ExtractResult,
  ExtractRow,
  GenerateResult,
  StatusResult,
} from './types.js';

const PORT = Number(process.env.PORT ?? 4450);

/** Mirrors the `client:` selector in baml_src/model.baml. */
function chosenModel(): string | null {
  if (process.env.MOCK_LLM === '1') return null;
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'claude-sonnet-4-5';
  if (process.env.OPENAI_API_KEY?.trim()) return 'gpt-4o-mini';
  return null;
}

const liveMode = (): boolean => chosenModel() !== null;

const app = express();
app.use(express.json({ limit: '1mb' }));

/** ── health ─────────────────────────────────────────────────────────────── */

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/** ── status ─────────────────────────────────────────────────────────────── */

app.get('/api/status', (_req: Request, res: Response<StatusResult>) => {
  const runtime = runtimeStatus();
  res.json({
    mode: liveMode() ? 'live' : 'mock',
    model: chosenModel(),
    runtime: runtime.ok ? 'baml' : 'unavailable',
    runtimeError: runtime.error,
    bamlVersion: runtime.version,
  });
});

/** ── compile ────────────────────────────────────────────────────────────── */

const asClasses = (records: BamlRecord[]): ClassInfo[] =>
  records.map((record) => ({
    name: record.name,
    qualifiedName: `root.${record.name}`,
    fields: record.fields.map((f) => ({
      name: f.name,
      type: f.type,
      description: f.description ?? null,
    })),
  }));

app.post('/api/compile', async (req: Request, res: Response) => {
  // An absent `schema` used to compile the empty string, which answers a
  // malformed request with a perfectly serene `ok: true, classes: []`.
  if (typeof req.body?.schema !== 'string') {
    res.status(400).json({ error: 'POST /api/compile expects {"schema": string, "revision"?: number}' });
    return;
  }
  const schema: string = req.body.schema;
  const revision = Number(req.body?.revision ?? 0);
  const started = process.hrtime.bigint();

  try {
    const out = await compileSchema<BamlCompilation>(schema);
    const totalMs = Number(process.hrtime.bigint() - started) / 1e6;
    const result: CompileResult = {
      ok: out.ok,
      // A rejected compile reports errors; an accepted one can still report warnings.
      diagnostics: toDiagnostics(out.notes, schema, out.ok ? 'warning' : 'error'),
      classes: asClasses(out.records),
      timing: { compileMs: Number(out.micros) / 1000, totalMs },
      revision,
    };
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: describe(err) });
  }
});

/** ── extract ────────────────────────────────────────────────────────────── */

app.post('/api/extract', async (req: Request, res: Response) => {
  const schema = String(req.body?.schema ?? '');
  const qualified = String(req.body?.className ?? '');
  const document = String(req.body?.document ?? '');
  const name = qualified.replace(/^root\./, '');
  const live = liveMode();
  const started = process.hrtime.bigint();

  try {
    const compiled = await describeSchema<BamlCompilation>(schema);
    if (!compiled.ok) {
      res.json(failed(name, live, 'E0000', 'the schema does not compile yet'));
      return;
    }
    const record = compiled.records.find((r) => r.name === name);
    if (!record) {
      res.json(failed(name, live, 'E0000', `the package has no class named ${name}`));
      return;
    }

    const reply = live ? null : sampleResponse(compiled.records, name, document);
    const out = await runExtraction<BamlExtraction>({
      source: schema,
      record: qualified,
      document,
      reply,
    });

    const json: unknown = JSON.parse(out.response);
    const result: ExtractResult = {
      ok: true,
      className: name,
      rows: rowsFor(record, json),
      json,
      raw: reply ?? out.response,
      prompt: out.prompt,
      source: live ? 'live' : 'mock',
      model: chosenModel(),
      latencyMs: Number(process.hrtime.bigint() - started) / 1e6,
      error: null,
    };
    res.json(result);
  } catch (err) {
    res.json({
      ...failed(name, live, codeOf(err), describe(err)),
      latencyMs: Number(process.hrtime.bigint() - started) / 1e6,
    });
  }
});

function rowsFor(record: BamlRecord, json: unknown): ExtractRow[] {
  const object = (json ?? {}) as Record<string, unknown>;
  return record.fields.map((field) => {
    const value = object[field.name];
    const missing = value === undefined || value === null || value === '';
    return {
      field: field.name,
      type: friendlyType(field.type),
      value: missing ? '' : render(value),
      missing,
    };
  });
}

/** `string | null` reads better as `string?` in a table cell. */
function friendlyType(spelling: string): string {
  const parsed = parseType(spelling);
  const base = spelling
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p !== 'null')
    .join(' | ');
  return parsed.optional && base.length > 0 ? `${base}?` : spelling;
}

/** Table cells read better as prose than as JSON. */
function render(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(render).join('\n');
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${key} ${render(inner)}`)
      .join('   ·   ');
  }
  return JSON.stringify(value) ?? '';
}

const failed = (className: string, live: boolean, code: string, message: string): ExtractResult => ({
  ok: false,
  className,
  rows: [],
  json: null,
  raw: '',
  prompt: '',
  source: live ? 'live' : 'mock',
  model: chosenModel(),
  latencyMs: 0,
  error: { code, message },
});

/** ── model-written schema ───────────────────────────────────────────────── */

app.post('/api/generate-schema', async (req: Request, res: Response) => {
  const description = String(req.body?.description ?? '').trim();
  const live = liveMode();
  const started = process.hrtime.bigint();

  if (description.length === 0) {
    res.status(400).json({ error: 'describe what you want extracted' });
    return;
  }

  try {
    const reply = live ? null : cannedDraft(description);
    const out = await draftSchema<BamlSchemaDraft>({ description, reply });
    const result: GenerateResult = {
      ok: true,
      schema: unfence(out.schema),
      source: live ? 'live' : 'mock',
      model: chosenModel(),
      latencyMs: Number(process.hrtime.bigint() - started) / 1e6,
      prompt: out.prompt,
      error: null,
    };
    res.json(result);
  } catch (err) {
    const result: GenerateResult = {
      ok: false,
      schema: '',
      source: live ? 'live' : 'mock',
      model: chosenModel(),
      latencyMs: Number(process.hrtime.bigint() - started) / 1e6,
      prompt: '',
      error: { code: codeOf(err), message: describe(err) },
    };
    res.json(result);
  }
});

/** Models like to wrap code in fences even when told not to. */
function unfence(text: string): string {
  const fenced = /```(?:baml)?\s*\n([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1]! : text).trim() + '\n';
}

/** ── errors ─────────────────────────────────────────────────────────────── */

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function codeOf(err: unknown): string {
  const className = (err as { className?: unknown })?.className;
  return typeof className === 'string' ? className : 'ERROR';
}

/** ── go ─────────────────────────────────────────────────────────────────── */

await boot();
const runtime = runtimeStatus();
app.listen(PORT, () => {
  const model = chosenModel();
  const mode = model ? `live (${model})` : 'offline (no ANTHROPIC_API_KEY / OPENAI_API_KEY)';
  console.log(`schema-studio api  http://127.0.0.1:${PORT}  ·  ${mode}`);
  console.log(
    runtime.ok
      ? `baml runtime ${runtime.version ?? '?'} ready · editor text compiles as ${EDITOR_FILE}`
      : `baml runtime unavailable: ${runtime.error}`,
  );
});
