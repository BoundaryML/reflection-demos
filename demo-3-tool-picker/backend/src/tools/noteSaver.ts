import { db } from "../db.js";

export interface NoteSaverArgs {
  title: string;
  body: string;
}

export interface NoteSaverResult {
  id: number;
  title: string;
  body: string;
  created_at: string;
  summary: string;
}

const insert = db.prepare("INSERT INTO notes (title, body) VALUES (?, ?)");
const findById = db.prepare("SELECT id, title, body, created_at FROM notes WHERE id = ?");

export function runNoteSaver(args: NoteSaverArgs): NoteSaverResult {
  const info = insert.run(args.title, args.body);
  const row = findById.get(info.lastInsertRowid) as Omit<NoteSaverResult, "summary">;
  return {
    ...row,
    summary: `Saved note #${row.id}: "${row.title}"`,
  };
}

export function listNotes(): NoteSaverResult[] {
  const rows = db
    .prepare("SELECT id, title, body, created_at FROM notes ORDER BY id DESC")
    .all() as Omit<NoteSaverResult, "summary">[];
  return rows.map((row) => ({ ...row, summary: `Saved note #${row.id}: "${row.title}"` }));
}
