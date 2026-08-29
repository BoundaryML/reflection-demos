import type { Diagnostic } from '../lib/api';

export interface DiagnosticsRailProps {
  diagnostics: Diagnostic[];
  onReveal: (index: number) => void;
  compiling: boolean;
  ok: boolean;
  classCount: number;
}

export function DiagnosticsRail({ diagnostics, onReveal, compiling, ok, classCount }: DiagnosticsRailProps) {
  if (diagnostics.length === 0) {
    return (
      <div className={`rail rail-clean ${compiling ? 'is-busy' : ''}`}>
        <span className="rail-dot ok" />
        <span>
          {ok
            ? `package compiled — ${classCount} ${classCount === 1 ? 'class' : 'classes'} live in the runtime`
            : 'waiting for the first compile…'}
        </span>
      </div>
    );
  }

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.length - errors;

  return (
    <div className={`rail ${compiling ? 'is-busy' : ''}`}>
      <div className="rail-summary">
        <span className="rail-dot err" />
        <span>
          {errors} {errors === 1 ? 'error' : 'errors'}
          {warnings > 0 ? `, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : ''} from the BAML compiler
        </span>
      </div>
      <ul className="rail-list">
        {diagnostics.map((d, i) => (
          <li key={`${d.code}-${i}`}>
            <button type="button" className={`diag diag-${d.severity}`} onClick={() => onReveal(i)}>
              <span className="diag-code">{d.code}</span>
              <span className="diag-msg">{d.message}</span>
              {d.span && (
                <span className="diag-loc">
                  {d.span.file}:{d.span.startLine}:{d.span.startColumn}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
