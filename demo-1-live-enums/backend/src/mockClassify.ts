// Keyword-rule "model" used when no API key is configured (MOCK_LLM=1, or no
// ANTHROPIC_API_KEY at all). It scores every ticket against the CURRENT
// category list — never a hardcoded switch on category names — so it keeps
// producing plausible guesses after the categories are edited in the UI.
// The guess is still routed through the real BAML enum parser
// (ClassifyTicketFromCompletion in baml_src/triage.baml), so mock mode proves
// the same reflection path the live model would exercise.
//
// Three properties matter for the demo, and they are why this is tf-idf-ish
// rather than a plain keyword hit count:
//
//  1. Renaming a category must not lose its meaning. Vocabulary is drawn from
//     the name AND the description, and topical synonyms are keyed by word
//     stem, so "Bug Report" renamed to "Technical Issue" still inherits the
//     crash/error vocabulary from its description.
//  2. Words that show up in several categories ("request", "issue") must not
//     decide the answer. Each term is weighted by inverse document frequency
//     across the current category list, so shared words fade automatically.
//  3. Ranking must be stable and explainable. No randomness, no network.

export interface CategoryLike {
  name: string;
  description: string | null;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "your", "you",
  "are", "was", "were", "been", "will", "can", "not", "but", "all", "any",
  "our", "its", "what", "who", "how", "why", "when", "just", "still", "into",
  "about", "again", "please", "team", "since", "here", "would", "there",
  "shown", "isn", "don", "get", "got", "one", "two", "out", "off", "own",
]);

// Topical vocabulary expansion, keyed by a word that plausibly appears in a
// category's own name or description. Deliberately topical only: generic
// words like "request" or "report" are NOT keys, because every other category
// borrowing their expansion is what makes a keyword scorer misfire.
// Multi-word entries are matched as phrases against the raw ticket text.
const SYNONYMS: Record<string, string[]> = {
  billing: ["charge", "refund", "invoice", "payment", "subscription", "price", "cost", "billed", "receipt"],
  payment: ["charge", "refund", "invoice", "payment", "subscription", "billed", "card"],
  refund: ["refund", "reimburse", "money back", "return", "charged twice", "credit"],
  invoice: ["invoice", "receipt", "statement"],
  subscription: ["subscription", "plan", "renew", "cancel", "downgrade", "upgrade"],
  charge: ["charge", "billed", "card", "payment"],

  bug: ["bug", "crash", "error", "broken", "freeze", "fail", "500", "hang", "glitch", "stack trace"],
  crash: ["crash", "error", "broken", "freeze", "fail", "500", "hang", "unusable"],
  broken: ["broken", "crash", "error", "fail", "damaged", "500"],
  technical: ["crash", "error", "broken", "fail", "500", "bug", "exception"],
  incorrect: ["wrong", "incorrect", "unexpected", "error"],

  feature: ["feature", "roadmap", "suggestion", "idea", "improve", "enhancement", "dark mode", "support for"],
  suggestion: ["suggestion", "idea", "roadmap", "feature"],
  roadmap: ["roadmap", "planned", "upcoming"],

  account: ["login", "log in", "password", "credential", "locked", "access", "authenticate", "sign in", "reset"],
  access: ["login", "log in", "password", "credential", "locked", "sign in", "permission"],
  login: ["login", "log in", "sign in", "password", "credential"],
  password: ["password", "reset", "credential", "locked out"],

  shipping: ["ship", "shipment", "delivery", "package", "tracking", "arrived", "order", "damaged", "parcel", "courier"],
  delivery: ["shipment", "delivery", "package", "tracking", "arrived", "damaged", "delivered"],
  order: ["order", "shipment", "package", "tracking", "delivered"],

  feedback: ["thank", "appreciate", "great", "helpful", "love", "praise", "frustrating", "disappointed"],
  praise: ["thank", "appreciate", "great", "helpful", "love"],
  // "waiting" is deliberately absent: people wait on refunds, fixes and
  // parcels alike, so it belongs to no category in particular.
  complaint: ["frustrating", "disappointed", "unhappy", "complaint"],

  compliance: ["gdpr", "privacy", "audit", "legal", "policy", "retention", "security review", "dpa"],
  privacy: ["gdpr", "privacy", "personal data", "delete my data"],
  audit: ["audit", "compliance", "export", "records", "log"],
  security: ["security", "vulnerability", "breach", "audit"],
};

// ─── tokenizing ─────────────────────────────────────────────────────────

const SUFFIXES = ["ations", "ation", "ings", "ing", "edly", "ies", "ed", "es", "ly", "ful", "ment", "ness", "s"];
const DOUBLED_TAIL = /([bdfglmnprt])\1$/;

/**
 * Very small suffix stripper. Not linguistically correct — it only has to be
 * *consistent*, so that "crashes" in a ticket and "crashing" in a category
 * description collapse to the same key.
 */
function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  for (const suffix of SUFFIXES) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, w.length - suffix.length);
      break;
    }
  }
  if (w.length > 3 && DOUBLED_TAIL.test(w)) w = w.slice(0, -1); // shipp -> ship
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1); // charge -> charg
  return w;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function stems(text: string): string[] {
  return tokens(text).map(stem);
}

// ─── category vocabulary ────────────────────────────────────────────────

/** Where a term came from, and how much that source is trusted. */
const WEIGHT_NAME = 2.0;
const WEIGHT_DESCRIPTION = 1.2;
const WEIGHT_SYNONYM = 1.0;

