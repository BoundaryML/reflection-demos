import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(here, "..", "form-builder.sqlite3");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL
  )
`);

export type FieldKind = "text" | "number" | "dropdown" | "bulleted_list";

export interface FormField {
  id: number;
  name: string;
  kind: FieldKind;
  options: string[];
  description: string;
  position: number;
}

interface FieldRow {
  id: number;
  name: string;
  kind: string;
  options: string;
  description: string;
  position: number;
}

function rowToField(row: FieldRow): FormField {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as FieldKind,
    options: JSON.parse(row.options) as string[],
    description: row.description,
    position: row.position,
  };
}

export function listFields(): FormField[] {
  const rows = db
    .prepare("SELECT * FROM fields ORDER BY position ASC, id ASC")
    .all() as FieldRow[];
  return rows.map(rowToField);
}

export function addField(input: {
  name: string;
  kind: FieldKind;
  options: string[];
  description: string;
}): FormField {
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM fields")
    .get() as { maxPos: number };
  const info = db
    .prepare(
      "INSERT INTO fields (name, kind, options, description, position) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      input.name,
      input.kind,
      JSON.stringify(input.options),
      input.description,
      maxPos.maxPos + 1,
    );
  const row = db
    .prepare("SELECT * FROM fields WHERE id = ?")
    .get(info.lastInsertRowid) as FieldRow;
  return rowToField(row);
}

export function deleteField(id: number): boolean {
  const info = db.prepare("DELETE FROM fields WHERE id = ?").run(id);
  return info.changes > 0;
}

export function replaceAllFields(
  inputs: Array<{
    name: string;
    kind: FieldKind;
    options: string[];
    description: string;
  }>,
): FormField[] {
  const clear = db.prepare("DELETE FROM fields");
  const insert = db.prepare(
    "INSERT INTO fields (name, kind, options, description, position) VALUES (?, ?, ?, ?, ?)",
  );
  const txn = db.transaction(
    (rows: typeof inputs) => {
      clear.run();
      rows.forEach((row, index) => {
        insert.run(
          row.name,
          row.kind,
          JSON.stringify(row.options),
          row.description,
          index,
        );
      });
    },
  );
  txn(inputs);
  return listFields();
}

export default db;
