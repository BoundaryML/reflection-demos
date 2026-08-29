import { useState } from "react";
import type { Category, Ticket } from "../types";
import { categoryColorVar } from "../categoryColor";

interface Props {
  tickets: Ticket[];
  categories: Category[];
  onClassify: (id: number) => Promise<void>;
  onAdd: (customer: string, subject: string, body: string) => Promise<void>;
  classifyingIds: Set<number>;
}

function formatReceived(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function TicketList({ tickets, categories, onClassify, onAdd, classifyingIds }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newCustomer, setNewCustomer] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const byName = new Map(categories.map((c) => [c.name, c] as const));

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) return;
    setAdding(true);
    try {
      await onAdd(newCustomer, newSubject, newBody);
      setNewCustomer("");
      setNewSubject("");
      setNewBody("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="tickets-heading">
      <div className="panel-header">
        <h2 id="tickets-heading">Inbox</h2>
        <p className="panel-subtitle">{tickets.length} tickets</p>
      </div>

      <ul className="ticket-list">
        {tickets.map((ticket) => {
          const expanded = expandedId === ticket.id;
          const busy = classifyingIds.has(ticket.id);
          const matched = ticket.category ? byName.get(ticket.category) : undefined;
          const stale = Boolean(ticket.category) && !matched;

          return (
            <li key={ticket.id} className="ticket-card">
              <button
                type="button"
                className="ticket-summary"
                onClick={() => setExpandedId(expanded ? null : ticket.id)}
                aria-expanded={expanded}
              >
                <span className="ticket-caret">{expanded ? "▾" : "▸"}</span>
                <span className="ticket-summary-text">
                  <span className="ticket-subject">{ticket.subject}</span>
                  <span className="ticket-meta">
                    {ticket.customer} &middot; {formatReceived(ticket.received_at)}
                  </span>
                </span>
                {ticket.category ? (
                  <span className={`badge${stale ? " badge-stale" : ""}`}>
                    {matched ? (
                      <span
                        className="category-dot"
                        style={{ background: categoryColorVar(matched.id) }}
                        aria-hidden
                      />
                    ) : null}
                    {ticket.category}
                    {stale ? <span className="badge-stale-hint"> &middot; re-run triage</span> : null}
                  </span>
                ) : (
                  <span className="badge badge-empty">Unclassified</span>
                )}
              </button>

              {expanded ? <p className="ticket-body">{ticket.body}</p> : null}

              <div className="ticket-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={busy}
                  onClick={() => void onClassify(ticket.id)}
                >
                  {busy ? "Classifying…" : ticket.category ? "Re-classify" : "Classify"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <form className="add-category-form" onSubmit={(e) => void submitAdd(e)}>
        <input
          className="text-input"
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="New ticket subject"
          aria-label="New ticket subject"
        />
        <textarea
          className="text-input textarea"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="What is the customer writing in?"
          aria-label="New ticket body"
          rows={2}
        />
        <input
          className="text-input"
          value={newCustomer}
          onChange={(e) => setNewCustomer(e.target.value)}
          placeholder="Customer name (optional)"
          aria-label="Customer name"
        />
        <button
          type="submit"
          className="btn btn-primary btn-small"
          disabled={adding || !newSubject.trim() || !newBody.trim()}
        >
          Add ticket
        </button>
      </form>
    </section>
  );
}
