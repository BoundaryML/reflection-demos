// ═════════════════════════════════════════════════════════════════════════
// The one LLM function in the package. Everything else here is pure.
// ═════════════════════════════════════════════════════════════════════════

/// What the on-call engineer wants to know before opening the ticket.
class Assessment {
    severity string
    root_cause_guess string
    next_step string
}

/// Triages a ticket with the model.
/// Whichever provider the user has a key for; OpenAI wins when both are set.
function default_client() -> string {
    if (env.OPENAI_API_KEY.get() != null) { "openai/gpt-4o-mini" } else { "anthropic/claude-haiku-4-5" }
}

function Assess(ticket: Ticket) -> Assessment {
    client: default_client()
    prompt: `You are the on-call engineer triaging one support ticket.

    Customer: ${ticket.customer} (${ticket.plan} plan)
    Open for: ${Elapsed(ticket.minutes_open)}
    Subject: ${ticket.subject}

    ${ticket.body}

    ${ctx.output_format()}`
}

/// The prompt the model would actually see. Rendering it costs nothing and
/// makes a good notebook cell.
function AssessPrompt(ticket: Ticket) -> string {
    Assess$render_prompt(ticket).text()
}
