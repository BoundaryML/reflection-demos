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

`form_type(saved: SavedField[]) -> reflect.class.Type` is the reflection
call: it walks your saved fields and mints a runtime class —

- `text` / `number` fields become `reflect.Type.of<string>()` / `reflect.Type.of<int>()`
- `dropdown` fields become a **literal union**: one `reflect.literal.new(option)`
  per option, joined with `reflect.union.new(...)`
- `bulleted_list` fields become `reflect.Type.of<string>().array()`
- every field carries its description via `.meta(description = ...)`, so the
  rendered prompt explains what the model should look for

`extract_into_form` then binds that runtime type
(`type F = unreflect(form_t.as_type())`), calls `extract<F>`, narrows the
result to `baml.AnyClass` — the read-only reflection surface every class
instance implements, minted classes included — and reads every field back
method-style with `note.get<T>(field.name)`, typed per field kind, then
flattened to strings so the frontend can render a plain filled form. `SavedField.kind` is a union of literals
(`"text" | "number" | "dropdown" | "bulleted_list"`), so the per-kind
`match` needs no catch-all arm — the compiler proves it exhaustive.

This file is meant to be read in an editor during a demo — it's short
(under 80 lines) and the reflection calls are easy to point at. There's no
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

### Live only

`ANTHROPIC_API_KEY` must be in the environment (e.g.
`infisical run -- pnpm dev`) — there is no mock mode; the code is
deliberately minimal so the whole demo fits on one screen. Extraction goes
through `extract<T>` using `claude-haiku-4-5`: the runtime-minted class
renders into the prompt as a genuine schema, and the model's JSON is
parsed straight back into it. The doctor transcript says "six foot even"
and the model returns `patient_height_cm: 183`, and a field you added
seconds earlier gets filled from the text — that's the beat to point at.

## Environment notes

The backend talks to the BAML runtime directly through the low-level
`@boundaryml/baml-bridge` package (`BamlRuntime.initializeRuntime` +
`callFunction`, see `backend/src/baml.ts`) — the same primitive a generated
`baml_client` normally wraps. `baml_src` is compiled in-process at startup,
so there is **no generated client and no build step**: this demo has no
`backend/baml_client/` directory and does not need one.

Consequently `pnpm baml:generate` is wired but unused — there is nothing for
it to generate. Use `baml check` from this directory to validate
`baml_src` instead.

The CLI toolchain and the npm `@boundaryml/baml-bridge` package must be the
same version — `BAML_VERSION` at the repo root pins both. On a skew error, run
`baml toolchain use "$(cat ../BAML_VERSION)"`, `pnpm install`, and regenerate.

`BamlClientError: Bex is outdated` at `initializeRuntime` does **not** only
mean the addon is stale — the bridge reports *any* `baml_src` compile error
that way, and it also appears when the installed bridge is missing its
`dist/`. Run `baml check` from this directory first; it prints the real
diagnostic.

## Seed data

Two presets in `backend/src/seeds.ts` (`PRESETS`, `SEED_TRANSCRIPTS`):

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
every later extraction fails inside the class builder (`Builder.field`
throws the compiler's `CompilationError` for a bad or duplicate name —
that validation is why `form_type` uses `reflect.class.builder` rather
than handing `reflect.class.new` a map, where a duplicate key would
silently replace).

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
   `form_type` — "this is the entire schema-minting logic. Text becomes
   `reflect.Type.of<string>()`, a dropdown becomes a literal union built from
   whatever options you typed into the browser, a bullet list becomes
   `string[]`." Then `extract_into_form` —
   "`type F = unreflect(...)` binds that runtime type into the LLM call;
   narrow the result to `baml.AnyClass` and `.get<T>` reads it back out,
   typed." That's the whole trick.
6. Optional: switch to the **Real estate listing** preset and repeat, to
   show it's not special-cased to medical data — the same five lines of
   BAML mint whatever schema the browser sends.

## Stack

- `frontend/` — React + Vite + TypeScript, no UI kit.
- `backend/` — Express + TypeScript (via `tsx`), better-sqlite3 for the
  saved field rows.
- `baml_src/` — the BAML: mint, bind, extract, read back.
