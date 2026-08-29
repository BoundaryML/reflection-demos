import { useEffect, useState } from "react";
import { api } from "../api";
import type { FormField, SeedId } from "../types";

interface Props {
  fields: FormField[];
}

export default function ExtractTab({ fields }: Props) {
  const [seeds, setSeeds] = useState<Record<SeedId, string> | null>(null);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [wasMock, setWasMock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.seeds().then(setSeeds).catch(() => setSeeds(null));
  }, []);

  async function runExtraction(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const outcome = await api.extract(transcript);
      setResult(outcome.fields);
      setWasMock(outcome.mock);
    } catch (err) {
      setError(err instanceof Error ? err.message : "extraction failed");
    } finally {
      setBusy(false);
    }
  }

  if (fields.length === 0) {
    return (
      <div className="panel">
        <p className="hint">
          Design a form first — add at least one field on the Design tab.
        </p>
      </div>
    );
  }

  return (
    <div className="extract-tab">
      <section className="panel">
        <h2>Paste unstructured text</h2>
        {seeds && (
          <div className="preset-buttons">
            <button onClick={() => setTranscript(seeds.doctor)}>
              Use sample: doctor visit
            </button>
            <button onClick={() => setTranscript(seeds.realestate)}>
              Use sample: real estate listing
            </button>
          </div>
        )}
        <form onSubmit={runExtraction}>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste a transcript, listing description, note — anything unstructured…"
            rows={10}
            required
          />
          <button type="submit" className="cta" disabled={busy}>
            {busy ? "Extracting…" : "Extract"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="panel filled-form">
          <h2>
            Filled form
            <span className={`mode-badge ${wasMock ? "mode-mock" : "mode-live"}`}>
              {wasMock ? "mock" : "live"}
            </span>
          </h2>
          <dl>
            {fields.map((field) => (
              <FilledField key={field.id} field={field} value={result[field.name]} />
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

function FilledField({ field, value }: { field: FormField; value: string | undefined }) {
  const items =
    field.kind === "bulleted_list" && value
      ? value.split("; ").filter(Boolean)
      : null;

  return (
    <div className="filled-field">
      <dt>{field.name}</dt>
      <dd>
        {items ? (
          <ul>
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : field.kind === "dropdown" ? (
          <span className="pill">{value}</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
