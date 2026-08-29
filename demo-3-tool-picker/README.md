# Demo 3 — Toggleable Toolbox

A chat-style assistant with a sidebar of tools you can switch on and off: **Calculator**,
**Unit Converter**, **Note Saver**, and **Weather Lookup**. Ask it something, and it picks a
tool and runs it. Turn a tool off, and the assistant genuinely loses the ability to use it —
not because the UI hides a button, but because its runtime type disappears from the set of
tools the model is even allowed to choose from.

This is BEP-066 Scenario 3 (runtime tool unions with mint-identity dispatch) wearing a
product's clothes.

## What's actually happening

Every chat turn, the backend calls one BAML function, `RouteAndDispatch` (see
`baml_src/toolbox.baml`). For each tool that's currently switched on, it mints a runtime
class with `reflect.class.new` (field aliases via `.meta(alias = ...)`, e.g. `from_unit` on
the wire as `"from"`). Only the *enabled* tools' classes get folded into a runtime union with
`reflect.union.new` — a disabled tool's class is never constructed in the first place, so
it's not merely hidden from the union, it doesn't exist yet.

The model's response is parsed into that exact union type
(`PickAction$parse<unreflect(action_t)>` in mock mode, or the full
`PickAction<unreflect(action_t)>` call against a live model). Dispatch is then a real type
check, not a string compare on a `"tool"` field: `action is unreflect(calc_t.as_type())` asks
"is this value's minted type identical to the Calculator class I built a moment ago?" That
identity check is what selects the branch — see the `if / else if` chain at the bottom of
`RouteAndDispatch`.

BAML hands back which tool matched, its parsed arguments (as JSON), and the *exact prompt*
that was rendered for this turn. The Express backend then runs the actual tool — arithmetic
evaluation, unit conversion math, a SQLite write, or a simulated weather lookup — and the
result comes back to the chat as a normal message.

There's no code panel in the UI — this is a pure product experience. `baml_src/toolbox.baml`
is short and meant to be read straight from an editor after the wow moment lands: point at
`reflect.class.new`, the `if (weather_on) { member_types.push(...) }` line, and the
`action is unreflect(weather_t.as_type())` dispatch — a dozen lines are doing everything you
just watched happen.

## Running it

From the **repo root** (`reflection-demos/`):

```bash
pnpm install
pnpm dev
```

This starts every demo. To run just this one:

```bash
pnpm --filter demo-3-tool-picker dev
```

Or standalone, from this directory: `pnpm install && pnpm dev`.

- Backend: http://localhost:4430
- Frontend: http://localhost:4431 (proxies `/api` to the backend)

### Env vars

