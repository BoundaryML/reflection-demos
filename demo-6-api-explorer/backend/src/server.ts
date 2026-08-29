import express from "express";
import { loadBamlSdk } from "./bamlClient.js";
import { invokeFunction } from "./invoke.js";

const PORT = Number(process.env.PORT ?? 4460);

// MOCK_LLM=1 always forces mock mode; MOCK_LLM=0 always forces live mode.
// Left unset, mock mode is the default unless an API key is present — so
// `npm run dev` with no setup at all is fully offline-presentable, per the
// repo's mock-mode mandate, while dropping in a key upgrades it for free.
const MOCK_LLM =
  process.env.MOCK_LLM === "1" || (process.env.MOCK_LLM !== "0" && !process.env.ANTHROPIC_API_KEY);

if (!MOCK_LLM && !process.env.ANTHROPIC_API_KEY) {
  // MOCK_LLM=0 is an explicit opt out of mock mode, so honour it — but say so
  // now rather than letting the presenter discover it mid-demo. The other five
  // functions need no key, so this is a warning, not a fatal: the console still
  // works, and SummarizeText returns a typed ai.errors.InvalidRequest.
  console.warn(
    "[demo-6-api-explorer] MOCK_LLM=0 but ANTHROPIC_API_KEY is unset — SummarizeText will fail " +
      "with ai.errors.InvalidRequest. Unset MOCK_LLM (or set MOCK_LLM=1) to use the canned response.",
  );
} else if (!MOCK_LLM) {
  console.log("[demo-6-api-explorer] Live mode: SummarizeText will call Anthropic.");
} else if (!process.env.ANTHROPIC_API_KEY) {
  console.log("[demo-6-api-explorer] No ANTHROPIC_API_KEY found — running in mock mode (MOCK_LLM=1).");
} else {
  console.log("[demo-6-api-explorer] MOCK_LLM=1 set — running in mock mode despite a present API key.");
}

const app = express();
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const bridgeOk = await loadBamlSdk()
    .then(() => true)
    .catch(() => false);
  res.json({ ok: true, mock: MOCK_LLM, bridge: bridgeOk });
});

// The ONE generic read: reflect.Package.current() enumerates every function
// in baml_src, so this response — and the console it renders — never
// changes shape when a function is added to functions.baml.
app.get("/api/functions", async (_req, res) => {
  try {
    const sdk = await loadBamlSdk();
    const functions = await sdk.ListFunctions_async();
    res.json({ functions, mock: MOCK_LLM });
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
    const result = await invokeFunction(name, args as Record<string, string>, MOCK_LLM);
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
    `demo-6-api-explorer backend on http://localhost:${PORT} (MOCK_LLM=${MOCK_LLM ? "1" : "0"})`,
  );
});
