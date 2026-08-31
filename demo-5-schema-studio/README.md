# Schema Studio

**Write a schema. Get an extractor.**

A split-pane editor. On the left you type BAML class declarations as ordinary text. On the right,
the classes you just declared — and a box where you paste a document and pull it apart with them.

The point is the loop between those two panes. Every time you stop typing, the text on the left is
handed to the **real BAML compiler** and comes back as a real package. Mistakes come back as real
diagnostics — code, message, and a source span — drawn as squiggles under the exact tokens that are
wrong. Then the class that just came into existence is used as the output type of an LLM call.

Nothing in here is a schema-shaped DSL, a JSON-schema builder, or a template. It is BAML, compiled
by BAML, at editing speed.

---

## What is actually happening

This is BEP-066 Scenario 5, `reflect.Package.compile`, wired to a text box.

| In the UI | In `baml_src/studio.baml` |
| --- | --- |
| you stop typing | `reflect.Package.compile({ "schema.baml": source })` |
| red squiggle under a token | `CompilationError.diagnostics` → `code`, `message`, `span` |
| the class list on the right | `pkg.classes()` → `class.Type.fields()` → name, type, `@description` |
| **Extract into Invoice** | `Extract$parse<unreflect(target.as_type())>(...)` |
| *show what the model was asked* | `Extract$render_prompt<unreflect(...)>(doc).text()` |
| **Let the model write it** | `Draft(description)` → text → straight back into `Package.compile` |

The last row is the one worth sitting with. A model writing a schema is just a model writing text;
it gets compiled exactly like text a human typed, and it gets the same squiggles when it is wrong.

## Run it

```bash
pnpm install                                  # from the repo root
pnpm dev                                      # here, or `pnpm --filter demo-5-schema-studio dev` from the root
```

- API: <http://localhost:4450>
- App: <http://localhost:4451>

The backend spends a few seconds loading the BAML runtime before it listens; the UI waits it out and
says `starting` rather than flashing an error.

No code-generation step. The backend boots the BAML runtime straight from `baml_src/` with
`BamlRuntime.initializeRuntime`, so a fresh clone runs as-is.

### Environment

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY` | Extraction and *Let the model write it* call `claude-sonnet-4-5` (required — e.g. `infisical run -- pnpm dev`). |
| `OPENAI_API_KEY` | Same, via `gpt-4o-mini`, when no Anthropic key is set. |
| `PORT` | Backend port (default `4450`). |

The provider is chosen inside BAML, per call, by the `client:` selector in `baml_src/model.baml` —
`env.NAME` is a late-bound reference, so nothing reads the environment until the request happens.

**Compiling never needs a key.** The entire left pane — diagnostics, spans,
squiggles, the class list — is local: the compiler runs in-process on every
pause. Only **Extract into …** and **Let the model write it** call the model,
so a lost network mid-demo costs you two buttons, not the editor loop. There
is no mock mode — the code is deliberately minimal.

---

## The 30-second demo

1. **Open it.** Freight invoice schema on the left, two classes on the right. Point at the pill in
   the top-right: `compiled in 89ms`. Say: *that is the whole BAML compiler, not a linter.*

2. **Break it.** Delete the `float` from `total`. Wait a beat.
   → Red squiggle under `total`, and in the rail: `E0010  invalid syntax: field 'total' is missing a
   type annotation  schema.baml:6:3`. Click the diagnostic; the cursor jumps to the span.
   Say: *that is `E0010` from the compiler itself. Same code, same message, same span you would get
   from `baml check`.*

3. **Fix it and add a field.** Type ` float` back, then add `paid bool` on a new line.
   → It goes green, and `paid bool` appears in the class on the right the moment it compiles.

4. **Extract.** Switch to the **Extract** tab (or click the `Invoice` card). The invoice text is
   already pasted. Hit **Extract into Invoice**.
   → A table: vendor, invoice number, date, currency, total, and the line items — each one parsed
   into a `LineItem` that did not exist a minute ago.

5. **Show what the model saw.** Click *show what the model was asked*.
   → The rendered prompt, with `ctx.output_format` generated from the runtime class — including the
   `@description` on `issued_on`. Say: *the LLM's output format came from a type the compiler minted
   at runtime. Nothing here was declared ahead of time.*

6. **The kicker.** Hit **Let the model write it**, describe something — *"a purchase order: vendor,
   PO number, ship date, ordered items"*. The model's text lands in the editor and compiles like
   anything else. If it made a mistake, you get a squiggle.

Pick the **A schema with mistakes** preset if you want two errors on screen without typing.

---

## The latency story

The headline is that a full compile is cheap enough to sit inside a keystroke loop. Measured on this
machine, steady state:

```
~22 ms per compile   (first call ~50 ms)    release-built addon — the current setup
~95 ms per compile   (first call ~130 ms)   debug-built addon (pnpm build:debug)
```

Which one you see depends on how the bridge was built; the root README's recipe
(`pnpm build:napi-release && pnpm build:copy-native-dts`) gives you the first row. Either way it
stays inside the editor's 220 ms debounce, so the loop feels the same; the release build is just
a better number to say out loud.

That is `reflect.Package.compile` alone, timed inside the BAML program with `baml.time.Instant`
(`Compilation.micros`), not the HTTP round trip. The chart at the bottom-left plots every compile of
the session live, so the number on screen during a demo is always the number that just happened.

**One caveat worth being straight about:**

**Compile cost is essentially constant in the size of your schema.** A one-line class and a
   hundred-line one land within noise of each other; the fixed cost is standing up the package
   against the host image. Good news for the demo, and the reason the loop stays smooth as the
   editor fills up.

Two engineering details keep the loop honest under fast typing:

- The backend runs **one compile at a time, newest source wins** (`LatestOnly` in `backend/src/baml.ts`).
  A burst of keystrokes never queues up stale answers behind each other.
- The frontend tags each request with a revision and drops out-of-order responses.

---

## Layout

```
baml_src/
  studio.baml     the compile / extract / draft entry points — this is the demo
  model.baml      the two LLM functions (generic Extract<T>, and Draft)
