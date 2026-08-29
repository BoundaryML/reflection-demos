import { pickMockCategory, type CategoryLike } from "./mockClassify.js";

// Loaded lazily (not at module top-level): initializing the generated BAML
// SDK runs the native bridge as an import side effect, so a broken/missing
// local toolchain build would otherwise crash the whole server at startup
// instead of just the classify feature. See README "Troubleshooting".
type BamlSdk = typeof import("../baml_sdk/index.js");
let sdkPromise: Promise<BamlSdk> | undefined;
function loadSdk(): Promise<BamlSdk> {
  if (!sdkPromise) {
    sdkPromise = import("../baml_sdk/index.js").catch((err: unknown) => {
      sdkPromise = undefined; // allow retrying on the next request
      throw err;
    });
  }
  return sdkPromise;
}

export function isMockMode(): boolean {
  return process.env.MOCK_LLM === "1" || !process.env.ANTHROPIC_API_KEY;
}

export interface ClassificationResult {
  category: string;
  mode: "live" | "mock";
}

export interface CategoryForClassification extends CategoryLike {
  id: number;
}

// BuildCategoryType (baml_src/triage.baml) names each enum variant
// `CAT_<id>` — a database id is always a valid identifier, unlike a
// free-typed category name ("Bug Report", "Shipping & Delivery"). The model
// itself never sees `CAT_<id>`; it reads/writes the category's display name
// via the variant's alias. This maps BAML's returned variant name back to
// that display name.
const VARIANT_PATTERN = /^CAT_(\d+)$/;

function resolveVariant(variant: string, categories: CategoryForClassification[]): string {
  const match = VARIANT_PATTERN.exec(variant);
  const id = match ? Number(match[1]) : undefined;
  const found = id !== undefined ? categories.find((c) => c.id === id) : undefined;
  return found?.name ?? variant;
}

/**
 * Classify one ticket against the CURRENT category rows. Both paths mint the
 * same runtime enum type inside baml_src/triage.baml (BuildCategoryType) —
 * the only difference is where the classification comes from: a real model
 * call, or a keyword guess parsed through the same real enum parser.
 */
export async function classifyTicket(
  ticketText: string,
  categories: CategoryForClassification[],
): Promise<ClassificationResult> {
  const sdk = await loadSdk();
  const rows = categories.map(
    (c) => new sdk.CategoryInput({ id: c.id, name: c.name, description: c.description ?? null }),
  );

  if (isMockMode()) {
    const guess = pickMockCategory(ticketText, categories);
    const rawCompletion = JSON.stringify(guess); // the category's display name, as a model would produce it
    const variant = await sdk.ClassifyTicketFromCompletion_async(ticketText, rows, rawCompletion);
    return { category: resolveVariant(variant, categories), mode: "mock" };
  }

  const variant = await sdk.ClassifyTicket_async(ticketText, rows);
  return { category: resolveVariant(variant, categories), mode: "live" };
}
