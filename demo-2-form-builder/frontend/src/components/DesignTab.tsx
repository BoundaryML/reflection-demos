import { useState } from "react";
import { api } from "../api";
import type { FieldKind, FormField } from "../types";

const KIND_LABEL: Record<FieldKind, string> = {
  text: "Text",
  number: "Number",
  dropdown: "Dropdown",
  bulleted_list: "Bullet list",
};

interface Props {
  fields: FormField[];
  loading: boolean;
  onChange: () => void;
  onDone: () => void;
}

export default function DesignTab({ fields, loading, onChange, onDone }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FieldKind>("text");
  const [options, setOptions] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.addField({
        name,
        kind,
        options: options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
        description,
      });
      setName("");
      setOptions("");
      setDescription("");
      setKind("text");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to add field");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await api.deleteField(id);
    onChange();
  }

  async function loadPreset(preset: "doctor" | "realestate") {
    setBusy(true);
    setError(null);
    try {
      await api.loadPreset(preset);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load preset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="design-tab">
      <section className="panel">
        <h2>Starter templates</h2>
        <p className="hint">
          Load one, then tweak it below — add, remove, or rename fields freely.
        </p>
        <div className="preset-buttons">
          <button onClick={() => loadPreset("doctor")} disabled={busy}>
            Doctor visit form
          </button>
          <button onClick={() => loadPreset("realestate")} disabled={busy}>
            Real estate listing form
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Add a field</h2>
        <form className="field-form" onSubmit={submit}>
          <label>
            Field name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. chief_complaint"
              required
            />
          </label>
          <label>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as FieldKind)}>
              {Object.entries(KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {kind === "dropdown" && (
            <label>
              Options (comma-separated)
              <input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="e.g. active, pending, sold"
                required
              />
            </label>
          )}
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="what should the model look for?"
            />
          </label>
          <button type="submit" disabled={busy}>
            Add field
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <h2>Your form ({fields.length} field{fields.length === 1 ? "" : "s"})</h2>
        {loading ? (
          <p className="hint">Loading…</p>
        ) : fields.length === 0 ? (
          <p className="hint">No fields yet — add one above or load a starter.</p>
        ) : (
          <ul className="field-list">
            {fields.map((field) => (
              <li key={field.id} className="field-row">
                <div>
                  <span className="field-name">{field.name}</span>
                  <span className="field-kind">{KIND_LABEL[field.kind]}</span>
                  {field.kind === "dropdown" && (
                    <span className="field-options">
                      {field.options.join(" · ")}
                    </span>
                  )}
                  {field.description && (
                    <p className="field-desc">{field.description}</p>
                  )}
                </div>
                <button className="remove" onClick={() => remove(field.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {fields.length > 0 && (
          <button className="cta" onClick={onDone}>
            Extract into this form →
          </button>
        )}
      </section>
    </div>
  );
}
