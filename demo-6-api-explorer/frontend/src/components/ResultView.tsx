import type { InvokeResult } from "../types";

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function ResultView({ result }: { result: InvokeResult }) {
  if (result.ok) {
    return (
      <div className="result result-ok">
        <div className="result-label">Result</div>
        <pre>{formatValue(result.value)}</pre>
      </div>
    );
  }
  return (
    <div className="result result-error">
      <div className="result-label">
        Thrown <code className="error-type">{result.error_type}</code>
      </div>
      <pre>{result.error_message}</pre>
    </div>
  );
}
