# Demo 6 — API Explorer (Self-Describing API)

An Express backend that exposes exactly **two** generic HTTP routes and a React
console that renders one card per function — forms, types, and error shapes
included — with zero code written for any specific function. Every bit of
that comes from BAML reflecting on itself at runtime (BEP-066, Scenario 6:
`Package.current()` + `reflect.call_any`).

## What it shows

`baml_src/functions.baml` defines six ordinary BAML functions: three text
utilities, a math helper, a small data transformer, and one LLM function.
Nothing about them is special or reflection-aware — they're just functions.

`baml_src/reflection.baml` defines two more:

- **`ListFunctions()`** calls `reflect.Package.current().functions()` to
  enumerate every function in the package, then `reflect.signature(f)` on
  each one for its argument names, types, return type, and throws type. It
  also renders each type to JSON Schema (`baml.json.schema`) so the frontend
  has enough to build a form control.
- **`InvokeFunction(name, args)`** looks the function up by name
  (`get_function<baml.AnyFunction>`) and calls it with
  `reflect.call_any(f, args)` — args and results flow as `unknown`, checked
  against the callee's real signature at the call boundary. A bad argument
  comes back as `reflect.InvalidArgumentError`; any other thrown value is
  reflected by its runtime type (`reflect.Type.of_value`) and JSON-encoded
  (`baml.json.encode`) generically, so the UI can show a real error type name
  and payload for a function this dispatcher has never seen before.

  Each value in `args` arrives as a **JSON-encoded string** and is decoded
  against that parameter's *reflected* type, so `text` is sent as `"\"hi\""`,
  not `"hi"`. A value that will not decode is rejected up front — `'tone': not
  a valid Tone` — rather than being passed along as null.

The backend's `GET /api/functions` and `POST /api/invoke` routes call exactly
those two functions and nothing else. **Add a seventh function to
`functions.baml`, restart the backend, and it appears in the console** — new
card, new form, working Invoke button, typed errors — with zero other changes
anywhere in this repo.

## Mock mode (no API key required)

`SummarizeText` is the one LLM function. With `MOCK_LLM=1` (or simply no
`ANTHROPIC_API_KEY` — see below), the backend never calls it directly.
Instead, `backend/src/invoke.ts` calls the compiler-synthesized
`root.SummarizeText$parse` companion — through the *exact same*
`InvokeFunction` dispatcher used for every other function — with a canned
JSON response templated from the request. This is the same
render-prompt/parse-canned-response seam the BAML test suite itself uses; the
`reflection.baml` dispatcher never has to know mock mode exists, because
`$parse` is just another function it can find by name.

Mode selection (`backend/src/server.ts`):

- `MOCK_LLM=1` — always mock, even with a key present (handy for presenting).
- `MOCK_LLM=0` — always live. With no `ANTHROPIC_API_KEY` the backend still
  starts and warns at startup — the five non-LLM functions need no key and keep
  working, and `SummarizeText` comes back as a typed
  `ai.errors.InvalidRequest` saying the key is missing.
- unset (default) — mock unless `ANTHROPIC_API_KEY` is present. **`pnpm dev`
  with zero setup is fully offline-presentable.**

## Running standalone

```bash
cd demo-6-api-explorer
npm install --prefix backend
npm install --prefix frontend
npm run dev          # runs backend + frontend together (needs `concurrently`: npm install first)
```

