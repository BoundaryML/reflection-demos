/** Seed content: the marketplace's sample plugins and the documents to run them on. */
import type { PluginField } from "./host.js";

export interface Example {
  id: string;
  label: string;
  vendor: string;
  blurb: string;
  name: string;
  source: string;
  bindings: Record<string, string>;
}

export const CONTRACT_FIELDS = [
  { name: "summary", type: "string" },
  { name: "key_points", type: "string[]" },
] as const;

export const EXAMPLES: Example[] = [
  {
    id: "terse",
    label: "Terse",
    vendor: "Northwind Labs",
    blurb: "Answers the contract and adds a reading-time estimate of its own.",
    name: "Terse",
    source: `class Terse {
  /// one sentence, no throat-clearing
  summary string
  key_points string[]
  /// minutes to read the original
  reading_time_min int
}`,
    bindings: { summary: "summary", key_points: "key_points" },
  },
  {
    id: "bulletbot",
    label: "BulletBot",
    vendor: "bulletbot.dev",
    blurb: "Calls its list \"bullets\". Nothing answers key_points — unless you bind it.",
    name: "BulletBot",
    source: `class BulletBot {
  summary string
  bullets string[]
  tone string
}`,
    bindings: { summary: "summary", key_points: "key_points" },
  },
  {
    id: "legacy",
    label: "Legacy Digest",
    vendor: "Digest Classic",
    blurb: "Ported from the v1 API, where key points were one newline-joined string.",
    name: "LegacyDigest",
    source: `class LegacyDigest {
  summary string
  /// newline separated, like the v1 API
  key_points string
  word_count int
}`,
    bindings: { summary: "summary", key_points: "key_points" },
  },
];

export interface SampleDocument {
  id: string;
  title: string;
  body: string;
}

export const DOCUMENTS: SampleDocument[] = [
  {
    id: "incident",
    title: "Incident review — checkout latency",
    body: `On 12 March the checkout service began returning 504s for roughly 4% of requests. The cause was a connection pool sized for the old payment provider, which holds sockets open twice as long as the previous one. Requests queued behind the pool and timed out at the edge before the pool ever drained.

We resized the pool and added a queue-depth alert. Recovery took 41 minutes, most of it spent confirming the payment provider was healthy. The provider was never at fault.

Follow-ups: size pools from provider latency rather than request rate, and page on queue depth instead of error rate, which lags by minutes.`,
  },
  {
    id: "release",
    title: "Release notes — Atlas 4.2",
    body: `Atlas 4.2 replaces the query planner with a cost-based planner. Most workloads see the same plans; joins across more than four tables are where the change shows up, and those get between 20% and 60% faster in our benchmarks.

Import jobs now stream instead of buffering, so a 2 GB CSV no longer needs 2 GB of memory. The old buffering path is still available behind a flag for one more release.

Breaking: the deprecated /v1/rows endpoint is gone. Use /v2/rows, which takes the same parameters and returns a cursor instead of an offset.`,
  },
  {
    id: "research",
    title: "Paper abstract — sparse retrieval",
    body: `We revisit sparse lexical retrieval and show that a well-tuned BM25 baseline remains competitive with dense retrievers on out-of-domain benchmarks, while costing an order of magnitude less to index.

Our contribution is a hybrid scorer that keeps the sparse index as the first stage and applies a small cross-encoder to the top 50 candidates. On BEIR the hybrid matches the best dense model on 11 of 18 datasets and beats it on 4, at a fifth of the index footprint.

We release the index and the scorer. The main limitation is latency variance under bursty load, which the cross-encoder stage dominates.`,
  },
];

const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "from", "this", "into", "than", "which",
  "were", "was", "are", "our", "their", "them", "they", "when", "what", "have",
  "has", "had", "not", "but", "its", "it's", "over", "under", "more", "most",
  "some", "each", "also", "been", "will", "would", "could", "should",
]);

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function topics(text: string, count: number): string[] {
  const seen = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (STOPWORDS.has(raw)) continue;
    seen.set(raw, (seen.get(raw) ?? 0) + 1);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

/**
 * Build a canned model response shaped to one plugin's runtime schema.
 *
 * This is mock mode: the real prompt is still rendered from the plugin's type,
 * and the reply below still goes through the real parser, exactly the way the
 * BAML test suite exercises the LLM seam.
 */
export function cannedResponse(fields: PluginField[], document: string): string {
  const lines = sentences(document);
  const lead = lines[0] ?? document.slice(0, 160);
  const rest = lines.length > 3 ? lines.slice(1) : lines;
  const points = rest.slice(0, 3).map((s) => clip(s, 90));
  const words = document.split(/\s+/).filter(Boolean).length;

  const value = (field: PluginField): unknown => {
    const name = field.name.toLowerCase();
    const optional = field.type.endsWith("?");
    const type = optional ? field.type.slice(0, -1) : field.type;
    const array = type.endsWith("[]");
    const base = array ? type.slice(0, -2) : type;

    const named = (): unknown | undefined => {
      if (/summar|abstract|tldr|gist|digest/.test(name)) {
        return array ? points : clip(lead, 180);
      }
      if (/point|bullet|highlight|takeaway|finding/.test(name)) {
        return array ? points : points.join("\n");
      }
      if (/tag|topic|keyword|label/.test(name)) {
        const words3 = topics(document, 3);
        return array ? words3 : words3.join(", ");
      }
      if (/word|count/.test(name) && base === "int") return words;
      if (/time|minute|read/.test(name) && (base === "int" || base === "float")) {
        return Math.max(1, Math.round(words / 200));
      }
      if (/sentiment|tone|mood/.test(name)) return array ? ["neutral"] : "neutral";
      if (/confidence|score|rating/.test(name)) return base === "int" ? 8 : 0.82;
      if (/urgent|action|flag|needs/.test(name) && base === "bool") return true;
      return undefined;
    };

    const hinted = named();
    if (hinted !== undefined) return hinted;

    const scalar = (): unknown => {
      switch (base) {
        case "string":
          return clip(lead, 120);
        case "int":
          return words;
        case "float":
          return 0.5;
        case "bool":
          return true;
        default:
          return optional ? null : clip(lead, 120);
      }
    };
    return array ? [scalar(), scalar()] : scalar();
  };

  const body: Record<string, unknown> = {};
  for (const field of fields) body[field.name] = value(field);
  return JSON.stringify(body);
}
