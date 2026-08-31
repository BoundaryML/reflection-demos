import express from 'express';

import { bamlStatus, initBaml } from './baml.js';
import {
  closeNotebook,
  createNotebook,
  getNotebook,
  liveCount,
  restartNotebook,
  runNotebookCell,
  startSweeper,
} from './notebooks.js';
import { SEED_CELLS } from './seed.js';

const PORT = Number(process.env.PORT ?? 4470);
const MAX_CELL_BYTES = 64 * 1024;

const boot = await initBaml();
startSweeper();

const app = express();
app.use(express.json({ limit: '256kb' }));
// `navigator.sendBeacon` posts text/plain; accept it as a body-less signal so a
// closing tab can still release its session.
app.use(express.text({ type: 'text/plain', limit: '1kb' }));

/** Guards every route that needs a working engine. */
function requireBaml(res: express.Response): boolean {
  const status = bamlStatus();
  if (status.ok) {
    return true;
  }
  res.status(503).json({ error: status.error });
  return false;
}

app.get('/api/health', (_req, res) => {
  const status = bamlStatus();
  res.json({
    ok: status.ok,
    ...(status.ok
      ? { bridgeVersion: status.version, bamlFiles: status.files }
      : { error: status.error }),
    liveNotebooks: liveCount(),
    llm: 'live',
  });
});

app.get('/api/notebooks', (_req, res) => {
  res.json({ live: liveCount() });
});

app.post('/api/notebooks', async (_req, res, next) => {
  if (!requireBaml(res)) {
    return;
  }
  try {
    const notebook = await createNotebook();
    res.json({ notebook, seed: SEED_CELLS, live: liveCount() });
  } catch (error) {
    next(error);
  }
});

// Reattaching after a page reload: the session outlived the tab's javascript.
app.get('/api/notebooks/:id', (req, res) => {
  const notebook = getNotebook(req.params.id);
  if (!notebook) {
    res.status(404).json({ error: 'notebook not found' });
    return;
  }
  res.json({ notebook, seed: SEED_CELLS, live: liveCount() });
});

app.post('/api/notebooks/:id/run', async (req, res, next) => {
  if (!requireBaml(res)) {
    return;
  }
  try {
    const source = (req.body as { source?: unknown } | undefined)?.source;
    if (typeof source !== 'string' || source.trim().length === 0) {
      res.status(400).json({ error: 'source must be a non-empty string' });
      return;
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_CELL_BYTES) {
      res.status(413).json({ error: 'cell is too large' });
      return;
    }

    const result = await runNotebookCell(req.params.id, source);
    if (!result) {
      res.status(404).json({ error: 'notebook not found' });
      return;
    }
    res.json({ ...result, live: liveCount() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/notebooks/:id/restart', async (req, res, next) => {
  if (!requireBaml(res)) {
    return;
  }
  try {
    const notebook = await restartNotebook(req.params.id);
    if (!notebook) {
      res.status(404).json({ error: 'notebook not found' });
      return;
    }
    res.json({ notebook, live: liveCount() });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/notebooks/:id', (req, res) => {
  res.json({ closed: closeNotebook(req.params.id), live: liveCount() });
});

// sendBeacon can only POST, so tab-close uses this instead of DELETE.
app.post('/api/notebooks/:id/close', (req, res) => {
  res.json({ closed: closeNotebook(req.params.id), live: liveCount() });
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[demo-7] unhandled:', message);
    res.status(500).json({ error: message });
  },
);

app.listen(PORT, () => {
  if (boot.ok) {
    console.log(
      `[demo-7-notebook] baml bridge ${boot.version} · compiled ${boot.files.join(', ')}`,
    );
  } else {
    console.error(`[demo-7-notebook] BAML IS DOWN\n${boot.error}`);
  }
  if (process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim()) {
    console.log('[demo-7-notebook] LLM: live (app.Assess calls the model; OpenAI preferred when both keys are set)');
  } else {
    console.warn('[demo-7-notebook] no OPENAI_API_KEY or ANTHROPIC_API_KEY — app.Assess will fail.');
  }
  console.log(`[demo-7-notebook] api on http://localhost:${PORT}`);
});
