# Demo 7 — BAML Notebook

**BEP-066 Scenario 7: Sessions.** A Jupyter-style notebook where every cell is BAML,
evaluated in a live `reflect.Session` that has the running service's package mounted as
`app`. State persists across cells. Every browser tab gets its own session.

The wow: a full REPL over production code, with per-user isolation and compile-before-execute
containment — and the entire backend is **two BAML functions**.

```baml
function OpenNotebook() -> reflect.Session throws unknown {
    reflect.Session.new(packages = { "app": reflect.Package.current() })
}

function RunCell(notebook: reflect.Session, source: string) -> unknown throws unknown {
    notebook.eval(source)
}
```

That is `baml_src/notebook.baml` in full — seven lines of code. Everything else in `baml_src/` is the
application being explored, not notebook machinery.

---

## Run it

```bash
pnpm install          # from the repo root
pnpm dev              # or: pnpm --filter demo-7-notebook dev
```

- frontend → <http://localhost:4471>
- backend  → <http://localhost:4470> (`/api/health` reports the bridge version)

Only `app.Assess` talks to the network (one LLM call); every other cell is pure.

### Env vars

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for the one LLM function, `app.Assess` (e.g. `infisical run -- pnpm dev`); every other cell is pure and needs nothing. `app.AssessPrompt` renders the prompt without calling. |
| `PORT` | Backend port (default `4470`). |

---

## What to look at

The seed notebook walks a reader through eight sections. In order:

1. **The production package is already here.** `app.LoadTickets()`, `app.Headline(...)` —
   the same functions the service calls, reflected into the session.
2. **Declare a type, mid-session.** `class Digest { … }` is minted *inside this session*.
   The identical declaration in another tab is a different type, not a shared one.
3. **Build one, using the app.** The class from cell 2 is still in scope, and so is `app`.
4. **State persists.** Read a field off the value the previous cell bound.
5. **This notebook is yours alone.** A counter you can run repeatedly, then compare against
   a second tab.
6. **A cell that doesn't compile.** The compiler's real diagnostics — code, message and the
   submission they came from — appear under the cell, and the session is untouched.
7. **A cell that throws halfway.** Containment is a committed prefix, not a rollback:
   `kept` survives, `never` was never bound.
8. **Scratch space.** Including `app.AssessPrompt(...)`, which shows the rendered LLM prompt.

---

## The engineering that isn't visible

**Session lifecycle.** `backend/src/notebooks.ts` is the whole of it.

- **Created** on the tab's first request. The `reflect.Session` crosses the bridge as an
  opaque handle and is held in a server-side `Map` keyed by notebook id.
- **Addressed** per tab. The id lives in `sessionStorage`, which is per-tab by definition,
  so *Open a second notebook* (or any new tab) mints a second, independent session.
- **Serialised.** A `Session` permits one active eval and throws `SessionBusy` otherwise, so
  each notebook has a promise chain; a double-click queues rather than fails.
- **Dropped** on `pagehide` via `navigator.sendBeacon`, and by an idle sweeper after 30
  minutes. Dropping the handle is the whole of closing a notebook — the committed image,
  the session's declarations and the mounted package become garbage with nothing holding
  them. The goodbye is held for 15 seconds before the handle actually goes, because
  `pagehide` fires on a reload too: the returning tab reclaims its own session instead of
  racing the beacon for it. It stops counting as open the moment the beacon lands.
- **Capped** at 200 live notebooks, evicting the least recently used.

**No generated client.** `backend/src/baml.ts` compiles `baml_src/` in process at boot with
`BamlRuntime.initializeRuntime(dir, files)`. That skips codegen entirely and, usefully,
skips the embedded-bytecode version gate that a generated `baml_sdk` trips when the native
addon and the CLI disagree. `pnpm baml:generate` runs `scripts/check-baml.mjs`, which
compiles the package and evaluates three cells as a smoke test.

**Error taxonomy.** `Session.eval` throws exactly three things, and the UI treats them
differently:

| Thrown | Shown as | Meaning |
| --- | --- | --- |
| `CompilationError` | red panel with the diagnostic list | nothing ran; the session is unchanged |
| `EvaluationError` | red panel, "threw" | statements before the throw are committed |
| `SessionBusy` | amber panel | another eval holds the lease |

