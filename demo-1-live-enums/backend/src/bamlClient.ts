import { CategoryInput, ClassifyTicket_async } from "../baml_sdk/index.js";

export interface CategoryForClassification {
  id: number;
  name: string;
  description: string | null;
}

// ClassifyTicket returns the variant name (`CAT_<id>`); map it back to the
// category's display name using the rows we already have.
export async function classifyTicket(
  ticketText: string,
  categories: CategoryForClassification[],
): Promise<string> {
  const rows = categories.map(
    (c) => new CategoryInput({ id: c.id, name: c.name, description: c.description }),
  );
  const variant = await ClassifyTicket_async(ticketText, rows);
  const id = /^CAT_(\d+)$/.exec(variant)?.[1];
  return categories.find((c) => c.id === Number(id))?.name ?? variant;
}