interface Vocab {
  /** stem -> weight (highest-weight source wins) */
  terms: Map<string, number>;
  /** multi-word phrase (raw, lowercase) -> weight */
  phrases: Map<string, number>;
}

function put(map: Map<string, number>, key: string, weight: number): void {
  const existing = map.get(key);
  if (existing === undefined || weight > existing) map.set(key, weight);
}

// SYNONYMS is written with readable keys ("shipping"), but category vocabulary
// is stemmed ("ship"), so the lookup table has to be stemmed too. Built once.
const SYNONYMS_BY_STEM = new Map<string, string[]>();
for (const [word, expansion] of Object.entries(SYNONYMS)) {
  const key = stem(word);
  SYNONYMS_BY_STEM.set(key, [...(SYNONYMS_BY_STEM.get(key) ?? []), ...expansion]);
}

function buildVocab(cat: CategoryLike): Vocab {
  const vocab: Vocab = { terms: new Map(), phrases: new Map() };

  const add = (text: string, weight: number): void => {
    for (const t of stems(text)) put(vocab.terms, t, weight);
  };
  add(cat.name, WEIGHT_NAME);
  add(cat.description ?? "", WEIGHT_DESCRIPTION);

  // Expand topical synonyms from whatever words the category actually uses,
  // so the expansion survives a rename as long as the description still
  // describes the same thing.
  for (const seed of [...vocab.terms.keys()]) {
    for (const phrase of SYNONYMS_BY_STEM.get(seed) ?? []) {
      if (phrase.includes(" ")) {
        put(vocab.phrases, phrase, WEIGHT_SYNONYM);
      } else {
        put(vocab.terms, stem(phrase), WEIGHT_SYNONYM);
      }
    }
  }
  return vocab;
}

// ─── scoring ────────────────────────────────────────────────────────────

/** A ticket arrives as "subject\n\nbody"; the subject is the stronger signal. */
const SUBJECT_WEIGHT = 3;

interface TicketSignal {
  /** stem -> subject-weighted occurrence count */
  terms: Map<string, number>;
  /** subject-weighted occurrence count for a raw multi-word phrase */
  phrase: (phrase: string) => number;
}

function ticketSignal(ticketText: string): TicketSignal {
  const split = ticketText.indexOf("\n\n");
  const subject = (split === -1 ? ticketText : ticketText.slice(0, split)).toLowerCase();
  const body = (split === -1 ? "" : ticketText.slice(split + 2)).toLowerCase();

  const terms = new Map<string, number>();
  const bump = (text: string, times: number): void => {
    for (const s of stems(text)) terms.set(s, (terms.get(s) ?? 0) + times);
  };
  bump(subject, SUBJECT_WEIGHT);
  bump(body, 1);

  return {
    terms,
    phrase: (phrase) => SUBJECT_WEIGHT * occurrences(subject, phrase) + occurrences(body, phrase),
  };
}

function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/** log-damped inverse document frequency over the CURRENT category list. */
function inverseDocumentFrequency(vocabs: Vocab[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const vocab of vocabs) {
    for (const key of [...vocab.terms.keys(), ...vocab.phrases.keys()]) {
      df.set(key, (df.get(key) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [key, count] of df) idf.set(key, Math.log(1 + vocabs.length / count));
  return idf;
}

function scoreCategory(vocab: Vocab, signal: TicketSignal, idf: Map<string, number>): number {
  let score = 0;
  const hit = (key: string, weight: number, count: number): void => {
    if (count > 0) score += weight * (idf.get(key) ?? 1) * (1 + Math.log(count));
  };
  for (const [term, weight] of vocab.terms) hit(term, weight, signal.terms.get(term) ?? 0);
  for (const [phrase, weight] of vocab.phrases) hit(phrase, weight, signal.phrase(phrase));
  return score;
}

/**
 * Pick the best-guess category name for `ticketText` from the live list.
 *
 * When nothing matches at all, the guess falls back to the least distinctive
 * category — the one whose wording overlaps the rest of the list the most,
 * which is the closest thing the list has to a catch-all bucket. (A real model
 * has to pick a variant too: the minted enum is exhaustive, there is no
 * "unknown".)
 */
export function pickMockCategory(ticketText: string, categories: CategoryLike[]): string {
  if (categories.length === 0) {
    throw new Error("cannot classify: no categories configured");
  }
  const vocabs = categories.map(buildVocab);
  const idf = inverseDocumentFrequency(vocabs);
  const signal = ticketSignal(ticketText);

  let bestIndex = -1;
  let bestScore = 0;
  categories.forEach((_cat, i) => {
    const score = scoreCategory(vocabs[i]!, signal, idf);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });
  if (bestIndex !== -1) return categories[bestIndex]!.name;

  return categories[leastDistinctive(vocabs, idf)]!.name;
}

/** Index of the category whose vocabulary is most shared with the others. */
function leastDistinctive(vocabs: Vocab[], idf: Map<string, number>): number {
  let bestIndex = 0;
  let bestMean = Number.POSITIVE_INFINITY;
  vocabs.forEach((vocab, i) => {
    const keys = [...vocab.terms.keys(), ...vocab.phrases.keys()];
    if (keys.length === 0) return;
    const mean = keys.reduce((sum, k) => sum + (idf.get(k) ?? 1), 0) / keys.length;
    if (mean < bestMean) {
      bestMean = mean;
      bestIndex = i;
    }
  });
  return bestIndex;
}
