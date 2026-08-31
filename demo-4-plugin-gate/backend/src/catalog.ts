/** Seed content: the marketplace's sample plugins and the documents to run them on. */

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
