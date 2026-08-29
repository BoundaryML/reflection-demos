import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "triage.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    received_at TEXT NOT NULL,
    category TEXT,
    classified_at TEXT
  );
`);

export interface CategoryRow {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface TicketRow {
  id: number;
  customer: string;
  subject: string;
  body: string;
  received_at: string;
  category: string | null;
  classified_at: string | null;
}

const DEFAULT_CATEGORIES: Array<{ name: string; description: string }> = [
  {
    name: "Billing",
    description: "Payments, charges, refunds, invoices, and subscription costs.",
  },
  {
    name: "Bug Report",
    description: "Something in the product is broken, crashing, or behaving incorrectly.",
  },
  {
    name: "Feature Request",
    description: "A suggestion or request for new product functionality.",
  },
  {
    name: "Account Access",
    description: "Login, password, authentication, or account-recovery issues.",
  },
  {
    name: "Shipping & Delivery",
    description: "Questions about order shipment, tracking, or delivery problems.",
  },
  {
    name: "General Feedback",
    description: "Praise, complaints, or feedback that isn't a specific request.",
  },
];

const DEFAULT_TICKETS: Array<{
  customer: string;
  subject: string;
  body: string;
  received_at: string;
}> = [
  {
    customer: "Maria Chen",
    subject: "Charged twice this month",
    body: "I just noticed two separate charges of $29 on my card this week for what should be a single subscription. Can someone look into this and refund the duplicate?",
    received_at: "2026-08-15T09:12:00Z",
  },
  {
    customer: "Devon Brooks",
    subject: "App crashes when exporting a report",
    body: "Every time I click 'Export to PDF' on the analytics dashboard, the app freezes for a few seconds and then closes entirely. Happens on both Chrome and Safari.",
    received_at: "2026-08-15T11:47:00Z",
  },
  {
    customer: "Priya Natarajan",
    subject: "Would love a dark mode option",
    body: "Using the app late at night is rough on the eyes. Any chance dark mode is on the roadmap? Happy to help test it.",
    received_at: "2026-08-15T14:03:00Z",
  },
  {
    customer: "Sam O'Rourke",
    subject: "Locked out of my account",
    body: "I reset my password twice but I still can't log in — it says 'invalid credentials' every time. This is blocking my whole team.",
    received_at: "2026-08-16T08:21:00Z",
  },
  {
    customer: "Grace Kim",
    subject: "Order arrived with a broken screen",
    body: "The monitor I ordered last week showed up with a cracked corner. Box looked fine from outside but the unit is damaged.",
    received_at: "2026-08-16T10:05:00Z",
  },
  {
    customer: "Tom Alvarez",
    subject: "How do I export my data as CSV?",
    body: "I need to pull all of my project data into a spreadsheet for an audit. Is there a built-in export option, or do I need the API?",
    received_at: "2026-08-16T13:30:00Z",
  },
  {
    customer: "Renee Fischer",
    subject: "Just wanted to say thanks!",
    body: "Your support team walked me through a tricky migration yesterday and were incredibly patient. Really appreciated the help.",
    received_at: "2026-08-16T15:55:00Z",
  },
  {
    customer: "Wei Zhang",
    subject: "Refund for order #48213",
    body: "I canceled my order within the return window but haven't seen the refund hit my account after 10 business days. Order number is #48213.",
    received_at: "2026-08-17T07:40:00Z",
  },
  {
    customer: "Amara Okafor",
    subject: "API returns 500 on user creation",
    body: "POST /v1/users has been returning a 500 error since this morning. Worked fine yesterday, no changes on our end. Here's a sample request body if it helps.",
    received_at: "2026-08-17T08:58:00Z",
  },
  {
    customer: "Jordan Lee",
    subject: "Please cancel my subscription",
    body: "We're consolidating tools on our team and no longer need this account. Please cancel my subscription effective immediately and confirm.",
    received_at: "2026-08-17T09:44:00Z",
  },
  {
    customer: "Isabelle Moreau",
    subject: "Still waiting after three weeks",
    body: "I reached out about a missing shipment three weeks ago and still don't have a resolution or my package. This is really frustrating at this point.",
    received_at: "2026-08-17T10:16:00Z",
  },
];

function seedIfEmpty() {
  const categoryCount = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
  if (categoryCount === 0) {
    const insert = db.prepare(
      "INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)",
    );
    DEFAULT_CATEGORIES.forEach((c, i) => insert.run(c.name, c.description, i));
  }

  const ticketCount = (db.prepare("SELECT COUNT(*) AS n FROM tickets").get() as { n: number }).n;
  if (ticketCount === 0) {
    const insert = db.prepare(
      "INSERT INTO tickets (customer, subject, body, received_at) VALUES (?, ?, ?, ?)",
    );
    DEFAULT_TICKETS.forEach((t) => insert.run(t.customer, t.subject, t.body, t.received_at));
  }
}

seedIfEmpty();

export function listCategories(): CategoryRow[] {
  return db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all() as CategoryRow[];
}

/** Category names are UNIQUE; this is the one constraint a user can trip. */
export class DuplicateCategoryName extends Error {
  constructor(readonly name: string) {
    super(`a category named "${name}" already exists`);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
}

export function addCategory(name: string, description: string | null): CategoryRow {
  const maxOrder = (
    db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories").get() as { m: number }
  ).m;
  const trimmed = name.trim();
  let info;
  try {
    info = db
      .prepare("INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)")
      .run(trimmed, description, maxOrder + 1);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCategoryName(trimmed);
    throw err;
  }
  return db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid) as CategoryRow;
}

export function updateCategory(
  id: number,
  fields: { name?: string; description?: string | null },
): CategoryRow | undefined {
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as CategoryRow | undefined;
  if (!existing) return undefined;
  const name = fields.name !== undefined ? fields.name.trim() : existing.name;
  const description = fields.description !== undefined ? fields.description : existing.description;
  try {
    db.prepare("UPDATE categories SET name = ?, description = ? WHERE id = ?").run(name, description, id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateCategoryName(name);
    throw err;
  }
  return db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as CategoryRow;
}

export function deleteCategory(id: number): boolean {
  const info = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  return info.changes > 0;
}

export function listTickets(): TicketRow[] {
  return db.prepare("SELECT * FROM tickets ORDER BY received_at ASC, id ASC").all() as TicketRow[];
}

export function getTicket(id: number): TicketRow | undefined {
  return db.prepare("SELECT * FROM tickets WHERE id = ?").get(id) as TicketRow | undefined;
}

export function setTicketClassification(id: number, category: string): TicketRow | undefined {
  db.prepare("UPDATE tickets SET category = ?, classified_at = ? WHERE id = ?").run(
    category,
    new Date().toISOString(),
    id,
  );
  return getTicket(id);
}
