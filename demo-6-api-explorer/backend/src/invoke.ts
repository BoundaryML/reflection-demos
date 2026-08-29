// The only place in this backend that knows the LLM function's name. It
// exists purely to satisfy MOCK_LLM=1 (no API key): instead of calling
// `root.SummarizeText` (which would hit the network), it calls the
// compiler-synthesized `root.SummarizeText$parse` companion with a canned
// JSON response — the same render-prompt-then-parse-canned-output seam the
// BAML test suite itself uses. Both paths end at the exact same reflective
// dispatcher (`InvokeFunction` in baml_src/reflection.baml); the frontend
// never knows which one ran.
import { loadBamlSdk } from "./bamlClient.js";
import type { InvokeResult } from "./baml_sdk/index.js";

const LLM_FUNCTION = "root.SummarizeText";
const LLM_MOCK_COMPANION = "root.SummarizeText$parse";

const TONE_LABEL: Record<string, string> = {
  Neutral: "Summary",
  Enthusiastic: "Exciting recap!",
  Formal: "Executive summary",
};

/** Best-effort decode of one InvokeFunction-style JSON-encoded arg value. */
function decodeArg(raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Builds a canned — but input-shaped — Summary as raw model-output JSON text. */
function mockSummaryJson(args: Record<string, string>): string {
  const text = decodeArg(args.text, "");
  const tone = decodeArg(args.tone, "Neutral");
  const words = text.trim().split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, 8).join(" ") || "(empty input)";
  const label = TONE_LABEL[tone] ?? "Summary";

  return JSON.stringify({
    headline: `${label}: ${excerpt}${words.length > 8 ? "…" : ""}`,
    bullets: [
      `${words.length} word(s) of input, tone "${tone}"`,
      "Canned response — MOCK_LLM=1, no network call was made",
      "Set ANTHROPIC_API_KEY and unset MOCK_LLM for a real model",
    ],
  });
}

export async function invokeFunction(
  name: string,
  args: Record<string, string>,
  mock: boolean,
): Promise<InvokeResult> {
  const sdk = await loadBamlSdk();
  if (mock && name === LLM_FUNCTION) {
    // json is a `string` parameter, so its InvokeFunction-encoded value is a
    // JSON string *literal* wrapping the model-output text.
    return sdk.InvokeFunction_async(LLM_MOCK_COMPANION, { json: JSON.stringify(mockSummaryJson(args)) });
  }
  return sdk.InvokeFunction_async(name, args);
}