backend/src/
  index.ts        express routes
  baml.ts         runtime boot + single-flight compile queue
  spans.ts        BAML byte-offset spans → editor line/column
frontend/src/
  App.tsx         the debounced compile loop
  components/     Editor (CodeMirror 6), DiagnosticsRail, PackagePanel, ExtractPanel, LatencyStrip
  lib/            wire types, BAML syntax highlighting, presets
```

CodeMirror 6 rather than Monaco: it is plain ESM, embeds into Vite with no worker plumbing, and
`@codemirror/lint` takes externally-supplied diagnostics directly — which is exactly what we have,
since the authority on this document is a compiler on the other side of an HTTP call.

### Notes on the BAML

- **Spans are UTF-8 byte offsets** (`reflect.Span { file, start, end }`) with no line/column and
  no severity. `backend/src/spans.ts` converts; severity is inferred from which channel the
  diagnostic arrived on (`CompilationError.diagnostics` = errors, `pkg.diagnostics()` = warnings).
- **`pkg.classes()` keys are package-absolute** (`root.Invoice`), and each class gets a `Foo$stream`
  partial twin. `studio.baml` filters the twins and unqualifies the names.
- **`compile` is declared `throws unknown`**, so the catch needs a `_ => throw e` arm even though
  `CompilationError` is the only thing you care about.
- LLM functions use the inline `client: "anthropic/..."` shorthand rather than a top-level
  `client X = ...` declaration. The shorthand resolves lazily at call time and works across
  toolchain versions.
- A user-authored schema that declares its own `client` will get a real compiler diagnostic and
  render as a squiggle like any other mistake — which is the correct behaviour, not a crash.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `version skew error` / `Bex is outdated` at import | Rebuild the bridge together with `baml-cli` (root README, Troubleshooting): `pnpm build:napi-release && pnpm build:copy-native-dts` in `baml_language/sdks/typescript/bridge_typescript`. |
| **Extract** fails live with `ai.errors.ParseFailed` | Recognise it by the *shape* of the failure, not the code: the model's reply is well-formed JSON, but its keys are the **document's own labels** (`vendor`, `total`) rather than your schema's field names. That means `ctx.output_format` never reached the model, so the answer had nothing to match. It is a **stale bridge addon** — one built before the `baml-cli` you are running drops the output format when the output type is a runtime-minted class. Rebuild the bridge (row above); compiling and the class list are never affected. Confirm the diagnosis without spending a token: `Fn@spec<unreflect(t)>(...).build_request()` under a current bridge shows your field names in the request body, and a stale one refuses to load the program at all with `Bex is outdated`. |
| Red banner *"The BAML runtime failed to load"* | Same as above. The app degrades gracefully and tells you the error; it does not silently fake results. |
| Compiles report ~95 ms rather than ~22 ms | Expected on a debug-built addon — see [the latency story](#the-latency-story). The release recipe in the root README gets you the faster number. Seconds rather than milliseconds is a different problem: that is a stale addon, rebuild it. |
| *Let the model write it* / Extract fail with a key error | No `ANTHROPIC_API_KEY` in the environment — run via `infisical run -- pnpm dev`. Compiling is unaffected. |
