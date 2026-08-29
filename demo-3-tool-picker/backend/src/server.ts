import cors from "cors";
import express from "express";
import { BamlError } from "@boundaryml/baml-bridge";

import { TOOL_IDS, TOOLS, type ToolId } from "./tools/meta.js";
import { routeMock } from "./mockRouter.js";
import { runCalculator } from "./tools/calculator.js";
import { runUnitConverter, type UnitConverterArgs } from "./tools/unitConverter.js";
import { listNotes, runNoteSaver } from "./tools/noteSaver.js";
import { runWeatherLookup } from "./tools/weatherLookup.js";

const PORT = Number(process.env.PORT ?? 4430);
const MODEL = "claude-haiku-4-5-20251001";
// Offline-first by default: mock unless a real Anthropic key is present, and
// MOCK_LLM=1 always forces mock even when a key is set.
const MOCK = process.env.MOCK_LLM === "1" || !process.env.ANTHROPIC_API_KEY;

// The generated BAML client runs `initializeRuntimeFromBytecode` as a
// top-level side effect on import, so a stale native bridge addon (see
// README's "Known environment issues") throws AT IMPORT TIME, not at call
// time. Importing it lazily — and only from inside the one route that needs
// it — means that failure degrades `/api/chat` instead of taking the whole
// server down; `/api/tools`, `/api/mode`, and `/api/notes` stay up either
// way. The import is cached (success or failure) for the process lifetime;
// `tsx watch` restarts pick up a fixed addon.
type BamlSdk = typeof import("../baml_sdk/index.js");
let bamlSdk: Promise<BamlSdk> | null = null;
function loadBamlSdk(): Promise<BamlSdk> {
  bamlSdk ??= import("../baml_sdk/index.js");
  return bamlSdk;
}

const TOOL_ID_SET = new Set<string>(TOOL_IDS);
function isToolId(value: string): value is ToolId {
  return TOOL_ID_SET.has(value);
}

function enabledLabels(enabled: Set<ToolId>): string {
  return Array.from(enabled)
    .map((id) => TOOLS[id].label)
    .join(", ");
}

function noToolReply(enabled: Set<ToolId>): string {
  return `I don't have a tool for that right now. Enabled: ${enabledLabels(enabled)}.`;
}

