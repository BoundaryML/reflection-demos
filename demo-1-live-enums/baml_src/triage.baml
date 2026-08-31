// ─── Live Triage ────────────────────────────────────────────────────────
//
// The team's category list lives in a database, not in this file. There is
// no `enum Category { BILLING, BUG_REPORT, ... }` declared anywhere below —
// the categories are rows the support team edits in the UI, and BuildCategory
// mints a fresh enum TYPE from those rows on every triage run. Classify is
// generic over that type: rename a category, add one, delete one, and the
// very next call sees the change. No redeploy.

/// One row from the team's editable category list. `id` is the row's
/// database id — used to build a stable, always-valid enum variant name,
/// since `name` is free text a person typed into a form (spaces, "&", ...)
/// and enum variant names must be identifiers. `name` is what the model
/// actually reads and writes, via the variant's alias.
class CategoryInput {
  id int
  name string
  description string?
}

/// Classify a support ticket into `T`. This function never sees a concrete
/// category — the caller supplies one, freshly minted, per call.
function Classify<T>(ticket_text: string) -> T {
  client: "anthropic/claude-haiku-4-5"
  prompt: `You are a support triage agent. Read the ticket and choose the single best category for it.

Ticket:
${ticket_text}

${ctx.output_format}`
}

/// THE REFLECTION CALL: turn the team's current category rows into a real
/// runtime enum type, right now, from data. The variant name is a synthetic
/// `CAT_<id>` (always a valid identifier); `alias` carries the actual
/// category name onto the wire, so that's what the model reads and writes.
function BuildCategoryType(categories: CategoryInput[]) -> reflect.enum.Type throws reflect.errors.CompilationError {
  let rows: (string | reflect.enum.Value)[] = []
  for (let c in categories) {
    rows.push(reflect.enum.value("CAT_" + c.id.to_string(), alias = c.name, description = c.description))
  }
  reflect.enum.new("Category", rows)
}

/// Live path, in three explainable steps: mint the enum from the rows
/// (a runtime VALUE), bind that value to a type NAME with `unreflect`,
/// then call Classify generically over it. Returns the synthetic
/// `CAT_<id>` variant name — the backend maps that back to the category's
/// display name, since it already has the rows.
function ClassifyTicket(ticket_text: string, categories: CategoryInput[]) -> string {
  let category_t = BuildCategoryType(categories)
  type C = unreflect(category_t.as_type())
  let picked = Classify<C>(ticket_text)
  reflect.enum.get_value(picked)
}

/// Mock path: same runtime type, but parse a canned completion instead of
/// calling the model. Proves the category list round-trips through real BAML
/// enum parsing even with no API key configured. `raw_completion` is the
/// category's display name (its alias), e.g. `"Bug Report"` — exactly what
/// a real model would also produce.
function ClassifyTicketFromCompletion(
  ticket_text: string,
  categories: CategoryInput[],
  raw_completion: string,
) -> string {
  let category_t = BuildCategoryType(categories)
  type C = unreflect(category_t.as_type())
  let picked = Classify$parse<C>(raw_completion)
  reflect.enum.get_value(picked)
}
