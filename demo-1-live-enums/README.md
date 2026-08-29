# Demo 1 — Live Triage

**BEP-066 Scenario 1: a runtime enum through an LLM call.**

A support-ticket inbox. The left panel lists incoming tickets. The right
panel is the team's category list — and it's just data: rows in SQLite that
anyone can add, rename, or delete from the UI. There is no `enum Category { ... }`
declared in `baml_src/`. Every time triage runs, the backend mints a brand
new enum *type* from whatever rows exist right now and hands it to the
classifier as a generic type argument. Edit the categories, hit **Run
Triage**, and the model is reasoning over the new list on the very next
call — no code change, no redeploy.

The whole trick is `baml_src/triage.baml`, specifically `BuildCategoryType`:

```baml
function BuildCategoryType(categories: CategoryInput[]) -> reflect.enum.Type throws reflect.errors.CompilationError {
  let rows: (string | reflect.enum.Value)[] = []
  for (let c in categories) {
    rows.push(reflect.enum.value("CAT_" + c.id.to_string(), alias = c.name, description = c.description))
  }
  reflect.enum.new("Category", rows)
}
```

(The variant name is a synthetic `CAT_<id>` — a database id is always a
valid identifier, unlike a category name someone typed into a form, e.g.
"Shipping & Delivery". `alias` is what actually goes on the wire, so that's
the string the model reads and writes; the backend maps `CAT_<id>` back to
the display name afterward, since it already has the category rows.)

...and `ClassifyTicket`, which binds the generic `Classify<T>` function to
that freshly-minted type with `unreflect`:

```baml
function ClassifyTicket(ticket_text: string, categories: CategoryInput[]) -> string {
  let category_t = BuildCategoryType(categories)
  let picked = Classify<unreflect(category_t.as_type())>(ticket_text)
  reflect.enum.get_value(picked)
}
```

Open `baml_src/triage.baml` in an editor during the demo — it's five short
declarations, and that's the entire feature.

## Running it

From this directory:

```bash
pnpm install
pnpm run dev
```

`backend/baml_sdk/` is committed, so there is no generation step. Re-run
`pnpm run baml:generate` only after editing `baml_src/` — and only against a
`baml-cli` built from the same commit as the bridge addon, or the client
won't load (see [Toolchain skew](#toolchain-skew)).

- Backend: http://localhost:4410
- Frontend: http://localhost:4411 (proxies `/api` to the backend)

Or from the repo root: `pnpm install && pnpm dev` runs every demo, this one
included.

### Live mode vs. mock mode

- Set `ANTHROPIC_API_KEY` in the environment and the backend calls
  `claude-haiku-4-5` for real. `Classify<T>` uses the inline client
  shorthand — `client: "anthropic/claude-haiku-4-5"` — rather than a
  top-level `client X = anthropic.AnthropicClient.new(...)` declaration;
  it's a style choice, both work.
- With no key — or `MOCK_LLM=1` set explicitly — the backend guesses a
  category with a small keyword scorer (`backend/src/mockClassify.ts`) that
  reads the *live* category names/descriptions, then feeds that guess (the
  category's display name, e.g. `"Bug Report"` — exactly what a real model
  would produce, since that's the variant's alias) through
  `Classify$parse<unreflect(...)>` (`ClassifyTicketFromCompletion` in
  `triage.baml`). Mock mode still exercises the real BAML enum parser
  against the real runtime type — it only skips the network call. Verified
  end to end: a classify call through the generated SDK correctly parses
  `"Bug Report"` and `"Shipping & Delivery"` (both invalid as bare
  identifiers) back to their category via the `CAT_<id>` / alias split
  above, and a category *added during the demo* is picked on the very next
  run.

The mock scorer is tf-idf over each category's own name and description
(plus a small topical synonym table), not a switch on category names — so
renaming "Bug Report" to "Technical Issue" keeps its tickets, because the
meaning lives in the description the scorer reads at request time.

The mode badge in the top-right corner of the UI shows which one is active.

### Resetting the demo

Classifications, added tickets, and category edits persist in
`backend/data/triage.db` (gitignored). The **Reset demo** button in the UI
header (or `POST /api/reset`) restores the pristine inbox the presenter
script assumes: two starter categories (Billing, Bug Report) and three
*unclassified* tickets, one of which — the dark-mode request — fits neither
category, so the natural opening move is adding a "Feature Request"
category live and re-running triage.

## What's in here

- `baml_src/triage.baml` — `CategoryInput` (`id`, `name`, `description`),
  the generic `Classify<T>` function (with its inline client),
  `BuildCategoryType` (the reflection call), and the two entry points the
  backend calls (`ClassifyTicket` for live, `ClassifyTicketFromCompletion`
  for mock).
- `backend/` — Express + better-sqlite3. Seeds 3 tickets and 2 starter
  categories (Billing, Bug Report) on first run; the third ticket (a dark
  mode request) deliberately fits neither category.
