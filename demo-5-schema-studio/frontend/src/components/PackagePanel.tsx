import type { ClassInfo } from '../lib/api';

export interface PackagePanelProps {
  classes: ClassInfo[];
  selected: string | null;
  onSelect: (qualifiedName: string) => void;
  ok: boolean;
}

export function PackagePanel({ classes, selected, onSelect, ok }: PackagePanelProps) {
  if (!ok) {
    return (
      <div className="panel-empty">
        <p>No package.</p>
        <p className="dim">Fix the errors on the left and the classes show up here the moment it compiles.</p>
      </div>
    );
  }
  if (classes.length === 0) {
    return (
      <div className="panel-empty">
        <p>Compiled, but there are no classes yet.</p>
        <p className="dim">Add a `class` declaration to get something you can extract into.</p>
      </div>
    );
  }

  return (
    <div className="class-list">
      {classes.map((c) => {
        const isSelected = c.qualifiedName === selected;
        return (
          <button
            key={c.qualifiedName}
            type="button"
            className={`class-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(c.qualifiedName)}
            aria-pressed={isSelected}
          >
            <div className="class-card-head">
              <span className="class-name">{c.name}</span>
              <span className="class-count">
                {c.fields.length} {c.fields.length === 1 ? 'field' : 'fields'}
              </span>
              {isSelected && <span className="class-badge">extraction target</span>}
            </div>
            {c.fields.length > 0 && (
              <table className="field-table">
                <tbody>
                  {c.fields.map((f) => (
                    <tr key={f.name}>
                      <td className="field-name">{f.name}</td>
                      <td className="field-type">{f.type}</td>
                      <td className="field-desc">{f.description ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </button>
        );
      })}
    </div>
  );
}
