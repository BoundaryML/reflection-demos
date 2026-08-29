import type { ContractField, Example } from "../api.js";
import { className, declaredFields } from "../api.js";

export interface Draft {
  exampleId: string | null;
  vendor: string;
  source: string;
  bindings: Record<string, string>;
}

export function SubmitPanel({
  contract,
  examples,
  draft,
  busy,
  onDraft,
  onPick,
  onInstall,
}: {
  contract: ContractField[];
  examples: Example[];
  draft: Draft;
  busy: boolean;
  onDraft: (next: Draft) => void;
  onPick: (example: Example) => void;
  onInstall: () => void;
}) {
  const declared = declaredFields(draft.source);
  const name = className(draft.source);

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Submit a plugin</h2>
          <p className="sub">
            Anyone can publish. Digest checks the submission against the contract before it
            becomes callable.
          </p>
        </div>
      </header>

      <div className="chips">
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            className={`chip${draft.exampleId === example.id ? " chip-on" : ""}`}
            onClick={() => onPick(example)}
          >
            {example.label}
          </button>
        ))}
      </div>

      {draft.exampleId && (
        <p className="blurb">
          {examples.find((e) => e.id === draft.exampleId)?.blurb}
        </p>
      )}

      <label className="field">
        <span className="field-label">Plugin source</span>
        <textarea
          className="editor"
          spellCheck={false}
          rows={Math.max(8, draft.source.split("\n").length + 1)}
          value={draft.source}
          onChange={(event) =>
            onDraft({ ...draft, exampleId: null, source: event.target.value })
          }
        />
      </label>

      <div className="bindings">
        <span className="field-label">Contract bindings</span>
        {contract.map((field) => {
          const value = draft.bindings[field.name] ?? field.name;
          const options = declared.includes(value) ? declared : [...declared, value];
          return (
            <div className="binding" key={field.name}>
              <code className="binding-from">{field.name}</code>
              <span className="binding-arrow">is answered by</span>
              <select
                value={value}
                onChange={(event) =>
                  onDraft({
                    ...draft,
                    bindings: { ...draft.bindings, [field.name]: event.target.value },
                  })
                }
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {declared.includes(option) ? option : `${option} — not declared`}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="actions">
        <button className="primary" type="button" disabled={busy || !name} onClick={onInstall}>
          {busy ? "Checking…" : `Install ${name || "plugin"}`}
        </button>
        <span className="actions-note">
          {name ? `declares class ${name}` : "your plugin must declare a class"}
        </span>
      </div>
    </section>
  );
}