- `frontend/` — React + Vite. Ticket inbox (left, with a compose form to
  add tickets mid-demo) and category editor (right); a "Run Triage" button
  reclassifies every ticket against the current category list, and "Reset
  demo" restores the seed state.

## 30-second presenter script

1. **Open the app.** Point at the inbox: "Three support tickets, all
   unclassified." Point at the category list on the right: "Two categories
   — and they aren't code, they're rows in a database."
2. **Click "Run Triage."** The billing ticket and the crash ticket get the
   right badges — and the dark-mode request gets shoehorned into the
   nearest bucket, because the enum is exhaustive: the model *must* pick a
   variant. "That misfit is the interesting one."
3. **Add a category.** "Feature Request" with a one-line description.
   Don't touch any code.
4. **Click "Run Triage" again.** The dark-mode ticket moves to the
   category you just created. "The model has never seen this category
   before. Nobody redeployed anything."
5. **Keep going.** Type a new ticket into the compose form — a GDPR data
   request, an outage report, whatever the audience shouts out — classify
   it, and add whatever category it deserves. Rename "Bug Report" to
   "Technical Issue" and re-run: its tickets follow the meaning, not the
   name.
6. **Land it.** Open `baml_src/triage.baml`. "This is the entire feature.
   `BuildCategoryType` turns whatever rows are in the database into a real
   enum type, right now, and `Classify` is generic over it. The category
   list is data. The type system caught up to it." (The "Reset demo"
   button puts everything back for the next audience.)

## Status (2026-08-29)

**Both modes are presenter-ready**, verified against the pinned canary commit
(repo-root `BAML_COMMIT`, originally verified on `a50430fba`) with the
`baml-cli` and `@boundaryml/baml-bridge` addon rebuilt as a matching pair.

- Mock mode: all seed tickets classify; renaming a category, adding one, and
  composing new tickets are all picked up on the next run.
- Live mode (`claude-haiku-4-5`): same results. The model correctly places
  tickets into a category *renamed* mid-demo ("Bug Report" → "Technical
  Issue") and into one *added* mid-demo — names that exist nowhere in
  `baml_src/`.

The two modes agree ticket for ticket on the seed data, so the story you tell
offline is the story the model tells live.

## Troubleshooting

- **`baml-dev: ... not built`** — the demo depends on the local canary
  build at `vendor/baml/baml_language/target/debug/baml-cli` (via
  `scripts/baml-dev`). If it's missing, run `./scripts/setup-baml.sh` from
  the repo root — check first whether another agent owns that checkout's
  build lock.
- **Classification fails but the rest of the app works.** That's by design:
  the backend lazy-loads the generated SDK on the first classify request, so
  a broken toolchain never takes down ticket/category CRUD. `Run Triage`
  reports the failure in the error banner rather than silently doing nothing.

### Toolchain skew

The symptoms below all mean the same thing: the native
`@boundaryml/baml-bridge` addon and the `baml-cli` that generated
`backend/baml_sdk/` came from different builds. They must be rebuilt as a
pair, and the client regenerated afterwards.

- **`BAML startup failed: version skew error`** or **`BamlClientError: Bex is
  outdated`** at SDK import — the plain, self-announcing version of the
  problem.
- **`Failed to deserialize BAML bytecode: Unexpected variant tag: N`** at
  import — a client generated by a *newer* CLI than the addon can load. Note
  that both sides still report version `0.17.0`, so nothing warns you up
  front; the SDK simply fails to load and the whole demo stops working:
  ```
  Error: BAML startup failed: generated SDK bytecode could not be loaded.
  `baml_sdk` generated using BAML toolchain 0.17.0, could not be loaded by
  @boundaryml/baml-bridge 0.17.0: Failed to deserialize BAML bytecode:
  Unexpected variant tag: 8
  ```
- **`internal error: entered unreachable code: reflected enum
  user.$dyn.0.Category must be loaded`** (a 502 from `/api/tickets/:id/classify`,
  while mock mode keeps working) — an addon older than the reflection fix
  ["runtime type definitions through dispatch" (#4501)][4501]. Every real LLM
  call routes the output type through `ai.Agent.Runner<Out>.run`, i.e. through
  interface dispatch; before that fix a *reflected* output type lost its
  definitions on the way. Mock mode is unaffected because `Classify$parse`
  never crosses that boundary — which is exactly the shape of the bug to look
  for: live broken, mock fine.

Rebuild with `pnpm build:debug` in `bridge_typescript`, then `pnpm run
baml:generate` here. Generation drops a `.gitignore` containing `*` into
`backend/baml_sdk/` — delete it, or the generated client stops being
committed. Also check that `node_modules/@boundaryml/baml-bridge` is a
*symlink* to the bridge directory: `package.json` uses a `link:` dependency
for this reason, because a `file:` dependency makes pnpm copy the addon into
its store, where a later rebuild is invisible.

[4501]: https://github.com/BoundaryML/baml/pull/4501
