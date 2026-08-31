# Presenter script — Schema Studio

Roughly 3 minutes. Run from the repo root with the key injected
(`infisical run -- pnpm dev`), open http://localhost:4451, and check the
top-right pill says `compiled in ~20ms` before you start. Live model calls
(Extract, and *Let the model write it*) go to `claude-sonnet-4-5` and take a
few seconds each — everything else is local and instant.

The one-sentence frame, if you only get one sentence:

> Write a schema. Get an extractor. The compiler is inside the keystroke loop.

Name the incumbent first, or this reads as a JSON-schema form builder:

> "Every extraction product has a schema builder — a form, a DSL, a JSON-schema
> editor. This is none of those. The left pane goes to the real BAML compiler on
> every pause, and the class it mints becomes the model's output type."

---

## Beat 1 — the loop (20s)

The freight-invoice schema is preloaded; two class cards sit on the right —
`Invoice` and the `LineItem` it nests.
Point at the pill: **compiled in ~20 ms**.

> "That's the whole compiler, not a linter. Every pause in typing is a full
> compile — the cards on the right are read off the compiled package."

The latency strip (bottom-left) plots every compile of the session — the
number you quote is always the one that just happened.

## Beat 2 — break it (25s)

Delete ` float` from the `total` field. Wait a beat.

> "Red squiggle, and in the rail: `E0010`, with a message and a span. Click it —
> the cursor jumps to the exact token. Same code, same message, same span
> `baml check` would print in CI."

Fix it. Add `paid bool?` on a new line — it appears on the class card the
moment it compiles. (Optional on purpose: the invoice never says whether it
was paid, and the extraction prompt tells the model not to guess — a required
`bool` would force it to fabricate or fail. `bool?` parses the honest null.)

## Beat 3 — extract through the class you just edited (30s)

Extract tab; the invoice text is pre-pasted. Hit **Extract into Invoice**.

> "The output type of that model call is the class as of two seconds ago —
> `paid` included. Nothing was regenerated, nothing redeployed."

The filled table renders per-field, typed — line items parsed into `LineItem`
objects that didn't exist a minute ago, and `paid` empty because the document
doesn't say and the field is optional. That's the parser being honest, not a
miss.

## Beat 4 — show what the model saw (20s)

Click *show what the model was asked*.

> "The output format in this prompt was rendered from the runtime type.
> The `@description` you see came off the field metadata. Nothing here was
> declared ahead of time."

## Beat 5 — the kicker: the model writes the schema (40s)

Hit **Let the model write it** and click the **clinical visit note** chip —
a deliberate switch of domain, so nobody thinks the invoice was special. The
model's text lands in the editor **and compiles like anything a human
typed**. If it made a mistake, it gets a squiggle like anyone else.

> "A model writing a schema is just a model writing text. It goes through the
> same compiler, gets the same diagnostics — and then you can extract through
> the class it wrote."

Close the loop: Extract tab → click the **Clinical visit note** sample-doc
chip (it fills only the document, never your schema) → Extract. A chart note,
pulled apart by a schema the model wrote a moment ago. The Draft prompt
steers toward optionals for maybe-absent fields, so audience-shouted
descriptions extract cleanly too — nested classes included.

## The code reveal (30s, in your editor)

`baml_src/studio.baml`, `RunExtraction` — it is four lines:

```baml
let pkg = reflect.Package.compile({ "schema.baml": source });
let target = pkg.get_class(record) ?? throw `the package has no class named ${record}`;
type T = unreflect(target.as_type());
```

then `Extract<T>(document)`.

> "Editor text → compiled package → class → type → generic LLM call. That's the
> entire feature."

---

## Reset between runs

Reload the page — the editor reseeds with the invoice preset. The **A schema
with mistakes** preset puts two errors on screen without typing, if you want
to start from the diagnostics beat.

## If something goes wrong

- **The pill reads higher than ~20 ms** — machine-dependent, and fine: anything
  inside the editor's 220 ms debounce feels identical. Seconds instead of
  milliseconds means a version-skewed bridge — match versions via `BAML_VERSION`.
- **Extract/Draft fail with a key error** — the backend has no
  `ANTHROPIC_API_KEY`; relaunch via `infisical run -- pnpm dev`. Compiling
  never needs a key, so the editor loop keeps working regardless.
