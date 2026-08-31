# Presenter script — Digest Plugin Registry

Roughly 4 minutes with the code reveal, 45 seconds without it. Run
`pnpm --filter demo-4-plugin-gate dev` and wait for the status dot in the top right to read
**host ready** before you start.

The one-sentence frame, if you only get one sentence:

> Digest never compiled against any of these plugins, and it still cannot call one wrongly.

---

## Beat 0 — set the scene (15s)

> "Digest summarizes documents. It has a plugin marketplace: anyone can publish a summarizer.
> The rail on the left is the contract — two fields. That is all Digest knows about any plugin."

Point at **The contract**: `summary string`, `key_points string[]`.

> "Everything else a plugin declares is its own business. Digest has never seen those names."

---

## Beat 1 — a plugin that works (30s)

*Terse* is already installed. Click **Run plugin** on the incident-review document.

> "Summary, key points — Digest read those off the contract, as ordinary typed fields."

Point at the second block, **This plugin's own fields**.

> "And `reading_time_min` — that is Terse's field, not ours. Digest read it reflectively, by name,
> at runtime. Two different mechanisms in one result."

If you want the extra beat, expand *the request this plugin's schema produced*:

> "That schema in the prompt was generated from Terse's runtime type. Digest's prompt template
> never mentions `reading_time_min`."

---

## Beat 2 — the gate rejects a plugin (45s)

Click the **BulletBot** chip. Read the source out loud: `summary`, `bullets`, `tone`.

> "BulletBot calls its list `bullets`. Nothing in it is called `key_points`."

Click **Install BulletBot**.

> "Rejected. And this is not our error message — that is `E0001` from the BAML compiler, raised
> while the registry was constructing the runtime class. Nothing was registered. No model was
> called."

---

## Beat 3 — fix it without touching the plugin (30s)

In **Contract bindings**, change `key_points is answered by` to **bullets**. Install again.

> "The witness is a mapping, not a naming convention. BulletBot can keep calling it `bullets`;
> it just has to declare which of its fields answers the contract."

Point at the **Registered manifest**:

```
implements Summarizer {
  summary as summary
  key_points as bullets
}
```

> "That block is the registry's proof. It is canonical BAML, rendered back out of the type the
> registry minted a second ago."

Run it. The summary and key points come back through the contract; `tone` shows up as one of
BulletBot's own fields.

---

## Beat 4 — a plugin that cannot be fixed by binding (30s)

Click **Legacy Digest**, then **Install LegacyDigest**.

> "This one is a port from a v1 API where key points were one newline-joined string. It has a
> field called `key_points` — the right name, the wrong type."

The diagnostic highlights line 4:

> "`requires string[], but class field key_points has string`. No binding can bridge that. The
> plugin has to change."

---

## Beat 5 — the money shot: try to smuggle it past (45s)

Click **Load it unchecked and run it anyway →**.

> "Suppose we had a sloppier plugin loader — one that just built the type and skipped the contract
> check. Here it is."

The second card appears: **Blocked at the call site**.

> "Digest still refuses. Every path from the host into a plugin goes through one function with a
> bound: `invoke<P extends Summarizer>`. The bound is checked against the runtime type at the call
> site. `E0001, mismatched types` — and notice *when*: before a prompt was rendered, before a
> single token was spent."

---

## The code reveal (60–90s, in your editor)

Three files, in this order.

**1. `baml_src/contract.baml` — line 7 and line 25.** The whole contract, and the one function that
runs a plugin.

```baml
interface Summarizer {
  summary string
  key_points string[]
}

function Summarize<T extends Summarizer>(document: string) -> T { … }
```

> "`T` is the plugin's class. We never compiled against it. The bound is why any of this is safe."

**2. `baml_src/registry.baml` — `mint`, line 44.** Gate 1.

```baml
let witness = reflect.interface.implementation<Summarizer>()
for (let name in contract_fields()) {
  witness = witness.field(name, class_field = submission.bindings.get(name))
}
reflect.class.new(submission.name, fields, implementations = [witness])
```

> "Compile the submission, walk its fields, build the witness from the bindings the publisher
> chose, and mint. If the witness does not check out, `reflect.class.new` throws, and the throw
> carries the compiler's diagnostics. That is everything you saw in red."

**3. `baml_src/registry.baml` — `invoke`, line 77, together with `host.baml` line 97.** Gate 2.

```baml
// host.baml
type P = unreflect(plugin.as_type());
invoke<P>(request.document ?? "", answered)

// registry.baml
function invoke<P extends Summarizer>(document: string, answered: string[]) -> Report {
  let result: Summarizer = Summarize<P>(document)
  …
  reflect.class.get_field<unknown>(result, field.name)
}
```

> "`type P = unreflect(...)` binds a runtime type value to a type name for the rest of the block.
> Then `invoke<P>` — and the bound gets enforced against that runtime value. Inside, `result.summary`
> is a plain typed field read, and the plugin's own fields come out through `get_field`.
>
> Static code and runtime-loaded code, same rules."

---

## Reset between runs

Remove plugins with the `×` in the rail, or restart the dev server. Nothing is persisted to disk.

## If something goes wrong

- **Status dot stuck on "host starting…"** — `baml_src` is compiling; give it a few seconds. If it
  turns red, the banner carries the reason (usually: no BAML CLI on `PATH`).
- **You need it faster** — the first request after a `baml_src` edit recompiles. Do one install
  before you present so everything after it is warm.
