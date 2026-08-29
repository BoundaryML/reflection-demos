# Hub

The landing page for the reflection demos: a hero explaining the theme (types as
runtime values — enums, classes, unions, packages, sessions built while the program
runs) and seven cards, one per demo, each linking out to that demo's frontend with a
live status dot for its backend.

No backend of its own, no BAML, no env vars — it's a static React app that polls other
services' `/api/health` endpoints client-side.

## Run standalone

```bash
pnpm install   # from the repo root, or just `pnpm install` inside hub/
pnpm --filter hub dev
```

Opens on **http://localhost:4400**. The demo cards link to `http://localhost:44N1` for
each demo N — those will 404 until that demo's own `pnpm dev` is running, which is
expected when running the hub in isolation.

## How the status dots work

Each card polls its demo's backend at `http://localhost:44N0/api/health` every 5s
(`src/useHealth.ts`). Backends aren't required to send CORS headers for this, so the
poll uses `fetch(..., { mode: "no-cors" })`: the response body is opaque and never read,
but a *resolved* fetch means something answered on that port (green) and a *rejected*
one (connection refused, timeout after 2.5s) means nothing did (grey). That's the only
signal a binary up/down dot needs.

## Files

- `src/demos.ts` — card metadata (titles, hooks, scenario copy, ports) for all seven
  demos. Slugs here match each `demo-N-<slug>/` directory name and the `pnpm --filter`
  names in the root `package.json`.
- `src/useHealth.ts` — the health-polling hook described above.
- `src/DemoCard.tsx`, `src/App.tsx` — layout.
