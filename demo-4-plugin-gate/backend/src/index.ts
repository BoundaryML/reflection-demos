import express from "express";
import { PluginHost, type Failure, type PluginField, type Report } from "./host.js";
import { CONTRACT_FIELDS, DOCUMENTS, EXAMPLES } from "./catalog.js";

const PORT = Number(process.env.PORT ?? 4440);

interface InstalledPlugin {
  name: string;
  vendor: string;
  source: string;
  bindings: Record<string, string>;
  manifest: string;
  fields: PluginField[];
  installedAt: string;
}

const host = new PluginHost();
const installed = new Map<string, InstalledPlugin>();

function className(source: string): string | null {
  return /(?:^|\n)\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(source)?.[1] ?? null;
}

async function install(
  source: string,
  bindings: Record<string, string>,
  vendor: string,
): Promise<{ ok: true; plugin: InstalledPlugin } | { ok: false; error: Failure }> {
  const name = className(source);
  if (!name) {
    return {
      ok: false,
      error: { message: "a plugin must declare exactly one class", diagnostics: [] },
    };
  }
  const reply = await host.send({ op: "install", name, source, bindings });
  if (!reply.ok || !reply.manifest || !reply.fields) {
    return {
      ok: false,
      error: reply.error ?? { message: "the plugin host did not answer", diagnostics: [] },
    };
  }
  const plugin: InstalledPlugin = {
    name,
    vendor,
    source,
    bindings,
    manifest: reply.manifest,
    fields: reply.fields,
    installedAt: new Date().toISOString(),
  };
  installed.set(name, plugin);
  return { ok: true, plugin };
}

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/bootstrap", (_req, res) => {
  res.json({
    mode: "live",
    model:
      process.env.PLUGIN_MODEL ??
      (process.env.OPENAI_API_KEY?.trim() ? "openai/gpt-4o-mini" : "anthropic/claude-haiku-4-5"),
    host: { status: host.status, error: host.lastError },
    contract: CONTRACT_FIELDS,
    examples: EXAMPLES,
    documents: DOCUMENTS,
    plugins: [...installed.values()],
  });
});

app.post("/api/plugins", async (req, res) => {
  const { source, bindings, vendor } = req.body as {
    source?: string;
    bindings?: Record<string, string>;
    vendor?: string;
  };
  if (typeof source !== "string" || !source.trim()) {
    res.status(400).json({ ok: false, error: { message: "no plugin source", diagnostics: [] } });
    return;
  }
  const result = await install(source, bindings ?? {}, vendor ?? "unlisted vendor");
  res.status(result.ok ? 200 : 422).json(result);
});

app.delete("/api/plugins/:name", (req, res) => {
  installed.delete(req.params.name);
  res.json({ ok: true, plugins: [...installed.values()] });
});

function documentBody(id: unknown): string | null {
  return DOCUMENTS.find((d) => d.id === id)?.body ?? null;
}

app.post("/api/plugins/:name/run", async (req, res) => {
  const plugin = installed.get(req.params.name);
  if (!plugin) {
    res.status(404).json({ ok: false, error: { message: "no such plugin", diagnostics: [] } });
    return;
  }
  const document = documentBody((req.body as { documentId?: string }).documentId);
  if (!document) {
    res.status(400).json({ ok: false, error: { message: "no such document", diagnostics: [] } });
    return;
  }
  const reply = await host.send({ op: "invoke", name: plugin.name, document });
  if (!reply.ok || !reply.report) {
    res.status(422).json({
      ok: false,
      error: reply.error ?? { message: "the plugin host did not answer", diagnostics: [] },
    });
    return;
  }
  res.json({ ok: true, report: reply.report satisfies Report, mode: "live" });
});

/**
 * "Run it anyway": load a rejected plugin the way an unchecked loader would —
 * same class, no witness — and try to use it. Gate 2 answers.
 */
app.post("/api/force", async (req, res) => {
  const { source, bindings, documentId } = req.body as {
    source?: string;
    bindings?: Record<string, string>;
    documentId?: string;
  };
  const name = typeof source === "string" ? className(source) : null;
  const document = documentBody(documentId) ?? DOCUMENTS[0]!.body;
  if (!name || typeof source !== "string") {
    res.status(400).json({ ok: false, error: { message: "no plugin source", diagnostics: [] } });
    return;
  }
  const reply = await host.send({
    op: "force",
    name,
    source,
    bindings: bindings ?? {},
    document,
  });
  if (!reply.ok || !reply.report) {
    res.json({
      ok: false,
      error: reply.error ?? { message: "the plugin host did not answer", diagnostics: [] },
    });
    return;
  }
  res.json({ ok: true, report: reply.report });
});

app.listen(PORT, () => {
  console.log(`[plugin-gate] api on http://localhost:${PORT}`);
});

host
  .start()
  .then(async () => {
    console.log("[plugin-gate] BAML plugin host ready");
    const seed = EXAMPLES[0]!;
    const result = await install(seed.source, seed.bindings, seed.vendor);
    if (!result.ok) console.error("[plugin-gate] seed install failed:", result.error.message);
  })
  .catch((error: unknown) => {
    console.error("[plugin-gate] BAML plugin host failed to start:", error);
  });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    host.stop();
    process.exit(0);
  });
}
