import express from "express";
import { loadBamlSdk } from "./bamlClient.js";
import { invokeFunction } from "./invoke.js";

const PORT = Number(process.env.PORT ?? 4460);

// Live only. Mirrors default_client() in baml_src/functions.baml:
// OpenAI wins when both keys are set.
if (process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim()) {
  console.log("[demo-6-api-explorer] Live: SummarizeText calls the model (OpenAI preferred when both keys are set).");
} else {
  console.warn(
    "[demo-6-api-explorer] no OPENAI_API_KEY or ANTHROPIC_API_KEY — the five pure functions " +
      "work, and SummarizeText returns a typed ai.errors.InvalidRequest.",
  );
}

const app = express();
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const bridgeOk = await loadBamlSdk()
    .then(() => true)
    .catch(() => false);
  res.json({ ok: true, mock: false, bridge: bridgeOk });
});

// The ONE generic read: reflect.Package.current() enumerates every function
// in baml_src, so this response — and the console it renders — never
// changes shape when a function is added to functions.baml.
app.get("/api/functions", async (_req, res) => {
  try {
    const sdk = await loadBamlSdk();
    const functions = await sdk.ListFunctions_async();
    res.json({ functions, mock: false });
  } catch (err) {
    res.status(503).json({ error: bridgeErrorMessage(err) });
  }
});

// The ONE generic write: reflect.call_any() dispatches by name. This route
// never grows a new branch when a function is added to functions.baml.
app.post("/api/invoke", async (req, res) => {
  const { name, args } = req.body ?? {};
  if (typeof name !== "string" || typeof args !== "object" || args === null || Array.isArray(args)) {
    res.status(400).json({
      ok: false,
      value: null,
      error_type: "BadRequest",
      error_message: "expected { name: string, args: Record<string, string> }",
    });
    return;
  }
  try {
    const result = await invokeFunction(name, args as Record<string, string>);
    res.json(result);
  } catch (err) {
    res.status(503).json({
      ok: false,
      value: null,
      error_type: "BridgeUnavailable",
      error_message: bridgeErrorMessage(err),
    });
  }
});

/** Trims the (long, native-addon) BAML version-skew message down to one line. */
function bridgeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split("\n")[0] ?? message;
}

app.listen(PORT, () => {
  console.log(
    `demo-6-api-explorer backend on http://localhost:${PORT}`,
  );
});
