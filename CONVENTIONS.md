# Reflection Demos — shared conventions (READ FIRST, all agents)

Seven realistic demos of BAML BEP-066 runtime reflection + one hub site. Purpose: show what
reflection enables in an ENGAGING product-shaped way, then reveal the BAML code that powers it.

## Stack & layout (every demo identical shape)
- `demo-N-<slug>/` — pnpm package, `"private": true`.
  - `frontend/` — React + Vite + TypeScript. Clean, modern, minimal-dependency UI.
  - `backend/` — Express + TypeScript (tsx for dev). SQLite via better-sqlite3 ONLY if the
    demo needs persistence.
  - `baml_src/` — the BAML powering the demo (functions, clients).
  - `package.json` with scripts: `dev` (concurrently runs backend+frontend), `baml:generate`
    (runs client generation, see below).
  - `README.md` — what the demo shows, how to run standalone, env vars, a 30-second demo
    script ("click this, watch that") for presenting.
- Ports: hub 4400; demo N backend 44N0, frontend 44N1 (e.g. demo 3: backend 4430, frontend 4431).
  Frontend proxies `/api` to its backend (vite proxy).

## The published toolchain (pinned nightly)
- Everything runs on PUBLISHED artifacts: the `baml` CLI wrapper selects the
  pinned nightly toolchain (`baml toolchain use "$(cat BAML_VERSION)"` — the
  root `BAML_VERSION` file is the single source of truth), and backends depend
  on the npm package `@boundaryml/baml-bridge` pinned to that same exact
  version in each demo's package.json. No Rust, no vendored checkout.
- The CLI toolchain and the bridge package are ONE toolchain: keep the versions
  identical, and after bumping BAML_VERSION update every bridge pin, run
  `pnpm install`, and `pnpm generate`. Skew symptoms are in the root README's
  Troubleshooting.
- Client generation: `baml generate` from the demo's directory (wire it as the
  `baml:generate` script). Commit generated client code so demos run without a
  pre-step where feasible; `pnpm generate` at the root also strips the
  `.gitignore` (`*`) that generation drops into each sdk dir. A demo whose
  presenter beat edits `baml_src` mid-demo must regenerate on every dev start
  (see demo-6 in scripts/dev.mjs) — restarting alone does not re-embed bytecode.

## BAML API ground truth (the language moved fast — trust these, not memory)
- Since canary #4543 (2026-08-21) `reflect` is a root package: `reflect.Type.of<T>()` (not
  `type.of<T>()`), a runtime type value is annotated `reflect.Type` (not bare `type`), and every
  `baml.reflect.*` name is `reflect.*` (`reflect.errors.CompilationError`, `reflect.Diagnostic`,
  `reflect.WithMeta<reflect.Type>`). All demos were migrated on 2026-08-24.
- The CLI is the API reference: `baml describe <name>` prints the full source
  of any stdlib function (`baml describe reflect`, `baml describe baml.AnyClass`,
  …) — never guess the stdlib.
- Client decl: `client C = openai.ResponsesClient.new(model=..., api_key=..., base_url=...);`
  LLM companions are $-spelled: `Fn$render_prompt<...>(...)`, `Fn$parse<...>(...)`.
- Field reads: narrow to `reflect.AnyClass` (#4491; moved from `baml.AnyClass` to
  `reflect` in #4580) and read method-style: `let v: reflect.AnyClass = x else
  { throw ... }; v.get<T>(name)` (returns `T?`). The free function
  `reflect.class.get_field<T>(obj, name)` also still works. JSON encoding is
  `baml.json.to_string(v)` (`baml.json.encode` was removed), prompts inject
  `${ctx.output_format()}` (a call), and `throws unknown` declarations are
  rejected — omit them; BAML infers thrown types.

## LLM keys & mock mode (MANDATORY)
- Backends read `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` from env (document in README).
- EVERY demo must also work with NO keys: a `MOCK_LLM=1` mode where the backend uses the
  `$render_prompt` + `$parse` seam with canned model outputs (this is exactly how the BAML test
  suite works — render the real prompt, parse a canned JSON response). The demo must be fully
  presentable offline; live-LLM mode is the upgrade, not the requirement.

## Pure user-facing product (NO code panel)
Demos are pure product experiences — do NOT embed a "show the BAML code" panel/split view in
the UI. The presenter reveals `baml_src` in their own editor after the wow moment. Consequence:
keep `baml_src` files clean, short, and presentation-ready (good names, comments only where
they teach, the reflection call easy to point at) — that file IS the second half of the demo.
(Exception: demo-5 Schema Studio's editor is the product itself, not a code panel — unaffected.)

## Quality bar
- `pnpm install && pnpm dev` from the repo root runs EVERYTHING (root scripts exist already).
- TypeScript strict; no unused deps; seed data where a demo needs content; tasteful default
  styling (system fonts fine, no heavy UI kits); loading/error states for LLM calls.
- Each agent works ONLY inside its own `demo-N-*/` (or `hub/`) directory. Root files are owned
  by the coordinator.
