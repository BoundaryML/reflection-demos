// ═════════════════════════════════════════════════════════════════════════
// The one LLM function in the package.
//
// The notebook needs no API key to be useful — everything else here is pure.
// With MOCK_LLM=1 this renders the real prompt and parses a canned reply
// through the same `$render_prompt` / `$parse` seam the BAML test suite uses,
// so the offline path exercises the identical schema.
// ═════════════════════════════════════════════════════════════════════════

/// What the on-call engineer wants to know before opening the ticket.
class Assessment {
    severity string
    root_cause_guess string
    next_step string
}

function AssessTicket(ticket: Ticket) -> Assessment {
    client: "anthropic/claude-haiku-4-5"
    prompt: `You are the on-call engineer triaging one support ticket.

    Customer: ${ticket.customer} (${ticket.plan} plan)
    Open for: ${Elapsed(ticket.minutes_open)}
    Subject: ${ticket.subject}

    ${ticket.body}

    ${ctx.output_format}`
}

/// Triages a ticket. Offline unless ANTHROPIC_API_KEY is set.
function Assess(ticket: Ticket) -> Assessment throws unknown {
    if (baml.env.get("MOCK_LLM") == "1") {
        AssessTicket$parse(CannedReply(ticket))
    } else {
        AssessTicket(ticket)
    }
}

/// The prompt the model would actually see. Rendering it costs nothing and
/// makes a good notebook cell.
function AssessPrompt(ticket: Ticket) -> string {
    AssessTicket$render_prompt(ticket).text()
}

/// Stands in for the model when there is no key.
function CannedReply(ticket: Ticket) -> string {
    baml.json.encode(Assessment {
        severity: Urgency(ticket),
        root_cause_guess: "Reported by " + ticket.customer + "; scoped to " + ticket.subject.to_lower_case() + ".",
        next_step: "Reproduce on the " + ticket.plan + " plan, then confirm with the customer.",
    })
}
