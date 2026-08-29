import type { Diagnostic, Failure } from "../api.js";

interface Marked {
  text: string;
  from: number | null;
  to: number | null;
}

/** Turn a byte-offset span into per-line highlight ranges. */
function markLines(source: string, start: number | null, end: number | null): Marked[] {
  const lines = source.split("\n");
  if (start === null || end === null) return lines.map((text) => ({ text, from: null, to: null }));
  let offset = 0;
  return lines.map((text) => {
    const lineStart = offset;
    const lineEnd = offset + text.length;
    offset = lineEnd + 1;
    if (end < lineStart || start > lineEnd) return { text, from: null, to: null };
    return {
      text,
      from: Math.max(0, start - lineStart),
      to: Math.min(text.length, Math.max(start - lineStart + 1, end - lineStart)),
    };
  });
}

/**
 * Field names the message calls out that this plugin actually declares, so a
 * span-less diagnostic can still point at the offending line.
 */
function calledOut(message: string, source: string): string[] {
  const declared = new Set(
    source
      .split("\n")
      .map((line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z_]/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name)),
  );
  return [...message.matchAll(/`([^`]+)`/g)].map((m) => m[1]!).filter((t) => declared.has(t));
}

function hintFor(message: string): string | null {
  const missing = /links to missing class field `([^`]+)`/.exec(message);
  if (missing) {
    return `Nothing in this plugin answers \`${missing[1]}\`. Point the contract binding at one of the plugin's own fields, or add the field to the class.`;
  }
  const wrong = /requires `([^`]+)`, but class field `([^`]+)` has `([^`]+)`/.exec(message);
  if (wrong) {
    return `\`${wrong[2]}\` is a \`${wrong[3]}\`, and the contract needs a \`${wrong[1]}\`. No binding can bridge that — the plugin has to change.`;
  }
  if (message === "mismatched types") {
    return "This type never passed the contract check, so the bound on the host's call site rejected it.";
  }
  return null;
}

export function DiagnosticPanel({
  failure,
  source,
  tone = "reject",
}: {
  failure: Failure;
  source: string;
  tone?: "reject" | "block";
}) {
  const primary = failure.diagnostics[0];
  // A parse/resolve failure arrives as a pair: the labelled diagnostic plus an
  // empty one pinned at offset 0. Highlight the first span that covers text, and
  // fall back to the name-matching heuristic when none does.
  const span = failure.diagnostics.find(
    (d): d is Diagnostic & { start: number; end: number } =>
      d.start !== null && d.end !== null && d.end > d.start,
  );
  // Those pairs repeat one message; only list the ones that say something new.
  const rest = failure.diagnostics
    .slice(1)
    .filter((d) => d.code !== primary?.code || d.message !== primary.message);
  const highlights = calledOut(failure.message, source);
  const lines = markLines(source, span?.start ?? null, span?.end ?? null);
  const hint = hintFor(failure.message);
  const hasSpan = span !== undefined;

  return (
    <div className={`diagnostic diagnostic-${tone}`}>
      <div className="diagnostic-head">
        <span className="diagnostic-code">{primary?.code ?? "error"}</span>
        <span className="diagnostic-message">{failure.message}</span>
      </div>

      <pre className="code code-annotated">
        {lines.map((line, index) => {
          const pointed =
            !hasSpan && highlights.some((token) => new RegExp(`\\b${token}\\b`).test(line.text));
          return (
            <div key={index} className={`code-line${pointed ? " code-line-pointed" : ""}`}>
              <span className="code-gutter">{index + 1}</span>
              {line.from === null || line.to === null ? (
                <span>{line.text || " "}</span>
              ) : (
                <span>
                  {line.text.slice(0, line.from)}
                  <mark>{line.text.slice(line.from, line.to) || " "}</mark>
                  {line.text.slice(line.to)}
                </span>
              )}
            </div>
          );
        })}
      </pre>

      {rest.length > 0 && (
        <ul className="diagnostic-more">
          {rest.map((d, i) => (
            <li key={i}>
              <span className="diagnostic-code diagnostic-code-small">{d.code}</span>
              {d.message}
            </li>
          ))}
        </ul>
      )}

      {hint && (
        <p className="diagnostic-hint">
          {hint.split("`").map((part, index) =>
            index % 2 === 1 ? <code key={index}>{part}</code> : <span key={index}>{part}</span>,
          )}
        </p>
      )}
    </div>
  );
}
