# Presenter script — BAML Notebook

**Setup:** `pnpm dev`, open <http://localhost:4471>, scroll to the top. Have a second
browser window ready but not yet opened. No API key needed.

The backend compiles `baml_src/` at boot — a couple of seconds warm, longer on the first
run of the day — so start it before you are on stage and confirm `/api/health` says
`"ok": true`. After that a cell runs in roughly 40–65 ms (120–175 ms on a debug-built addon).

**Total: 2 minutes.** The 30-second version is beats 1, 3 and 5.

---

### 0 · Frame it (10s)

> "This is a notebook. The cells are BAML. Every cell runs against the support service
> that's currently up — not a copy of it, not a fixture. Watch."

---

### 1 · The package is live (20s)

Run **`app.LoadTickets().length()`** → `6`.
Run **`app.Headline(app.GetTicket("SUP-1044"))`** → a real ticket headline.

> "`app` is the running package, mounted into this session. Nothing was generated, nothing
> was wired up — the notebook just reflected it in."

---

### 2 · Declare, then use (25s)

Run the **`class Digest { … }`** cell. Nothing prints.

> "That class now exists — in my session. Not in the service, not in yours."

Run the next cell (builds a `Digest` from a ticket using three `app` functions).
Then run **`digest.channel`**.

> "Cell three's class, cell four's value, read back in cell five. This is a REPL over
> production code."

---

### 3 · Isolation — the money shot (35s)

Run **`let runs = 0`**, then **`runs = runs + 1 / runs`** three times: `1`, `2`, `3`.

Click **Open a second notebook**. Put the windows side by side — note the two coloured
session chips in the headers, and the header counter now reading *2 notebooks open*.

In the new tab, run the same two cells: `1`.

> "Same code, same server, same package. Two sessions. Generative identity means even the
> `Digest` class in one tab is a *different type* from the `Digest` in the other — they
> could never collide."

Bounce back to the first tab and run its counter once more: `4`.

---

### 4 · A bad cell can't hurt you (20s)

Run **`digest.no_such_field`**.

> "Real diagnostics — `E0007`, the message, the submission it came from. And the important
> part: a submission is type-checked before *any* of it executes, so nothing ran."

Run **`digest.urgency`** → `P1`.

> "Session's fine."

---

### 5 · Containment (20s)

Run the three-statement cell (`kept` / `boom` / `never`).

> "That threw in the middle."

Run **`kept`** → `"this statement ran"`.
Run **`never`** → `E0003: unresolved name`.

> "Containment is a committed prefix, not a rollback. The statements that ran are committed;
> the one that threw and everything after it never happened. Your session is exactly where
> you'd expect it to be."

---

### 6 · Land it (10s)

> "Per-user REPL, over the production package, with real diagnostics and real isolation.
> The backend for all of that is two BAML functions: `Session.new` with the current package
> mounted, and `eval`. That's it."

*(If asked to see them: `baml_src/notebook.baml` — seven lines of code, the rest is comments.)*

---

## If someone asks

**"Can a cell break the server?"** No. A `Session` is its own runtime image. A bad cell
throws into `RunCell`; the host catches it and reports it. The session's committed prefix is
all that survives.

**"What happens when I close the tab?"** `sendBeacon` tells the server on the way out; it
stops counting the notebook as open at once and drops the handle 15 seconds later (the
short hold is what lets a *reload* reattach instead of losing the session). An idle sweeper
collects anything the beacon missed after 30 minutes. Dropping the handle *is* the
cleanup — nothing else references the image.

**"Two cells at once?"** A `Session` permits one active eval and throws `SessionBusy`
otherwise. The backend queues per notebook, so it never surfaces.

**"Is the LLM real?"** With `ANTHROPIC_API_KEY` set, yes — `app.Assess(...)` calls the
model. Without it, the same function renders the real prompt and parses a canned reply
through the `$parse` seam, exactly like the BAML test suite. `app.AssessPrompt(...)` shows
the prompt either way.

## Recovery

- **A cell shows `busy`** — the previous one is still running. Wait; it clears itself.
- **You reloaded the page** — harmless. The tab reattaches to its own session: the outputs
  on screen are gone, but the bindings are not. Re-run the counter and it keeps climbing.
- **Session got messy mid-demo** — *Restart session* in the header: new session, same tab,
  outputs cleared.
- **Cells are slow (seconds)** — stale native addon; see README troubleshooting. Not
  recoverable mid-demo, so check `/api/health` before you present.