function runTool(tool: ToolId, args: Record<string, unknown>): { reply: string; result: unknown } {
  switch (tool) {
    case "calculator": {
      const result = runCalculator({ expression: String(args.expression ?? "") });
      return { reply: result.summary, result };
    }
    case "unit_converter": {
      const converterArgs: UnitConverterArgs = {
        value: Number(args.value),
        from_unit: String(args.from_unit ?? ""),
        to_unit: String(args.to_unit ?? ""),
      };
      const result = runUnitConverter(converterArgs);
      return { reply: result.summary, result };
    }
    case "note_saver": {
      const result = runNoteSaver({ title: String(args.title ?? ""), body: String(args.body ?? "") });
      return { reply: result.summary, result };
    }
    case "weather": {
      const result = runWeatherLookup({ location: String(args.location ?? "") });
      return { reply: result.summary, result };
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/tools", (_req, res) => {
  res.json(TOOL_IDS.map((id) => TOOLS[id]));
});

app.get("/api/mode", (_req, res) => {
  res.json({ mock: MOCK, model: MOCK ? null : MODEL });
});

app.get("/api/notes", (_req, res) => {
  res.json(listNotes());
});

interface ChatBody {
  message?: string;
  enabled?: string[];
}

app.post("/api/chat", async (req, res) => {
  const body = req.body as ChatBody;
  const message = (body.message ?? "").trim();
  const enabled = new Set((body.enabled ?? []).filter(isToolId));

  if (!message) {
    res.json({ status: "no_match", reply: "Say something first." });
    return;
  }

  if (enabled.size === 0) {
    res.json({ status: "no_tools", reply: "Every tool is switched off — turn one on in the sidebar to get started." });
    return;
  }

  let RouteAndDispatch_async: BamlSdk["RouteAndDispatch_async"];
  try {
    ({ RouteAndDispatch_async } = await loadBamlSdk());
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.json({
      status: "error",
      reply:
        "The BAML runtime isn't available right now (bridge/toolchain mismatch in this " +
        `environment — see README). Routing can't run until that's fixed: ${detail}`,
    });
    return;
  }

  try {
    // MOCK_LLM=1 stands in for the model: guess a tool + build its args,
    // then hand that JSON to the SAME PickAction$parse<T> companion a real
    // model's output would go through, against the SAME runtime union.
    let mockJson: string | null = null;
    if (MOCK) {
      const guess = routeMock(message, Array.from(enabled));
      if (!guess) {
        res.json({ status: "no_match", reply: noToolReply(enabled) });
        return;
      }
      mockJson = guess.mockJson;
    }

    const pick = await RouteAndDispatch_async(
      enabled.has("calculator"),
      enabled.has("unit_converter"),
      enabled.has("note_saver"),
      enabled.has("weather"),
      message,
      mockJson,
    );

    if (!pick.matched || !isToolId(pick.tool)) {
      res.json({ status: "no_match", reply: noToolReply(enabled) });
      return;
    }

    const args = JSON.parse(pick.args_json) as Record<string, unknown>;
    const { reply, result } = runTool(pick.tool, args);
    res.json({ status: "matched", reply, tool: pick.tool, args, result });
  } catch (err) {
    const refusal = declinedForLackOfTool(err);
    if (refusal !== null) {
      // Not a failure — this is the demo's whole point, arriving live. See
      // `declinedForLackOfTool`.
      console.warn(`[/api/chat] no enabled tool fits; model said: ${refusal}`);
      res.json({ status: "no_match", reply: noToolReply(enabled) });
      return;
    }
    // Log the whole thing server-side: a BamlError's useful part is its
    // `value` payload (e.g. ParseFailed's `raw_output`), which never survives
    // `.message`, and without it a failing turn is undiagnosable from the
    // chat bubble alone.
    console.error("[/api/chat] failed:", err);
    res.json({ status: "error", reply: `Couldn't complete that: ${describeError(err)}` });
  }
});

/**
 * The runtime union is the model's entire vocabulary for a turn, so when no
 * enabled tool fits the request there is simply no value it can return. It
 * says so in prose instead, the runner spends its retry and raises
 * `ai.errors.ParseFailed`. That is this demo's `no_match` — the same beat mock
 * mode reaches when `routeMock` finds nothing — not a system fault.
 *
 * Returns the model's own words when that's what happened, else `null`.
 *
 * A `ParseFailed` carrying a JSON *object* is deliberately excluded: there the
 * model did answer in schema and the runtime still couldn't read it, which is a
 * toolchain regression (exactly the stale-bridge signature this demo hit on
 * 2026-08-24) and has to stay loud rather than read as "no tool for that".
 */
function declinedForLackOfTool(err: unknown): string | null {
  if (!(err instanceof BamlError) || err.className !== "ai.errors.ParseFailed") return null;
  const raw = (err.value as { raw_output?: unknown } | undefined)?.raw_output;
  if (typeof raw !== "string" || /\{[\s\S]*\}/.test(raw)) return null;
  return raw;
}

function describeError(err: unknown): string {
  if (err instanceof BamlError) {
    const what = err.className ?? err.message;
    const raw = (err.value as { raw_output?: unknown } | undefined)?.raw_output;
    return typeof raw === "string" ? `${what} (model said: ${raw})` : what;
  }
  return err instanceof Error ? err.message : String(err);
}

app.listen(PORT, () => {
  console.log(`demo-3-tool-picker backend on http://localhost:${PORT} (${MOCK ? "mock" : "live"} mode)`);
});