- `ANTHROPIC_API_KEY` — switches the backend into live mode (the assistant actually calls
  Claude Haiku 4.5). Verified working; see [Live mode status](#live-mode-status).
- `MOCK_LLM=1` — force mock mode even if a key is set.
- `PORT` — backend port (default `4430`).

**With no key set, the backend runs in mock mode automatically** — this demo is fully
presentable offline. Live mode is the upgrade, not the requirement.

### Mock mode, honestly

In mock mode, a small keyword router (`backend/src/mockRouter.ts`) stands in for the model.
It only ever considers the tools you've switched **on** — it mirrors what a real,
schema-constrained model actually experiences: it doesn't "see" a disabled tool and reject
it, it never receives that tool's schema to begin with. The router's job stops at "which
tool, with what plausible arguments"; the resulting JSON is then handed to the real
`PickAction$parse<T>` companion, so the actual reflection/parsing machinery runs on every
turn, mock or live.

What the stand-in router understands, so you can improvise on stage:

- **Calculator** — symbols (`12 * (7 + 5)`) and words alike (`12 times (7 plus 5)`,
  `100 divided by 4`, `6 x 7`). It only proposes an expression that actually evaluates, so
  arithmetic-looking prose doesn't produce a broken card.
- **Unit Converter** — `convert 10 km to miles`, `70 kg in pounds`,
  `how many pounds is 70 kg`, `20 celsius in fahrenheit`.
- **Note Saver** — `remember to …`, `note that …`, `remind me to …`, `jot down …`.
- **Weather** — `weather` / `forecast` / `humidity` plus a city in any casing
  (`weather in tokyo` and `What's the weather like in New York?` both work). With no city
  it looks up "your area".

Tools are scored, not first-match: an explicit note/weather/conversion trigger outranks the
broad calculator matcher, so "remember to buy 3 apples plus 2 pears" saves a note. Dispatch
therefore doesn't depend on the order you happened to toggle the sidebar switches in.

## Regenerating the BAML client

```bash
pnpm run baml:generate
```

Generation drops a `.gitignore` containing `*` into `backend/baml_sdk/` every time; delete
it afterwards, or the generated client can't be committed. Regenerate whenever `baml_src/`
changes — and whenever `baml-cli` is rebuilt, since client and bridge addon have to stay a
matched pair ([Live mode status](#live-mode-status)).

Runs `baml-dev generate` (the locally built canary `baml-cli`, per repo convention — see
`~/.baml/bin/baml-dev`) against `baml_src/`, per the `[generator.node]` block in `baml.toml`.
The generated client lands at `backend/baml_sdk/` and is committed so the demo runs without a
generation step.

## BAML notes specific to this demo

- **`reflect.Type` is the current spelling**, per baml
  [#4543](https://github.com/BoundaryML/baml/pull/4543), which made `reflect` a root package
  and retired the bare `type.` shorthand. So it's `reflect.Type.of<string>()` and
  `let member_types: reflect.Type[]`. The old `type.of<T>()` / `type[]` forms no longer
  compile. For working syntax, trust the scenario tests in
  `baml_language/crates/baml_tests/tests/` (`reflect_*.rs`, `runtime_*.rs`) —
  `thoughts/antonio/bep066_demo.baml` has fallen behind.
- **Inline `client: "anthropic/claude-haiku-4-5"` shorthand, not a top-level `client`
  declaration.** A style choice, not a workaround — it resolves lazily at call time instead
  of eagerly at module load. Both forms work.
- `reflect.class.get_field<T>(obj, name)` isn't used here (per repo convention: it's current;
  the nicer `reflect.class.instance_from(obj)` wrapper was landing separately). This demo
  sidesteps both — the dispatching BAML function only needs to identify *which* tool matched,
  not read its fields itself, so it hands the whole matched value to
  `baml.json.encode(action)` and the args get parsed back out on the TypeScript side.
- `RouteAndDispatch` is deliberately **not generic**: the union is built from a runtime
  argument (which tools are enabled), not a compile-time type parameter, so the function
  TypeScript calls is a plain `(bool, bool, bool, bool, string, string | null) => ToolPick` —
  no `$types` plumbing needed on the call site.

## Live mode status

**Both modes green.** Verified end-to-end 2026-08-24 against canary `a50430fba` — `baml-cli`
and the `@boundaryml/baml-bridge` native addon rebuilt as a matched pair, `baml_src/` on the
[#4543](https://github.com/BoundaryML/baml/pull/4543) `reflect.Type` spellings, client
regenerated. Live runs picked the right tool for all four tool types, with a one-tool
toolbox and with all four on, and aliases round-tripped correctly (`from`/`to`/`city` on the
wire, `from_unit`/`to_unit`/`location` back out of `baml.json.encode`).

**Both halves of the toolchain have to move together.** They are separately built artifacts
that both report version `0.17.0`, so the version string tells you nothing — only the build
timestamps do. If you rebuild `baml-cli`, regenerate this client *and* rebuild the bridge.
Skewing them fails in two different ways, both listed under
[Troubleshooting](#troubleshooting).

### "I don't have a tool for that" is a real answer, not an error

When you switch a tool off, the runtime union genuinely loses that member — so on a request
only that tool could satisfy, there is no value the model is *able* to return. It says so in
prose, the runner spends its retry and raises `ai.errors.ParseFailed`. That is this demo's
`no_match` beat arriving live, and `backend/src/server.ts` (`declinedForLackOfTool`) turns it
into the same "I don't have a tool for that right now. Enabled: …" reply mock mode gives,
logging the model's own words server-side.

Deliberately narrow: a `ParseFailed` whose raw output contains a JSON object is *not*
treated as a refusal. There the model did answer in schema and the runtime still couldn't
read it — a toolchain regression, which stays loud as `status: "error"` rather than
masquerading as "no tool for that".

## Troubleshooting

- **`Failed to deserialize BAML bytecode: Unexpected variant tag: N` at import** → the
  generated client in `backend/baml_sdk/` is *newer* than the installed bridge addon.
  Rebuild the bridge (`pnpm build:debug` in
  `baml_language/sdks/typescript/bridge_typescript`).
- **Every live turn fails `ai.errors.ParseFailed` at
  `<builtin>/ai/runner.baml … in ai.Agent.Runner<Out>.run`, while mock mode is fine** → the
  bridge addon is *older* than the client, from before baml
  [#4501](https://github.com/BoundaryML/baml/pull/4501) /
  [#4516](https://github.com/BoundaryML/baml/pull/4516) ("carry runtime type definitions /
  minted type identity through interface dispatch"). A live call reaches the model through
  `ai.Agent implements Runner<Out>`; on that older runtime a reflected `Out` lost its
  definition crossing that boundary, so the runner's `_parses` check never matched. Mock
  mode is unaffected because `PickAction$parse<T>` doesn't cross the dispatch. Tell-tale:
  the `runner.baml` line numbers in the trace don't line up with the current source. Fix by
  rebuilding the bridge. (Hit and fixed on 2026-08-24.)
- **`pnpm install` silently un-fixes the bridge.** The dependency is `link:`, not `file:` —
  `file:` makes pnpm *copy* the native addon into its store, where it then goes stale
  invisibly no matter how often you rebuild the bridge directory. Keep it `link:` so
  `node_modules/@boundaryml/baml-bridge` stays a symlink.
- **`version skew error` at import** (`baml_sdk was generated using BAML toolchain X, but
  @boundaryml/baml-bridge is installed at Y`) → rebuild the bridge: `pnpm build:debug` in
  `baml_language/sdks/typescript/bridge_typescript`.
- If `~/.baml/bin/baml-dev` reports its binary is missing, build it with
  `cd vendor/baml/baml_language && cargo build -p baml_cli`
  — only if no one else is already mid-build.
- `/api/chat` is resilient to either of the above: `backend/src/server.ts` lazy-loads
  `../baml_sdk/index.js` only inside the `/api/chat` handler (not at module top level), so a
  broken bridge degrades that one route to a normal `{ status: "error" }` JSON reply instead
  of crashing the process — `/api/tools`, `/api/mode`, and `/api/notes` stay up regardless.

Verified end-to-end through the real bridge on 2026-08-24 — every step of the 30-second
script below, in **both** mock and live mode, including the disabled-weather → `no_match`
path and a persisted note:

```bash
MOCK_LLM=1 pnpm run dev:backend &
curl -X POST localhost:4430/api/chat -H 'Content-Type: application/json' \
  -d '{"message":"what is 12 * (3 + 4)?","enabled":["calculator","unit_converter","note_saver","weather"]}'
# {"status":"matched","reply":"12 * (3 + 4) = 84", ...}
```

The BAML side was also verified directly against the compiler, independent of the bridge
(`baml-dev check` passes):

```bash
baml-dev run --output-format json \
  -e 'RouteAndDispatch(true, true, true, false, "weather in Lisbon", "{\"city\": \"Lisbon\"}")'
# → prompt_preview lists exactly 3 schemas (calculator / unit_converter / note_saver) —
#   WeatherLookup is genuinely absent, not merely filtered from display, when weather_on = false
```

## The tools

| Tool | What it does | Persistence |
|---|---|---|
| Calculator | Evaluates `+ - * / ( )` arithmetic via a small hand-rolled parser (not `eval`) | — |
| Unit Converter | Length (km/mi/m/ft/in/yd), weight (kg/lb/g/oz), temperature (C/F/K) | — |
| Note Saver | Saves a titled note | SQLite (`backend/notes.sqlite3`) |
| Weather Lookup | Simulated conditions, deterministic per city — no external API/key | — |

## 30-second demo script

1. All four tools are on. Ask: **"What's 12 times (7 plus 5)?"** → a calculator card appears
   with the answer.
2. Ask: **"Convert 10 km to miles"** → a conversion card.
3. In the sidebar, **switch Weather Lookup off**.
4. Ask: **"What's the weather like in Tokyo?"** → the assistant says it doesn't have a tool
   for that right now, and lists what's enabled instead.
5. Switch Weather back **on**, ask the same question again → it works. The union changed;
   nothing else did.
6. Ask: **"Remember to send the invoice on Friday"** → saved-note card; expand "Saved notes"
   at the bottom to see it persisted.
7. *Now* open `baml_src/toolbox.baml` in an editor and walk through it — `reflect.class.new`
   per tool, the `if (tool_on) { member_types.push(...) }` gate, `reflect.union.new`, and the
   `action is unreflect(...)` dispatch chain. That's the whole mechanism.
