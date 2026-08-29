import { useState } from "react";
import type { Note } from "../api.js";

export default function NotesPanel({ notes }: { notes: Note[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="notes-panel">
      <button type="button" className="notes-toggle" onClick={() => setOpen((v) => !v)}>
        Saved notes ({notes.length}) {open ? "▲" : "▼"}
      </button>
      {open ? (
        <div className="notes-list">
          {notes.length === 0 ? (
            <p className="notes-empty">Nothing saved yet — ask the assistant to remember something.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="note-item">
                <span className="note-item-title">{note.title}</span>
                <span className="note-item-body">{note.body}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
