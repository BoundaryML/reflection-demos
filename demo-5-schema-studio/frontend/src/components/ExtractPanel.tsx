import { useState } from 'react';
import type { ExtractResult } from '../lib/api';

export interface ExtractPanelProps {
  document: string;
  onDocumentChange: (next: string) => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
  disabledReason: string;
  result: ExtractResult | null;
  targetClass: string | null;
}

export function ExtractPanel({
  document,
  onDocumentChange,
  onRun,
  running,
  disabled,
  disabledReason,
  result,
  targetClass,
}: ExtractPanelProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="extract">
      <label className="field-label" htmlFor="extract-doc">
        Paste something to extract
      </label>
      <textarea
        id="extract-doc"
        className="doc-input"
        value={document}
        spellCheck={false}
        onChange={(e) => onDocumentChange(e.target.value)}
        placeholder="An invoice, a chart note, an email thread — anything your schema describes."
      />
      <div className="extract-actions">
        <button type="button" className="btn primary" onClick={onRun} disabled={disabled || running}>
          {running ? 'Extracting…' : targetClass ? `Extract into ${targetClass}` : 'Extract'}
        </button>
        {disabled && <span className="hint">{disabledReason}</span>}
      </div>

      {result && (
        <div className="extract-result">
          {result.error ? (
            <div className="extract-error">
              <span className="diag-code">{result.error.code}</span>
              <span>{result.error.message}</span>
            </div>
          ) : (
            <>
              <div className="extract-meta">
                <span className={`tag ${result.source}`}>{result.source === 'live' ? result.model ?? 'live model' : 'sample response'}</span>
                <span className="dim">{result.latencyMs.toFixed(0)}ms</span>
              </div>
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Type</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.field} className={r.missing ? 'row-missing' : ''}>
                      <td className="field-name">{r.field}</td>
                      <td className="field-type">{r.type}</td>
                      <td className="cell-value">{r.missing ? <span className="dim">—</span> : r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="disclosure-row">
            <button type="button" className="link" onClick={() => setShowPrompt((v) => !v)}>
              {showPrompt ? 'Hide' : 'Show'} what the model was asked
            </button>
            <button type="button" className="link" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? 'Hide' : 'Show'} the raw response
            </button>
          </div>
          {showPrompt && <pre className="code-block">{result.prompt}</pre>}
          {showRaw && <pre className="code-block">{result.raw}</pre>}
        </div>
      )}
    </div>
  );
}
