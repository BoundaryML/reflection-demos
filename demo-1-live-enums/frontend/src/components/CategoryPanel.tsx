import { useState } from "react";
import type { Category } from "../types";
import { categoryColorVar } from "../categoryColor";

interface Props {
  categories: Category[];
  onAdd: (name: string, description: string | null) => Promise<void>;
  onUpdate: (id: number, fields: { name?: string; description?: string | null }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function CategoryPanel({ categories, onAdd, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setDraftName(cat.name);
    setDraftDescription(cat.description ?? "");
  }

  async function saveEdit() {
    if (editingId === null) return;
    const name = draftName.trim();
    if (!name) return;
    await onUpdate(editingId, { name, description: draftDescription.trim() || null });
    setEditingId(null);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await onAdd(name, newDescription.trim() || null);
      setNewName("");
      setNewDescription("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="categories-heading">
      <div className="panel-header">
        <h2 id="categories-heading">Categories</h2>
        <p className="panel-subtitle">Edit this list, then re-run triage. No code, no redeploy.</p>
      </div>

      <ul className="category-list">
        {categories.map((cat) => (
          <li key={cat.id} className="category-row">
            {editingId === cat.id ? (
              <form
                className="category-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveEdit();
                }}
              >
                <input
                  className="text-input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  autoFocus
                  aria-label="Category name"
                />
                <textarea
                  className="text-input textarea"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Description shown to the model (optional)"
                  aria-label="Category description"
                  rows={2}
                />
                <div className="row-actions">
                  <button type="submit" className="btn btn-primary btn-small">
                    Save
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <span className="category-dot" style={{ background: categoryColorVar(cat.id) }} aria-hidden />
                <div className="category-text">
                  <div className="category-name">{cat.name}</div>
                  {cat.description ? <div className="category-description">{cat.description}</div> : null}
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-small" onClick={() => startEdit(cat)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={() => void onDelete(cat.id)}
                    aria-label={`Remove ${cat.name}`}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        {categories.length === 0 ? <li className="empty-hint">No categories yet — add one below.</li> : null}
      </ul>

      <form className="add-category-form" onSubmit={submitAdd}>
        <input
          className="text-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          aria-label="New category name"
        />
        <textarea
          className="text-input textarea"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description shown to the model (optional)"
          aria-label="New category description"
          rows={2}
        />
        <button type="submit" className="btn btn-primary btn-small" disabled={adding || !newName.trim()}>
          Add category
        </button>
      </form>
    </section>
  );
}
