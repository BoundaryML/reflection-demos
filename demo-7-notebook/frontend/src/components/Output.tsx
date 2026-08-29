import type { RunResult } from '../types';

/**
 * Extra context for diagnostics whose wording is accurate but terse. Keyed by
 * the compiler's own code so the diagnostic stays the source of truth.
 */
const HINTS: Record<string, string> = {
  E0003: 'Nothing in this session binds that name yet — run the cell that introduces it first.',
};

export function Output({ result }: { result: RunResult }) {
  const { outcome, elapsedMs } = result;

  if (outcome.status === 'ok') {
    return (
      <div className="output output-ok">
        <Value value={outcome.value} />
        <Timing ms={elapsedMs} />
      </div>
    );
  }

  if (outcome.status === 'compile-error') {
    return (
      <div className="output output-error">
        <div className="output-banner">
          <span className="badge badge-error">does not compile</span>
          <span className="output-banner-note">nothing ran; the session is unchanged</span>
        </div>
        <ul className="diagnostics">
          {outcome.diagnostics.map((diagnostic, index) => (
            <li key={index}>
              <div className="diagnostic-head">
                <code className="diagnostic-code">{diagnostic.code}</code>
                <span className="diagnostic-message">{diagnostic.message}</span>
              </div>
              {diagnostic.file ? <div className="diagnostic-file">{diagnostic.file}</div> : null}
              {HINTS[diagnostic.code] ? (
                <div className="diagnostic-hint">{HINTS[diagnostic.code]}</div>
              ) : null}
            </li>
          ))}
        </ul>
        <Timing ms={elapsedMs} />
      </div>
    );
  }

  if (outcome.status === 'runtime-error') {
    return (
      <div className="output output-error">
        <div className="output-banner">
          <span className="badge badge-error">threw</span>
          <span className="output-banner-note">
            statements before the throw are committed; the rest never ran
          </span>
        </div>
        <div className="runtime-message">{outcome.message}</div>
        {outcome.trace.length > 0 ? (
          <pre className="trace">{outcome.trace.join('\n')}</pre>
        ) : null}
        <Timing ms={elapsedMs} />
      </div>
    );
  }

  return (
    <div className="output output-error">
      <div className="output-banner">
        <span className="badge badge-warn">busy</span>
        <span className="output-banner-note">{outcome.message}</span>
      </div>
      <Timing ms={elapsedMs} />
    </div>
  );
}

function Timing({ ms }: { ms: number }) {
  return <div className="timing">{ms} ms</div>;
}

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <div className="value value-void">
        committed — this cell bound names rather than producing a value
      </div>
    );
  }

  if (typeof value === 'string') {
    return (
      <div className="value">
        <TypeTag label="string" />
        <pre className="value-string">{value}</pre>
      </div>
    );
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return (
      <div className="value">
        <TypeTag label={typeof value === 'boolean' ? 'bool' : 'number'} />
        <pre className="value-scalar">{String(value)}</pre>
      </div>
    );
  }

  const label = Array.isArray(value) ? `array · ${value.length}` : 'class';
  const text = render(value, '');
  // Structured values get the tag on its own line so the body keeps its own
  // indentation instead of hanging off the tag.
  return (
    <div className={text.includes('\n') ? 'value value-block' : 'value'}>
      <TypeTag label={label} />
      <pre className="value-json">{text}</pre>
    </div>
  );
}

function TypeTag({ label }: { label: string }) {
  return <span className="type-tag">{label}</span>;
}

/** A compact, stable pretty-printer — no dependency, no surprises. */
function render(value: unknown, indent: string): string {
  const next = `${indent}  `;
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map((item) => `${next}${render(item, next)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return '{}';
  }
  const body = entries.map(([key, item]) => `${next}${key}: ${render(item, next)}`);
  return `{\n${body.join(',\n')}\n${indent}}`;
}
