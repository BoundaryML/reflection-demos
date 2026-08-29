# Demo 2 — Design-a-Form Extraction

BEP-066 Scenario 2, live: **stored form rows → runtime class → extraction.**

A two-tab app. In **Design**, you define a form: field name, kind (text /
number / dropdown-with-options / bullet list), description — persisted in
sqlite. In **Extract**, you paste any unstructured text and the backend
turns your saved field rows into a real BAML class *at request time*,
extracts the text into it, and renders the filled-in form.

The wow: the schema the LLM extracts into is whatever you designed seconds
ago. This is the exact pattern a real customer (medical scribing) migrated
to — design the note template once, mint the extraction schema from it on
every visit.

## What's actually happening (`baml_src/main.baml`)

`FormType(saved: SavedField[]) -> reflect.class.Type` is the reflection
call: it walks your saved fields and mints a runtime class —

- `text` / `number` fields become `reflect.Type.of<string>()` / `reflect.Type.of<int>()`
- `dropdown` fields become a **literal union**: one `reflect.literal.new(option)`
  per option, joined with `reflect.union.new(...)`
- `bulleted_list` fields become `reflect.Type.of<string>().array()`
- every field carries its description via `.meta(description = ...)`, so the
  rendered prompt explains what the model should look for

`ExtractIntoFormLive` / `ExtractIntoFormMock` then bind that runtime type
with `unreflect(form_t.as_type())`, call `Extract<T>` (or its
`$render_prompt` / `$parse` companions), and read every field back with
`reflect.class.get_field<T>(note, field.name)` — typed per field kind, then
flattened to strings so the frontend can render a plain filled form.

This file is meant to be read in an editor during a demo — it's short
(under 120 lines) and the reflection calls are easy to point at. There's no
in-app code panel; that's a deliberate choice, not an oversight.

## Running it

```sh
pnpm install    # from the reflection-demos repo root
pnpm --filter demo-2-form-builder dev
# or, from this directory:
pnpm dev
```

- Backend: http://localhost:4420
- Frontend: http://localhost:4421 (proxies `/api` to the backend)

### Mock mode (no API key needed)

The app auto-detects: no `ANTHROPIC_API_KEY` in the environment → mock mode.
You can also force it with `MOCK_LLM=1 pnpm dev`. Mock mode still calls
`Extract$render_prompt` (proving the runtime schema renders into a real
prompt) and `Extract$parse` (proving it parses canned JSON into the
runtime type and reads back through reflection) — it just skips the actual
network call. Canned extraction JSON is keyed by field name against the two
seed transcripts (doctor visit / real-estate listing), so the "Load
starter" presets and "Use sample transcript" buttons produce a perfect fill
every time; a custom field falls back to a sensible per-kind placeholder
(0, "", [], or "(not mentioned in the text)").

### Live mode

Set `ANTHROPIC_API_KEY` and just run `pnpm dev` — no flag needed. Extraction
goes through `Extract<T>` for real, using `claude-haiku-4-5`: the
runtime-minted class renders into the prompt as a genuine schema, and the
model's JSON is parsed straight back into it.

Live answers differ from the canned ones, which is rather the point — the
doctor transcript says "six foot even" and the model returns
`patient_height_cm: 183`, and a field you added seconds earlier gets filled
from the text instead of from a fixture.

## Environment notes

The backend talks to the BAML runtime directly through the low-level
`@boundaryml/baml-bridge` package (`BamlRuntime.initializeRuntime` +
`callFunction`, see `backend/src/baml.ts`) — the same primitive a generated
`baml_client` normally wraps. `baml_src` is compiled in-process at startup,
so there is **no generated client and no build step**: this demo has no
`backend/baml_client/` directory and does not need one.

Consequently `pnpm baml:generate` is wired but unused — there is nothing for
it to generate. Use `baml-dev check` from this directory to validate
`baml_src` instead.

The bridge is a `link:` dependency, so `node_modules/@boundaryml/baml-bridge`
is a symlink straight to `sdks/typescript/bridge_typescript`. Rebuilding the
bridge is picked up on the next backend restart, with no reinstall.

`BamlClientError: Bex is outdated` at `initializeRuntime` does **not** only
mean the addon is stale — the bridge reports *any* `baml_src` compile error
that way, and it also appears when the installed bridge is missing its
`dist/`. Run `baml-dev check` from this directory first; it prints the real
diagnostic.

## Seed data

Two presets in `backend/src/seeds.ts` (`PRESETS`, `SEED_TRANSCRIPTS`,
`MOCK_EXTRACTIONS`):

- **Doctor visit** — `chief_complaint` (text), `patient_height_cm` (number),
  `symptoms` (bullet list), `visit_type` (dropdown), `follow_up_needed`
  (dropdown)
- **Real estate listing** — `property_type` (dropdown), `asking_price_usd`
  (number), `bedrooms` (number), `highlights` (bullet list),
  `listing_status` (dropdown)

Loading a preset replaces the current fields but stays fully editable
afterward — add, remove, rename, whatever. That's the point of the demo.

Field names become real fields on the minted class, so they have to be BAML
identifiers: letters, digits and underscores, not starting with a digit, and
not a BAML keyword (`test` and `type` are the two that catch people out). The
Design tab rejects anything else inline — otherwise the bad row persists and
every later extraction fails inside `reflect.class.new`.

## 30-second presenter script

1. **Design tab** — click "Doctor visit form". Five fields appear instantly.
   Point out the dropdown fields have real option lists, and the bullet
   field has a description.
2. Add one more field live — e.g. a `medication_prescribed` dropdown with
   options `yes, no` — to show the form is genuinely user-built, not a
   fixed template.
3. **Extract tab** — click "Use sample: doctor visit" to fill the textarea,
   then hit **Extract**.
4. The filled form renders: text, a number, a bullet list, two colored
   dropdown pills — all read back out of a class that didn't exist ten
   seconds ago.
5. Switch to the editor, open `baml_src/main.baml`, and point at
   `FormType` — "this is the entire schema-minting logic. Text becomes
   `reflect.Type.of<string>()`, a dropdown becomes a literal union built from
   whatever options you typed into the browser, a bullet list becomes
   `string[]`." Then `ExtractIntoFormLive` / `ExtractIntoFormMock` —
   "`unreflect` binds that runtime type into the LLM call; `get_field`
   reads it back out, typed." That's the whole trick.
6. Optional: switch to the **Real estate listing** preset and repeat, to
   show it's not special-cased to medical data — the same five lines of
   BAML mint whatever schema the browser sends.

## Stack

- `frontend/` — React + Vite + TypeScript, no UI kit.
- `backend/` — Express + TypeScript (via `tsx`), better-sqlite3 for the
  saved field rows.
- `baml_src/` — the BAML powering both extraction paths.
