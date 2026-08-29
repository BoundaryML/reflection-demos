import type { BamlRecord } from './types.js';

/**
 * Offline mode.
 *
 * With no API key the studio still runs the whole pipeline — it just supplies
 * the model's half. The prompt is rendered from the runtime type for real and
 * the reply below is parsed by the real schema-aligned parser, so everything
 * downstream (coercion into the runtime class, missing-field handling, parse
 * errors) behaves exactly as it does live. This is the same seam the BAML test
 * suite uses.
 */

type Shape =
  | { kind: 'string' }
  | { kind: 'int' }
  | { kind: 'float' }
  | { kind: 'bool' }
  | { kind: 'array'; of: Shape }
  | { kind: 'map'; of: Shape }
  | { kind: 'record'; name: string }
  | { kind: 'unknown' };

interface Parsed {
  shape: Shape;
  optional: boolean;
}

export function parseType(spelling: string): Parsed {
  const members = splitUnion(spelling.trim());
  const optional = members.some((m) => m === 'null');
  const rest = members.filter((m) => m !== 'null');
  const head = rest[0] ?? 'unknown';
  return { shape: shapeOf(head), optional: optional || rest.length === 0 };
}

function splitUnion(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '<' || ch === '(' || ch === '[') depth += 1;
    if (ch === '>' || ch === ')' || ch === ']') depth -= 1;
    if (ch === '|' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function shapeOf(text: string): Shape {
  const t = text.trim().replace(/^\((.*)\)$/, '$1').trim();
  if (t.endsWith('[]')) return { kind: 'array', of: shapeOf(t.slice(0, -2)) };
  const map = /^map<\s*string\s*,(.*)>$/.exec(t);
  if (map) return { kind: 'map', of: shapeOf(map[1]!) };
  if (t === 'string') return { kind: 'string' };
  if (t === 'int') return { kind: 'int' };
  if (t === 'float' || t === 'number') return { kind: 'float' };
  if (t === 'bool') return { kind: 'bool' };
  if (/^[A-Za-z_][\w.]*$/.test(t)) return { kind: 'record', name: t.replace(/^root\./, '') };
  return { kind: 'unknown' };
}

/** ── reading the document ───────────────────────────────────────────────── */

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

interface Labelled {
  tokens: string[];
  value: string;
}

function readLabels(document: string): Labelled[] {
  const out: Labelled[] = [];
  for (const line of document.split('\n')) {
    const match = /^\s*[-*•]?\s*([A-Za-z][A-Za-z0-9 _\-/#().]{0,48}?)\s*[:=]\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const tokens = words(match[1]!);
    if (tokens.length === 0) continue;
    out.push({ tokens, value: match[2]! });
  }
  return out;
}

function bestLabel(labels: Labelled[], field: string): string | null {
  const want = words(field);
  if (want.length === 0) return null;
  let best: { score: number; value: string } | null = null;
  for (const label of labels) {
    const hits = want.filter((w) => label.tokens.includes(w)).length;
    if (hits === 0) continue;
    // Prefer labels that are mostly made of the field's own words.
    const score = hits / want.length + hits / label.tokens.length;
    if (!best || score > best.score) best = { score, value: label.value };
  }
  return best && best.score >= 1 ? best.value : null;
}

const numberIn = (text: string): number | null => {
  const m = /-?\d[\d,]*(\.\d+)?/.exec(text.replace(/[$£€]/g, ''));
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Lines that look like "something ... 12.50" — invoice rows, line items. */
function rowCandidates(document: string): Array<{ text: string; number: number }> {
  const rows: Array<{ text: string; number: number }> = [];
  for (const line of document.split('\n')) {
    if (/^\s*[-*•]?\s*[A-Za-z][^:=]*?\s{2,}|\t/.test(line) || /^\s*[-*•]\s+\S/.test(line)) {
      const n = numberIn(line.slice(Math.floor(line.length / 2)));
      const text = line.replace(/[-*•\t]/g, ' ').replace(/-?[\d,]+(\.\d+)?/g, '').replace(/\s{2,}/g, ' ').trim();
      if (n !== null && text.length > 1) rows.push({ text, number: n });
    }
  }
  return rows;
}

function bullets(document: string): string[] {
  return document
    .split('\n')
    .map((l) => /^\s*[-*•]\s+(.*\S)\s*$/.exec(l)?.[1] ?? null)
    .filter((v): v is string => v !== null && !/[:=]/.test(v));
}

/** ── synthesis ──────────────────────────────────────────────────────────── */

export function sampleResponse(records: BamlRecord[], target: string, document: string): string {
  const byName = new Map(records.map((r) => [r.name, r]));
  const labels = readLabels(document);
  const rows = rowCandidates(document);
  const list = bullets(document);
  const value = buildRecord(byName, target, { labels, rows, list, document }, new Set());
  return JSON.stringify(value ?? {}, null, 2);
}

interface Context {
  labels: Labelled[];
  rows: Array<{ text: string; number: number }>;
  list: string[];
  document: string;
}

function buildRecord(
  byName: Map<string, BamlRecord>,
  name: string,
  ctx: Context,
  seen: Set<string>,
): Record<string, unknown> | null {
  const record = byName.get(name);
  if (!record || seen.has(name)) return null;
  const nested = new Set(seen).add(name);
  const out: Record<string, unknown> = {};
  for (const field of record.fields) {
    out[field.name] = buildValue(byName, field.name, parseType(field.type), ctx, nested);
  }
  return out;
}

function buildValue(
  byName: Map<string, BamlRecord>,
  fieldName: string,
  parsed: Parsed,
  ctx: Context,
  seen: Set<string>,
): unknown {
  const { shape, optional } = parsed;
  const found = bestLabel(ctx.labels, fieldName);

  switch (shape.kind) {
    case 'string':
      if (found !== null) return found;
      return optional ? null : firstSentence(ctx.document);
    case 'int': {
      const n = found !== null ? numberIn(found) : null;
      if (n !== null) return Math.round(n);
      return optional ? null : 0;
    }
    case 'float': {
      const n = found !== null ? numberIn(found) : null;
      if (n !== null) return n;
      return optional ? null : 0;
    }
    case 'bool': {
      if (found !== null) return /^(y|yes|true|1)\b/i.test(found.trim());
      return optional ? null : false;
    }
    case 'array': {
      if (shape.of.kind === 'record') {
        const inner = byName.get(shape.of.name);
        if (!inner || seen.has(shape.of.name)) return [];
        return ctx.rows.slice(0, 4).map((row) => rowToRecord(byName, inner, row, ctx, seen));
      }
      if (found !== null) return splitList(found).map((piece) => coerceScalar(shape.of, piece));
      if (ctx.list.length > 0) return ctx.list.slice(0, 5).map((piece) => coerceScalar(shape.of, piece));
      return [];
    }
    case 'map':
      return {};
    case 'record': {
      const built = buildRecord(byName, shape.name, ctx, seen);
      return built ?? (optional ? null : {});
    }
    default:
      return optional ? null : '';
  }
}

function rowToRecord(
  byName: Map<string, BamlRecord>,
  record: BamlRecord,
  row: { text: string; number: number },
  ctx: Context,
  seen: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let numberUsed = false;
  for (const field of record.fields) {
    const parsed = parseType(field.type);
    if (parsed.shape.kind === 'string') {
      out[field.name] = row.text;
    } else if (parsed.shape.kind === 'int' || parsed.shape.kind === 'float') {
      out[field.name] = numberUsed ? (parsed.shape.kind === 'int' ? 1 : 1) : row.number;
      numberUsed = true;
    } else {
      out[field.name] = buildValue(byName, field.name, parsed, ctx, new Set(seen).add(record.name));
    }
  }
  return out;
}

function coerceScalar(shape: Shape, text: string): unknown {
  if (shape.kind === 'int') return Math.round(numberIn(text) ?? 0);
  if (shape.kind === 'float') return numberIn(text) ?? 0;
  if (shape.kind === 'bool') return /^(y|yes|true|1)\b/i.test(text.trim());
  return text.trim();
}

const splitList = (text: string): string[] =>
  text
    .split(/[,;]|\s+and\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

function firstSentence(document: string): string {
  const line = document.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return line.slice(0, 120);
}

/** ── canned schema drafts ───────────────────────────────────────────────── */

const DRAFTS: Array<{ match: RegExp; schema: string }> = [
  {
    match: /invoice|purchase|receipt|freight|bill|order/i,
    schema: `class Invoice {
  vendor string
  invoice_number string
  issued_on string @description("ISO date, YYYY-MM-DD")
  currency string
  total float
  line_items LineItem[]
}

class LineItem {
  description string
  amount float
}
`,
  },
  {
    match: /clinic|visit|patient|medical|chart|vital|note/i,
    schema: `class VisitNote {
  chief_complaint string
  height_cm int
  weight_kg float
  blood_pressure string?
  assessment string
  plan string[] @description("short imperative phrases")
}
`,
  },
  {
    match: /job|posting|role|hiring|candidate|resume|cv/i,
    schema: `class JobPosting {
  title string
  company string
  seniority string @description("one of: junior, mid, senior, staff")
  location string?
  salary_min int?
  salary_max int?
  must_have_skills string[]
}
`,
  },
  {
    match: /bug|support|ticket|incident|complaint|issue/i,
    schema: `class BugReport {
  summary string
  reporter string?
  severity string @description("one of: low, medium, high, critical")
  steps_to_reproduce string[]
  expected string?
  actual string?
}
`,
  },
];

export function cannedDraft(description: string): string {
  for (const draft of DRAFTS) {
    if (draft.match.test(description)) return draft.schema;
  }
  const name = titleCase(description) || 'Record';
  return `class ${name} {
  summary string @description("one sentence describing the document")
  subject string?
  mentioned_dates string[]
  amount float?
}
`;
}

function titleCase(description: string): string {
  const parts = words(description)
    .filter((w) => !['a', 'an', 'the', 'of', 'for', 'with', 'and', 'from', 'into', 'out'].includes(w))
    .slice(0, 3);
  if (parts.length === 0) return '';
  return parts.map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');
}
