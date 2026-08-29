// Stands in for the LLM in MOCK_LLM=1 mode: a keyword/regex router that only
// ever considers the tools the caller says are enabled. That mirrors what a
// real model actually experiences — it doesn't "see" a disabled tool and
// reject it, it never receives that tool's schema in the first place, so
// this router never even builds args for a disabled tool.
//
// The router's job stops at "which tool, with what plausible arguments" —
// the resulting JSON is then handed to the real `PickAction$parse<T>`
// companion in baml_src/toolbox.baml, so the actual reflection/parsing
// machinery still runs on every turn, mock mode or not.
//
// Argument keys here are the *wire* names (the `alias = ...` metas in
// toolbox.baml): `from`/`to` for UnitConverter, `city` for WeatherLookup.
// That is what a schema-constrained model would emit, and what
// `PickAction$parse<T>` expects.
import { runCalculator } from "./tools/calculator.js";
import type { ToolId } from "./tools/meta.js";

interface Match {
  score: number;
  args: Record<string, unknown>;
}

// Scores are distinct so dispatch never depends on the order the caller
// happened to list the enabled tools in (the frontend's order changes as
// tools are toggled). Specific triggers outrank the calculator, which is the
// broadest matcher: "remember I owe Dana 20 + 5" is a note, not arithmetic.
const SCORE = { unit_converter: 6, weather: 5, note_saver: 4, calculator: 3 } as const;

const UNIT_WORDS =
  "kilometers?|km|centimeters?|cm|millimeters?|mm|meters?|m|miles?|mi|feet|foot|ft|inches?|inch|in|yards?|yd|" +
  "kilograms?|kg|grams?|g|pounds?|lbs?|ounces?|oz|celsius|fahrenheit|kelvin|[cfk]";
const NUMBER = "-?\\d+(?:\\.\\d+)?";
// "10 km to miles", "70 kg in pounds", "convert 5 c into f"
const CONVERT_RE = new RegExp(
  `(${NUMBER})\\s*(${UNIT_WORDS})\\b[^0-9]*?\\b(?:to|into|in|as)\\b\\s*(${UNIT_WORDS})\\b`,
  "i",
);
// The same question asked backwards: "how many pounds is 70 kg?"
const HOW_MANY_RE = new RegExp(`\\bhow many\\s+(${UNIT_WORDS})\\b[^0-9]*?(${NUMBER})\\s*(${UNIT_WORDS})\\b`, "i");

// People say "12 times (7 plus 5)", not "12 * (7 + 5)" — a real model reads
// both, so the stand-in has to as well, or the demo's own opening line
// ("What's 12 times (7 plus 5)?") falls through to "no tool for that".
const WORD_OPERATORS: [RegExp, string][] = [
  [/\bplus\b|\badded to\b/gi, "+"],
  [/\bminus\b|\bless\b|\btake away\b/gi, "-"],
  [/\btimes\b|\bmultiplied by\b/gi, "*"],
  [/\bdivided by\b|\bover\b/gi, "/"],
  [/(?<=\d\s*)x(?=\s*[\d(])/gi, "*"],
];

function toSymbols(message: string): string {
  return WORD_OPERATORS.reduce((text, [pattern, symbol]) => text.replace(pattern, symbol), message);
}

function matchCalculator(message: string): Match | null {
  const chunks = toSymbols(message).match(/[-+*/().\d\s]+/g) ?? [];
  const candidates = chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => /\d/.test(chunk) && /[-+*/]/.test(chunk.replace(/^-/, "")))
    // Only offer an expression the calculator can actually evaluate. A model
    // constrained by the schema proposes well-formed arguments; a fragment
    // like "3 +" scraped out of prose would just produce an error card.
    .filter((chunk) => {
      try {
        runCalculator({ expression: chunk });
        return true;
      } catch {
        return false;
      }
    });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return { score: SCORE.calculator, args: { expression: candidates[0] } };
}

function matchUnitConverter(message: string): Match | null {
  const forward = message.match(CONVERT_RE);
  if (forward) {
    const [, value, from, to] = forward;
    return { score: SCORE.unit_converter, args: { value: Number(value), from, to } };
  }
  const backward = message.match(HOW_MANY_RE);
  if (backward) {
    const [, to, value, from] = backward;
    return { score: SCORE.unit_converter, args: { value: Number(value), from, to } };
  }
  return null;
}

const NOTE_TRIGGER =
  /\b(note that|note:|remember to|remember that|remember|remind me to|jot down|write down|save (this|a) note)\b[:\s]*/i;

function matchNoteSaver(message: string): Match | null {
  const found = message.match(NOTE_TRIGGER);
  if (!found || found.index === undefined) return null;
  const rest = message.slice(found.index + found[0].length).trim() || message;
  const title = rest.length > 48 ? `${rest.slice(0, 48).trim()}…` : rest;
  return { score: SCORE.note_saver, args: { title: title || "Untitled note", body: rest } };
}

const WEATHER_TRIGGER = /\b(weather|forecast|humidity|is it (hot|cold|raining|sunny)|temperature outside)\b/i;
// Case-insensitive on purpose: "weather in tokyo" has to find the city too.
// A capital-letter-only rule silently reported "your area" for anything typed
// in lower case. "in" is tried before the weaker connectors so "forecast for
// tomorrow in Paris" resolves to Paris, not to "tomorrow".
const CITY_WORD = "[a-z][a-z'.\\-]*";
const CITY_PHRASE = `${CITY_WORD}(?:\\s+${CITY_WORD}){0,2}`;
const CITY_PATTERNS = [
  new RegExp(`\\bin\\s+(${CITY_PHRASE})\\s*(?:[?.!,]|$)`, "i"),
  new RegExp(`\\b(?:for|near|at)\\s+(${CITY_PHRASE})\\s*(?:[?.!,]|$)`, "i"),
];
const CITY_STOPWORDS = new Set(["the", "a", "an", "my", "your", "here", "there", "town", "outside"]);

function titleCase(text: string): string {
  return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function matchWeather(message: string): Match | null {
  if (!WEATHER_TRIGGER.test(message)) return null;
  let city = "your area";
  for (const pattern of CITY_PATTERNS) {
    const found = message.match(pattern);
    const raw = found ? found[1].trim().replace(/\s+/g, " ") : "";
    if (raw && !CITY_STOPWORDS.has(raw.toLowerCase())) {
      city = titleCase(raw);
      break;
    }
  }
  return { score: SCORE.weather, args: { city } };
}

const MATCHERS: Record<ToolId, (message: string) => Match | null> = {
  calculator: matchCalculator,
  unit_converter: matchUnitConverter,
  note_saver: matchNoteSaver,
  weather: matchWeather,
};

export interface MockPick {
  tool: ToolId;
  mockJson: string;
}

export function routeMock(message: string, enabledTools: ToolId[]): MockPick | null {
  let best: { tool: ToolId; match: Match } | null = null;
  for (const tool of enabledTools) {
    const match = MATCHERS[tool](message);
    if (match && (best === null || match.score > best.match.score)) {
      best = { tool, match };
    }
  }
  if (!best) return null;
  return { tool: best.tool, mockJson: JSON.stringify(best.match.args) };
}
