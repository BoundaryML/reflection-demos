// Live Triage: the category list lives in a database, not in this file.
// There is no `enum Category { ... }` anywhere — ClassifyTicket mints one
// from the current rows on every call. Edit the list in the UI, and the
// very next call sees the change. No redeploy.

/// One row from the team's editable category list.
class CategoryInput {
  id int
  name string
  description string?
}

/// Classify a ticket into `T`. The caller supplies the type — freshly minted, per call.
function Classify<T>(ticket_text: string) -> T {
  client: "anthropic/claude-haiku-4-5"
  prompt: `You are a support triage agent. Read the ticket and choose the single best category for it.

Ticket:
${ticket_text}

${ctx.output_format}`
}

function ClassifyTicket(ticket_text: string, categories: CategoryInput[]) -> string {
  // 1. Mint a runtime enum VALUE from the rows. Variant names are `CAT_<id>`
  //    (always a valid identifier); the alias carries the display name, which
  //    is what the model actually reads and writes.
  let variants: (string | reflect.enum.Value)[] = [];
  for (let c in categories) {
    variants.push(reflect.enum.value("CAT_" + c.id.to_string(), alias = c.name, description = c.description));
  }
  let category_t = reflect.enum.new("Category", variants);

  // 2. Bind that value to a type NAME...
  type C = unreflect(category_t.as_type());

  // 3. ...and make an ordinary generic LLM call over it.
  let picked = Classify<C>(ticket_text);
  reflect.enum.get_value(picked)
}
