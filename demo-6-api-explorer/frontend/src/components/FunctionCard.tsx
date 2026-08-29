import { useState } from "react";
import type { FunctionInfo, InvokeResult } from "../types";
import { invoke } from "../api";
import { DynamicForm } from "./DynamicForm";
import { ResultView } from "./ResultView";

function shortName(qualifiedName: string): string {
  return qualifiedName.replace(/^root\./, "");
}

/**
 * Drops the namespace from each member of a reflected throws union so the badge
 * stays one line. LLM functions inherit the builtin error union, which reflects
 * as `baml.errors.InvalidArgument | baml.errors.UnknownError | ...` — accurate,
 * but four fully-qualified names swamp the card. The unabridged string stays in
 * the badge's tooltip.
 */
function shortThrows(typeName: string): string {
  return typeName
    .split("|")
    .map((member) => member.trim().replace(/^.*\./, ""))
    .join(" | ");
}

export function FunctionCard({ fn }: { fn: FunctionInfo }) {
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(args: Record<string, string>) {
    setLoading(true);
    setResult(null);
    try {
      const r = await invoke(fn.name, args);
      setResult(r);
    } catch {
      setResult({
        ok: false,
        value: null,
        error_type: "NetworkError",
        error_message: "Could not reach the backend.",
      });
    } finally {
      setLoading(false);
    }
  }

  const throws = fn.throws_type_name !== "never";

  return (
    <article className="function-card">
      <header>
        <h2>{shortName(fn.name)}</h2>
        <div className="badges">
          <span className="badge badge-returns" title="reflected return type">
            → {fn.returns_type_name}
          </span>
          {throws && (
            <span className="badge badge-throws" title={`reflected throws type: ${fn.throws_type_name}`}>
              throws {shortThrows(fn.throws_type_name)}
            </span>
          )}
        </div>
      </header>
      {fn.docstring && <p className="docstring">{fn.docstring}</p>}
      <DynamicForm params={fn.params} disabled={loading} onSubmit={handleSubmit} />
      {result && <ResultView result={result} />}
    </article>
  );
}