`EvaluationError` carries no detail — `Session.eval` catches every application throw and
rethrows a fixed `"session evaluation failed"`, so the thrown value really is gone by the
time it crosses the bridge. The UI says what is true instead of inventing a cause.

Panics (index out of range, and friends) are *not* flattened into `EvaluationError`. They
keep their own class and their detail, and the backend renders them as one line —
`IndexOutOfBounds: index=9, length=3` — followed by the reader's own `$submission_N.baml`
frames. Finding those frames means reading two places: the bridge puts a rendered stack on
`bamlTrace`, but an `SdkPanic` renders its traceback into the thrown value's `message`
instead.

**Name demangling.** Session declarations lower to `__baml_session_7_Digest`; diagnostics
quote the lowered spelling. The backend rewrites it back to `Digest` so a reader sees the
name they typed.

---

## Layout

```
baml_src/
  app.baml        the production package — tickets, urgency rules, formatting
  assess.baml     the one LLM function, plus AssessPrompt (renders without calling)
  notebook.baml   the notebook: two functions, seven lines
backend/src/
  baml.ts         bridge boundary: compile at boot, two calls, error taxonomy
  notebooks.ts    session registry, per-session queue, TTL sweeper
  seed.ts         the guided notebook a new tab opens with
  server.ts       Express routes
frontend/src/
  App.tsx         notebook state, one session per tab
  components/     Editor (highlighted overlay), Note (markdown), Output
  highlight.ts    a small BAML tokenizer
scripts/
  check-baml.mjs  the `baml:generate` smoke test
```

## API

| Route | Purpose |
| --- | --- |
| `POST /api/notebooks` | open a session, return its id and the seed notebook |
| `GET /api/notebooks/:id` | reattach after a reload (404 once it is gone) |
| `POST /api/notebooks/:id/run` | `{ source }` → `{ outcome, elapsedMs, live }` |
| `POST /api/notebooks/:id/restart` | drop the session, mint a fresh one under the same id |
| `POST /api/notebooks/:id/close` | release after a 15s hold (used by `sendBeacon` on tab close) |
| `GET /api/notebooks` | `{ live }` — how many sessions are open right now |
| `GET /api/health` | bridge version, compiled files, LLM mode |

---

## Troubleshooting

- **`version skew error` at import** → the CLI toolchain and the npm bridge must be the
  same version (`BAML_VERSION`): `baml toolchain use "$(cat ../BAML_VERSION)"`, `pnpm install`.
- **`baml_src/ failed to compile`, no diagnostics** → the embedding API reports compile
  failure as a bare `Bex is outdated` / `BamlClientError` with no detail. Run
  `baml check` in `baml_src/` to see the real diagnostics.
- **Cells take seconds instead of a fraction of one** → the installed native addon is
  stale. A current release-built addon (canary a50430fba) runs a cell in roughly 40–65 ms,
  a debug-built one (`pnpm build:debug`) in 120–175 ms — whatever the cell does, since the
  fixed cost is the submission compile, not the work.

### Known engine rough edges (canary a50430fba, bridge 0.17.0)

All of these are reachable from the scratch cell; none is on the guided path. They share
one cause: a value whose *class* lives in the mounted package keeps its type only as far
as the first binding.

- **Reading a field off a bound instance.** `let t = app.GetTicket("SUP-1041")` then
  `t.subject` panics with `VM internal error: type error: expected map, got instance`.
  Use `reflect.class.get_field<string>(t, "subject")`, which works.
  <!-- The `reflect.class.instance_from` wrapper was superseded and removed (baml #4466); the free function is the lasting spelling. -->
- **Reading a field off an instance inline.** `app.GetTicket("SUP-1041").subject` fails
  earlier still, as `internal compiler error: MIR failed to resolve field access .subject
  against class definition 'Ticket'`. Same workaround.
- **Re-binding an array.** `let v = app.LoadTickets()` then `let w = v` then `w.length()`
  panics with `expected array, got any`. One binding deep is fine (see below).

Passing a bound instance straight to another `app` function — `app.Headline(t)` — works,
which is why the guided notebook is built out of calls rather than field reads.

Fixed since the previous build: methods on a *singly* bound mounted-package array.
`let v = app.LoadTickets()` then `v.length()`, `v[0]`, `v.map(…)`, `v.filter(…)` and
`v.find(…)` all work now; they used to panic with `expected array, got any`.
