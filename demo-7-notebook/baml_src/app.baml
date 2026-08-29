// ═════════════════════════════════════════════════════════════════════════
// The production package.
//
// Nothing here knows a notebook exists. It is ordinary application code:
// the domain types and the functions the support team already ships.
// The notebook mounts this package as `app`, so any cell can call it.
// ═════════════════════════════════════════════════════════════════════════

/// One row of the support inbox.
class Ticket {
    id string
    subject string
    body string
    customer string
    plan string
    minutes_open int
}

/// The live inbox. In the real service this reads the tickets table.
function LoadTickets() -> Ticket[] {
    [
        Ticket {
            id: "SUP-1041",
            subject: "Checkout returns 500 on annual plans",
            body: "Every attempt to switch from monthly to annual fails at the confirm step. Card is fine, we tried three.",
            customer: "Northwind Labs",
            plan: "enterprise",
            minutes_open: 214,
        },
        Ticket {
            id: "SUP-1042",
            subject: "Export CSV is missing the tax column",
            body: "Downloaded invoices for March. The tax column is blank for every EU customer.",
            customer: "Halcyon",
            plan: "growth",
            minutes_open: 96,
        },
        Ticket {
            id: "SUP-1043",
            subject: "How do I rotate an API key?",
            body: "I could not find rotation in the dashboard. Is it self-serve or do I file a request?",
            customer: "Ari Fadel",
            plan: "starter",
            minutes_open: 31,
        },
        Ticket {
            id: "SUP-1044",
            subject: "Webhook retries stopped after the 2.4 upgrade",
            body: "We used to get five retries with backoff. Since Tuesday a failed delivery is dropped immediately.",
            customer: "Northwind Labs",
            plan: "enterprise",
            minutes_open: 402,
        },
        Ticket {
            id: "SUP-1045",
            subject: "Seat count wrong after removing a teammate",
            body: "Removed one seat but billing still shows the old count. Invoice preview is off by one.",
            customer: "Pemberton",
            plan: "growth",
            minutes_open: 58,
        },
        Ticket {
            id: "SUP-1046",
            subject: "Feature request: dark mode for the status page",
            body: "The status page is the only thing left that burns my eyes at 3am during an incident.",
            customer: "Halcyon",
            plan: "growth",
            minutes_open: 12,
        },
    ]
}

/// Look a ticket up by id.
function GetTicket(id: string) -> Ticket throws string {
    LoadTickets().find((ticket) -> { ticket.id == id }) ?? throw "no ticket with id " + id
}

/// The on-call priority rule: plan tier, aged by how long the ticket has sat.
function Urgency(ticket: Ticket) -> string {
    let weight = if (ticket.plan == "enterprise") { 3 } else if (ticket.plan == "growth") { 2 } else { 1 }
    let score = weight * 60 + ticket.minutes_open
    if (score > 300) { "P1" } else if (score > 150) { "P2" } else { "P3" }
}

/// A one-line headline for dashboards and digests.
function Headline(ticket: Ticket) -> string {
    ticket.id + " · " + ticket.customer + " · " + ticket.subject
}

/// Url-safe slug, used for incident channel names.
function Slug(text: string) -> string {
    text.to_lower_case()
        .chars()
        .map((ch) -> { if (ch.is_ascii_alphanumeric()) { ch } else { " " } })
        .join("")
        .split(" ")
        .filter((word) -> { word.length() > 0 })
        .join("-")
}

/// Minutes rendered the way the on-call rota writes them.
function Elapsed(minutes: int) -> string {
    if (minutes < 60) {
        minutes.to_string() + "m"
    } else {
        (minutes / 60).to_string() + "h " + (minutes % 60).to_string() + "m"
    }
}
