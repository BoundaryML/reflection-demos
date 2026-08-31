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

## Local BAML (NOT the released binary)
- CLI: `scripts/baml-dev` runs the locally built canary binary
  (vendor/baml/baml_language/target/debug/baml-cli).
- TS SDK (backend runtime): depend on the LOCAL bridge via a **`link:`** dependency (a symlink):
  `"@boundaryml/baml-bridge": "link:../vendor/baml/baml_language/sdks/typescript/bridge_typescript"`
  (`file:` makes pnpm COPY the addon into its store at install time, so a rebuilt bridge is
  invisible until reinstall — that bit us on 2026-08-24.)
- The CLI and the bridge addon are ONE toolchain: rebuild them together, from the same commit
  (`cargo build -p baml_cli`, then `pnpm build:debug` in `bridge_typescript`), then regenerate
  every demo that has a client. Both report the same version string even when built days apart,
  so nothing guards the skew — see the root README's Troubleshooting for the symptoms.
  The coordinator owns that rebuild; demo agents do not run cargo.
- Client generation: `baml-dev generate` from the demo's `baml_src` (see `baml-dev generate --help`;
  wire it as the `baml:generate` script). Commit generated client code so demos run without a
  pre-step where feasible. Delete the `.gitignore` (`*`) that generation drops into the sdk dir.

## BAML API ground truth (the language moved fast — trust these, not memory)
- Since canary #4543 (2026-08-21) `reflect` is a root package: `reflect.Type.of<T>()` (not
  `type.of<T>()`), a runtime type value is annotated `reflect.Type` (not bare `type`), and every
  `baml.reflect.*` name is `reflect.*` (`reflect.errors.CompilationError`, `reflect.Diagnostic`,
  `reflect.WithMeta<reflect.Type>`). All demos were migrated on 2026-08-24.
- The stdlib source is the API reference:
  vendor/baml/baml_language/crates/baml_builtins2/baml_std/reflect/
  (`type.baml`, `reflect.baml`, `ns_class/class.baml`, …). `thoughts/antonio/bep066_demo.baml`
  predates #4543 — do not copy its spellings.
- Scenario test files (authoritative behavior):
  vendor/baml/baml_language/crates/baml_tests/tests/
  (reflect_call_any.rs, runtime_classes_and_composites.rs, runtime_package_compile.rs,
  runtime_session.rs, runtime_type_bindings.rs, runtime_interface_witnesses.rs).
- Client decl: `client C = openai.ResponsesClient.new(model=..., api_key=..., base_url=...);`
  LLM companions are $-spelled: `Fn$render_prompt<...>(...)`, `Fn$parse<...>(...)`.
- Field reads: narrow to `baml.AnyClass` (baml #4491 — every class instance implements
  it, minted classes included) and read method-style: `let v: baml.AnyClass = x else
  { throw ... }; v.get<T>(name)` (returns `T?`). The older `instance_from` design was
  superseded by this (#4466); the free function `reflect.class.get_field<T>(obj, name)`
  also still works.

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