`backend/src/baml_sdk` is committed and ready to run, so no generate step is
needed to start the demo. Only re-run `baml generate` after editing
`baml_src/` — see [Regenerating the client](#regenerating-the-client).

Backend on `http://localhost:4460`, frontend on `http://localhost:4461`
(proxies `/api` to the backend). For live LLM calls, `export
ANTHROPIC_API_KEY=...` first.

## Try the reflection loop yourself

1. Open `baml_src/functions.baml`.
2. Add a function, e.g.:
   ```baml
   /// Counts the vowels in `text`.
   function CountVowels(text: string) -> int {
     let n = 0
     for (let c in text.to_lower_case()) {
       if c == "a" || c == "e" || c == "i" || c == "o" || c == "u" {
         n += 1
       }
     }
     n
   }
   ```
3. `baml generate` — the bytecode is embedded at generate time, so this
   step is required for a `baml_src` edit to have any effect. See
   [Regenerating the client](#regenerating-the-client).
4. Restart `npm --prefix backend run dev`, refresh the frontend.
5. `CountVowels` is now a card, with a text field and an Invoke button. Check
   `reflection.baml` — nothing changed there.

## Presenter script (30 seconds)

1. **Open the console.** Six cards, each with a form built from the
   function's real signature — required/optional params, types, the throws
   type as a badge.
2. **Click Invoke on `Divide` with `denominator = 0`.** A red panel appears:
   `Thrown DivisionByZeroError` with the real message — the throws channel,
   reflected and rendered generically, not hand-coded per function.
3. **Click Invoke on `SummarizeText`.** It runs like every other card — same
   form, same button — but under the hood the backend replayed a canned
   `$parse` response (note the "mock LLM" badge in the header). No key
   needed.
4. **The reveal:** open `baml_src/reflection.baml`. Two functions,
   ~110 lines, and neither one mentions `Divide`, `SummarizeText`, or any
   other function by name. Add a function to `functions.baml`, restart, and
   it's on the page. That's the whole demo.

## Regenerating the client

`backend/src/baml_sdk` is committed and works as-is — you only need this
section if you edit `baml_src/`. Then:

```bash
baml generate
rm -f backend/src/baml_sdk/.gitignore   # the generator drops an ignore-all file
```

The generator writes a `.gitignore` containing `*` into its own output
directory, which would un-commit the client this repo deliberately ships;
delete it after each run.

The bytecode is embedded at generate time, so restart the backend afterwards.
Verify with `curl localhost:4460/api/health` — `"bridge": true` means the
addon loaded the new bytecode.

**The one rule: the CLI toolchain and the npm `@boundaryml/baml-bridge`
package must be the same version** — the repo-root `BAML_VERSION` pins both
(`baml toolchain use "$(cat ../BAML_VERSION)"`). The CLI writes the bytecode,
the bridge reads it, and the serialization format moves between versions.

## Troubleshooting

- **`Failed to deserialize BAML bytecode: Unexpected variant tag: N` at
  import.** The CLI that generated `baml_sdk` and the bridge addon loading it
  were built from different revisions. Both halves report the same `0.17.0`
  version string, so nothing catches this until the bytecode is actually
  deserialized:

  ```
  `baml_sdk` generated using BAML toolchain 0.17.0, could not be loaded by
  @boundaryml/baml-bridge 0.17.0: Failed to deserialize BAML bytecode:
  Unexpected variant tag: 8
  ```

  Rebuild both halves together (see
  [Regenerating the client](#regenerating-the-client)) and re-run
  `baml generate`. Nothing about this is specific to this demo — a
  four-line BAML package fails identically, and the repo-root `pnpm generate`
  hits every demo at once. The backend lazy-loads `baml_sdk`
  (`backend/src/bamlClient.ts`) specifically so this degrades to a `503` on
  `/api/functions` and `/api/invoke` instead of crashing the whole process —
  `/api/health` still responds and reports `"bridge": false`.
- **`baml: command not found`**: install the published CLI and run
  `baml toolchain use "$(cat ../BAML_VERSION)"`.
- `SummarizeText` uses the inline `client: "anthropic/claude-haiku-4-5"`
  shorthand, which resolves lazily at call time and reads
  `ANTHROPIC_API_KEY` from the environment. (Earlier in development a
  stale-bridge version-skew build made top-level
  `client X = anthropic.AnthropicClient.new(...)` declarations fail here
  too; that was the same bridge issue above, fixed 2026-08-17 ~14:22 and
  reverified working — the inline form here is a style choice, not a
  workaround.)

## Layout

```
baml_src/
  functions.baml     the six demo functions — edit this to add more
  reflection.baml     the two-function reflection layer — never edit this to add a function
backend/
  src/server.ts        two routes: GET /api/functions, POST /api/invoke
  src/invoke.ts         the one MOCK_LLM branch (SummarizeText -> $parse companion)
  src/bamlClient.ts     lazy-loads the generated client so a stale bridge degrades, not crashes
  src/baml_sdk/         generated TypeScript client (committed; regenerate via baml generate)
frontend/
  src/App.tsx                     fetches /api/functions, renders the grid
  src/components/FunctionCard.tsx  one card: docstring, badges, form, result
  src/components/DynamicForm.tsx   builds form controls from each param's JSON Schema
  src/schema.ts                    JSON Schema -> form-control-kind classifier
```
