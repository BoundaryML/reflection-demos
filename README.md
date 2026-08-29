# Reflection Demos

Seven small products that each demonstrate one facet of BAML's runtime reflection
(BEP-066) — types built, inspected, or compiled *while the program runs* instead of
fixed ahead of time — plus a hub site that links them all together.

| # | Demo | Reflection primitive | Frontend |
|---|------|-----------------------|----------|
| 1 | [Live Triage](demo-1-live-enums/README.md) | runtime enums | http://localhost:4411 |
| 2 | [Design-a-Form Extraction](demo-2-form-builder/README.md) | runtime classes | http://localhost:4421 |
| 3 | [Toggleable Toolbox](demo-3-tool-picker/README.md) | tool unions | http://localhost:4431 |
| 4 | [Plugin Registry](demo-4-plugin-gate/README.md) | witnessed contracts | http://localhost:4441 |
| 5 | [Schema Studio](demo-5-schema-studio/README.md) — flagship | `Package.compile` | http://localhost:4451 |
| 6 | [Self-Describing API](demo-6-api-explorer/README.md) | `Package.current` | http://localhost:4461 |
| 7 | [BAML Notebook](demo-7-notebook/README.md) | sessions | http://localhost:4471 |

The **hub** (http://localhost:4400) is the landing page: it links out to all seven demos
and shows a live up/down dot for each one's backend.

## Prerequisites

- **Node 20+** and **pnpm 9+** (`corepack enable` or `npm i -g pnpm`).
- **Rust** (stable toolchain) — the BAML canary toolchain is built from source.
- **A local BAML build, at the pinned commit.** These demos run against the canary
  language build, not the released `baml` binary. The exact
  [BoundaryML/baml](https://github.com/BoundaryML/baml) commit they are verified
  against is pinned in [`BAML_COMMIT`](BAML_COMMIT), and `./scripts/setup-baml.sh`
  does the whole dance (clone or symlink into `vendor/baml`, check out the pin,
  build, install, generate). Under the hood it builds two pieces:
  - The **`baml-cli`** binary (`cargo build -p baml_cli` in `vendor/baml/baml_language`).
    Client generation goes through the `scripts/baml-dev` wrapper around it.
  - The **TypeScript bridge** native addon, built in release profile:
    `pnpm install && pnpm build:napi-release && pnpm build:copy-native-dts` in
    `vendor/baml/baml_language/sdks/typescript/bridge_typescript` (a debug addon works
    but is 3–4× slower, which shows up in Schema Studio's compile pill and the
    Notebook's cell timings). Backends depend on it directly
    (`@boundaryml/baml-bridge`, a `link:` dependency — a symlink to that directory, so a
    rebuild is picked up on the next restart with no reinstall).
  - **Build both from the same commit, together.** The CLI and the addon report the same
    version string even when built days apart, and nothing guards the skew — it surfaces
    later as a bytecode load error or as failing live LLM calls. See
    [Troubleshooting](#troubleshooting). After rebuilding, run `pnpm generate`.
    The setup script enforces this by construction.
- **Optional: an LLM key.** Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in your shell if
  you want live model calls. Every demo also runs fully offline with **no key** by
  setting `MOCK_LLM=1` — the backend renders the real prompt and parses a canned
  response, so the reflection behavior is identical either way. Live keys are the
  upgrade, not the requirement.

## Run everything

```bash
./scripts/setup-baml.sh   # once: vendor + build the pinned BAML toolchain, pnpm install, generate
pnpm dev
```

Already have a BoundaryML/baml checkout? Point the script at it instead of cloning a
second one: `./scripts/setup-baml.sh ~/path/to/baml` (it will still check out the
pinned commit, refusing if the tree is dirty).

That's it — `pnpm dev` runs the hub and all seven demos concurrently (see the root
`package.json` for the exact filter list). Open http://localhost:4400 and click through.

To only (re)generate BAML clients across every demo that has one:

```bash
pnpm generate
```

## Port map

| Service | Port |
|---|---|
| Hub | 4400 |
| Demo 1 backend / frontend | 4410 / 4411 |
| Demo 2 backend / frontend | 4420 / 4421 |
| Demo 3 backend / frontend | 4430 / 4431 |
| Demo 4 backend / frontend | 4440 / 4441 |
| Demo 5 backend / frontend | 4450 / 4451 |
| Demo 6 backend / frontend | 4460 / 4461 |
| Demo 7 backend / frontend | 4470 / 4471 |

Each frontend's Vite dev server proxies `/api` to its own backend, and every backend
exposes `/api/health` (the hub polls these directly to drive its status dots).

## The demos

- **[Live Triage](demo-1-live-enums/README.md)** — support tickets get a priority enum
  BAML builds while the request is handled, not one baked into a fixed schema.
- **[Design-a-Form Extraction](demo-2-form-builder/README.md)** — draw a form in the
  browser; BAML mints a matching class on the spot and extracts into it.
- **[Toggleable Toolbox](demo-3-tool-picker/README.md)** — flip tools on and off and
  watch the model's dispatch union grow and shrink live.
- **[Plugin Registry](demo-4-plugin-gate/README.md)** — plugins are checked against an
  interface contract at runtime, with a pass/fail witness instead of a compile step.
- **[Schema Studio](demo-5-schema-studio/README.md)** (flagship) — type a schema, hit
  compile, and `Package.compile` turns it into a whole live package.
- **[Self-Describing API](demo-6-api-explorer/README.md)** — an endpoint calls
  `Package.current()` to document itself by introspecting its own running package.
- **[BAML Notebook](demo-7-notebook/README.md)** — a REPL-style notebook where each
  cell runs in its own isolated session with packages mounted on demand.

## Troubleshooting

**`baml-dev: ... not built` / client generation fails.** The local canary binary
hasn't been built yet (or `vendor/baml` doesn't exist). Run `./scripts/setup-baml.sh`,
or just build the CLI:

```bash
cd vendor/baml/baml_language && cargo build -p baml_cli
```

Then re-run `pnpm generate` (or a single demo's `baml:generate` script). If another
agent/process owns that build lock, wait for it rather than running a second build in
parallel — everything else in this repo works without it, generated clients are
committed, and only fresh schema edits need a rebuilt CLI.

**The CLI and the bridge addon disagree.** Any of these means `baml-cli` and
`@boundaryml/baml-bridge` were built from different commits (both will still print the
same version number):

- `Failed to deserialize BAML bytecode: Unexpected variant tag: N` (or `Invalid Option
  representation`) when a backend imports its generated `baml_sdk` — the client was
  generated by a newer CLI than the addon can load.
- `version skew error` / `Bex is outdated` at `initializeRuntime`. (`Bex is outdated` is
  also what an ordinary compile error in `baml_src` looks like through the embedding API —
  run `baml-dev check` in the demo first.)
- Live LLM calls through a *reflected* output type fail while mock mode works:
  `ai.errors.ParseFailed` where the model plainly ignored the schema, or a VM panic like
  `reflected enum user.$dyn.0.Category must be loaded`. Older addons drop a runtime type's
  definition when the call crosses `ai.Agent.Runner<Out>`.

Fix: rebuild both from the same checkout, in this order, then regenerate the clients
(this is exactly what `./scripts/setup-baml.sh` does):

```bash
cd vendor/baml/baml_language && cargo build -p baml_cli
cd sdks/typescript/bridge_typescript && pnpm build:napi-release && pnpm build:copy-native-dts
cd ../../../../..   # back to the repo root
pnpm generate
```

Generation drops a `.gitignore` containing `*` into each sdk dir; `pnpm generate`
deletes them afterwards (`scripts/strip-sdk-gitignore.mjs`) so the clients stay
committed. Never regenerate with only one of the two rebuilt — that bricks the demo
until the other catches up.

**Port already in use.** Something else on your machine is bound to one of the ports in
the [port map](#port-map) above (a stale `pnpm dev` from a previous run is the usual
cause). Find and stop it:

```bash
lsof -i :4400   # swap in the port that's stuck
kill <pid>
```

or stop everything with `pnpm dev`'s own Ctrl-C (it runs `concurrently -k`, which kills
all sibling processes together).

**A demo's status dot on the hub stays grey.** That demo's backend isn't reachable on
its `44N0` port — either it hasn't started yet (dev servers take a few seconds), or its
process crashed. Check the terminal running `pnpm dev` for that demo's log lines.
