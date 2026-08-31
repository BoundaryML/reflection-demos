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
- **The BAML CLI**, on the pinned toolchain. Runtime reflection (BEP-066)
  currently ships in BAML's nightly channel, so the demos pin the exact
  nightly they are verified against — it's in [`BAML_VERSION`](BAML_VERSION):

  ```bash
  brew install baml           # or the installer at https://docs.boundaryml.com
  baml toolchain use "$(cat BAML_VERSION)"
  ```

  The npm package `@boundaryml/baml-bridge` (the runtime the backends load) is
  pinned to the **same version** in each demo's `package.json` and comes down
  with `pnpm install` — prebuilt, no Rust needed. The CLI toolchain and the
  bridge must stay the same version; that's the one rule.
- **`ANTHROPIC_API_KEY`** in your environment — every demo makes real model
  calls (Haiku 4.5, and Sonnet 4.5 in Schema Studio). There is no mock mode.

## Run everything

```bash
baml toolchain use "$(cat BAML_VERSION)"   # once
pnpm install
export ANTHROPIC_API_KEY=sk-ant-...        # or however you manage secrets
pnpm dev
```

That's it — `pnpm dev` runs the hub and all seven demos concurrently. Open
http://localhost:4400 and click through.

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

**`baml: command not found` / wrong toolchain.** Install the CLI
(`brew install baml`, or the installer at https://docs.boundaryml.com), then
select the pinned toolchain: `baml toolchain use "$(cat BAML_VERSION)"`.
`baml --version` should print exactly the version in `BAML_VERSION`.

**The CLI and the bridge disagree** (`version skew error`, `Bex is outdated`
at `initializeRuntime`, or `Failed to deserialize BAML bytecode` at import).
The CLI toolchain and the npm `@boundaryml/baml-bridge` package must be the
same version. Check both: `baml --version` and
`cat demo-1-live-enums/node_modules/@boundaryml/baml-bridge/package.json | grep version`.
Fix with `baml toolchain use "$(cat BAML_VERSION)"` and a fresh `pnpm install`,
then `pnpm generate`. (`Bex is outdated` is also what an ordinary compile error
in `baml_src` looks like through the embedding API — run `baml check` in the
demo first.)

Generation drops a `.gitignore` containing `*` into each sdk dir; `pnpm generate`
deletes them afterwards (`scripts/strip-sdk-gitignore.mjs`) so the clients stay
committed.

**Edits don't hot-reload (HMR dead, changes only appear after a restart).**
If the repo lives on a FUSE-mounted filesystem (NTFS/exFAT external drives
show up as `fuseblk` in `mount`), inotify never delivers file-change events,
so Vite's watcher sees nothing. Run with polling instead:

```bash
CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=300 pnpm dev
```

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
