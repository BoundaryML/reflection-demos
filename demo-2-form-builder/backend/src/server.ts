import express from "express";
import type { Request, Response } from "express";
import {
  addField,
  deleteField,
  listFields,
  replaceAllFields,
  type FieldKind,
} from "./db.js";
import { PRESETS, SEED_TRANSCRIPTS, type SeedId } from "./seeds.js";
import { extractForm } from "./baml.js";

const PORT = Number(process.env.PORT ?? 4420);
const VALID_KINDS: FieldKind[] = ["text", "number", "dropdown", "bulleted_list"];

// A field name becomes a real field on the runtime-minted class, so it has to
// be a BAML identifier. `reflect.class.new` rejects anything else with an E0010
// CompilationError — and because the rows are persisted, one bad name would
// break every later extraction, not just the request that added it. Reject it
// here instead, where the Design tab can show the message inline.
const BAML_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

// baml_compiler_lexer::is_baml_identifier — the hard keywords the lexer gives
// their own token kind, plus its CONTEXTUAL_KEYWORDS list.
const BAML_KEYWORDS = new Set([
  "await", "break", "catch", "catch_all", "class", "client", "continue",
  "defer", "else", "enum", "extends", "for", "function", "generator", "if",
  "implement", "implements", "in", "instanceof", "interface", "is", "let",
  "match", "requires", "retry_policy", "return", "spawn", "template_string",
  "test", "testset", "throw", "throws", "while",
  "as", "catch_all_panics", "const", "false", "map", "null", "true", "type",
  "unreflect", "with",
]);

/**
 * Turn a thrown BAML error into one readable line for the Extract tab.
 *
 * A `BamlError`'s `message` is `baml error: <FQN>[: <detail>]` followed by BAML
 * stack frames, and its `value` is the decoded thrown object. Neither alone is
 * enough: `reflect.errors.CompilationError` puts the useful part in the
 * message, while `ai.errors.*` (a bad key, a rate limit, a refusal) puts it in
 * the payload's `detail` / `raw_body`. Take the headline from one and the
 * provider's own explanation from the other.
 */
function describeBamlError(err: unknown): string {
  if (!(err instanceof Error)) return "extraction failed";

  const headline = err.message.split("\n")[0].replace(/^baml error:\s*/, "");
  const payload = ((err as { value?: unknown }).value ?? {}) as Record<
    string,
    unknown
  >;
  const detail = [payload.detail, payload.raw_output, payload.raw_body]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" — ");

  const full = detail ? `${headline} — ${detail}` : headline;
  return full.length > 400 ? `${full.slice(0, 400)}…` : full;
}

/** Null when the name is usable, else the reason it is not. */
function fieldNameProblem(name: string): string | null {
  if (!BAML_IDENTIFIER.test(name)) {
    return `field name "${name}" must be letters, digits and underscores, and cannot start with a digit — try "${name
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/^([0-9])/, "_$1")}"`;
  }
  if (BAML_KEYWORDS.has(name)) {
    return `field name "${name}" is a BAML keyword — pick another (e.g. "${name}_value")`;
  }
  return null;
}

const app = express();
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/api/mode", (_req: Request, res: Response) => {
  res.json({ mock: false, reason: "live only" });
});

app.get("/api/fields", (_req: Request, res: Response) => {
  res.json(listFields());
});

app.post("/api/fields", (req: Request, res: Response) => {
  const { name, kind, options, description } = req.body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const nameProblem = fieldNameProblem(name.trim());
  if (nameProblem) {
    return res.status(400).json({ error: nameProblem });
  }
  if (!VALID_KINDS.includes(kind)) {
    return res
      .status(400)
      .json({ error: `kind must be one of ${VALID_KINDS.join(", ")}` });
  }
  const cleanOptions: string[] = Array.isArray(options)
    ? options.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  if (kind === "dropdown" && cleanOptions.length < 1) {
    return res
      .status(400)
      .json({ error: "dropdown fields need at least one option" });
  }

  const field = addField({
    name: name.trim(),
    kind,
    options: kind === "dropdown" ? cleanOptions : [],
    description: typeof description === "string" ? description.trim() : "",
  });
  res.status(201).json(field);
});

app.delete("/api/fields/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }
  const removed = deleteField(id);
  if (!removed) {
    return res.status(404).json({ error: "field not found" });
  }
  res.status(204).end();
});

app.post("/api/fields/preset", (req: Request, res: Response) => {
  const { preset } = req.body ?? {};
  if (preset !== "doctor" && preset !== "realestate") {
    return res.status(400).json({ error: "preset must be 'doctor' or 'realestate'" });
  }
  const fields = replaceAllFields(PRESETS[preset as SeedId]);
  res.json(fields);
});

app.get("/api/seeds", (_req: Request, res: Response) => {
  res.json(SEED_TRANSCRIPTS);
});

app.post("/api/extract", async (req: Request, res: Response) => {
  const { transcript } = req.body ?? {};
  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    return res.status(400).json({ error: "transcript is required" });
  }

  const fields = listFields();
  if (fields.length === 0) {
    return res
      .status(400)
      .json({ error: "design a form first — no fields defined yet" });
  }

  // Rows saved before the name check existed would fail deep inside
  // reflect.class.new with a stack trace. Name the culprit instead.
  for (const field of fields) {
    const problem = fieldNameProblem(field.name);
    if (problem) {
      return res
        .status(400)
        .json({ error: `${problem} (remove that field on the Design tab)` });
    }
  }

  try {
    const outcome = await extractForm(fields, transcript);
    res.json(outcome);
  } catch (err) {
    console.error("extraction failed:", err);
    res.status(500).json({ error: describeBamlError(err) });
  }
});

app.listen(PORT, () => {
  console.log(`demo-2-form-builder backend listening on http://localhost:${PORT}`);
});
