# Demo 4 — Plugin Registry with Type-Checked Contracts

**Digest** is a document-summarization product with a plugin marketplace. Anyone can publish a
summarizer plugin; Digest never compiled against any of them. A plugin still cannot register, and
cannot be called, unless it satisfies the host's contract — and when it fails, the user sees the
BAML compiler's own diagnostic.

BEP-066 Scenario 4: bounded generics + witnessed runtime classes + scoped runtime type bindings.

## What it shows

The demo has two gates, and both belong to the compiler.

**Gate 1 — install.** A submitted plugin is compiled at runtime with `reflect.Package.compile`,
re-minted as a runtime class with `reflect.class.new(...)`, and handed a structural witness for the
host's `interface Summarizer`. If nothing in the plugin answers `key_points`, or answers it with the
wrong type, construction throws a `CompilationError` carrying the compiler's own diagnostics —
`E0001`, naming the interface field and the class field that failed it. (A submission that does not
even parse fails one step earlier, inside `reflect.Package.compile`, and those diagnostics carry
spans, which the UI highlights in the source.) Nothing is registered, and no model is called.

**Gate 2 — invoke.** Every path from the host to a plugin runs through
`function invoke<P extends Summarizer>(...)`, called as
`type P = unreflect(plugin.as_type()); invoke<P>(...)`. The bound is checked against the runtime
type at the call site. A plugin loaded without a witness — the "unchecked plugin loader" the UI lets
you simulate — is rejected there, *before a prompt is rendered and before a token is spent*.

The payoff: inside `invoke`, `result.summary` and `result.key_points` are ordinary typed field reads
on a class the host has never seen. The plugin's own extra fields (`reading_time_min`, `tone`, …)
are read with `reflect.class.get_field`. Runtime-loaded code gets exactly the type safety static
code gets.

The registry also stores the minted class's canonical BAML, rendered back out of the type itself
with `reflect.Type.to_baml()` — an `implements Summarizer { key_points as bullets }` block, the
registry's own proof of which plugin field answers which contract field. (`manifest` in
`registry.baml` keeps the one declaration that carries the witness; the `TODO(to_baml)` there says
why that is currently necessary.)

## Run it

```bash
pnpm install          # from the repo root
pnpm --filter demo-4-plugin-gate dev
```

- API: <http://localhost:4440>
- UI: <http://localhost:4441>

The first boot spends ~2–3 seconds compiling `baml_src`; the UI shows a "host starting…" banner and
goes green when it is ready. After that, installs and runs are 50–400 ms.

Validate the BAML on its own:

```bash
pnpm --filter demo-4-plugin-gate baml:check
```

## Live only

`ANTHROPIC_API_KEY` must be in the environment (e.g. `infisical run -- pnpm dev`) — there
is no mock mode; the code is deliberately minimal. Note that the two rejection beats
(gate 1 and gate 2) never reach a model at all, so only actual **Run plugin** clicks
spend tokens.

| variable | effect |
| --- | --- |
| `PLUGIN_MODEL` | model selector, e.g. `openai/gpt-4o-mini`; defaults to `anthropic/claude-haiku-4-5` |

Each run's `Report.prompt` carries the request the plugin's schema produced
(`Summarize$render_prompt<P>` — shown in the UI behind "Show the request this plugin's
schema produced").

## Files

| path | what it is |
| --- | --- |
| `baml_src/contract.baml` | the published contract (`interface Summarizer`) and the bounded LLM function `Summarize<T extends Summarizer>` |
| `baml_src/registry.baml` | both gates: `mint` (witness construction) and `invoke` (the bounded call), plus `describe` and `manifest` for the registry listing |
| `baml_src/host.baml` | plumbing — the long-lived JSON-lines worker that holds the minted types |
| `backend/src/host.ts` | spawns and talks to that worker |
| `backend/src/catalog.ts` | sample plugins and sample documents |
| `frontend/src/` | the marketplace UI |

## Note on the runtime: CLI host, not the bridge

This backend does **not** use `@boundaryml/baml-bridge`. It runs `baml_src/host.baml` as one
long-lived `baml run` process and speaks newline-delimited JSON to it over stdin/stdout.

Two reasons:

1. The registry is stateful — it holds live minted `reflect.class.Type` values across requests. A
   long-lived BAML process models that directly, and is the honest shape for a plugin host.
2. It pins the demo to the locally built canary toolchain, which is where BEP-066 lives.

The CLI is resolved as `$BAML_CLI` → `~/.baml/bin/baml` (the published wrapper). Make sure
the pinned toolchain is selected: `baml toolchain use "$(cat ../BAML_VERSION)"`.

Troubleshooting for the other demos, kept here for parity: a *version skew error at import* from a
generated SDK means the CLI toolchain and the npm `@boundaryml/baml-bridge` package are different
versions — `baml toolchain use "$(cat ../BAML_VERSION)"`, `pnpm install`, regenerate.

## 30-second demo script

1. **Land on the page.** One plugin is installed: *Terse*, by Northwind Labs. The rail on the left
   shows the contract every plugin must answer. Click **Run plugin** — a summary and key points
   come back, plus `reading_time_min`, which is Terse's own field, not the contract's.
2. **Click *BulletBot*, then Install.** Rejected, with `E0001: interface field
   `Summarizer.key_points` links to missing class field `key_points``. BulletBot calls its list
   `bullets`. Nothing was registered; no model was called.
3. **Fix it without touching the plugin.** In *Contract bindings*, set `key_points is answered by`
   → `bullets`, and install again. It passes, and the registered manifest now reads
   `key_points as bullets`.
4. **Click *Legacy Digest*, then Install.** Rejected again, this time on the type:
   `requires `string[]`, but class field `key_points` has `string``. No binding can fix that one.
5. **Click "Load it unchecked and run it anyway →".** This is what a plugin loader without a
   contract check would do. The host still refuses: *blocked at the call site*, `E0001 mismatched
   types` — the bound on `invoke<P extends Summarizer>` rejected the runtime type before a prompt
   was rendered.

The line to land on: **the host never compiled against any of these plugins, and it still cannot
call one wrongly.**

A longer, slower walkthrough is in [`PRESENTER.md`](./PRESENTER.md).
