import { useEffect, useState } from 'react';

const IDEAS = [
  'a customer support ticket: customer name, urgency from low to high, product area, one-line summary, steps to reproduce as short phrases',
  'a freight invoice with line items and a total',
  'a clinical visit note: vitals, complaint, plan as short imperative phrases',
  'a job posting: title, seniority, comp range, must-have skills',
];

export interface GenerateModalProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  live: boolean;
  onClose: () => void;
  onSubmit: (description: string) => void;
}

export function GenerateModal({ open, busy, error, live, onClose, onSubmit }: GenerateModalProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Describe the schema">
        <h2>Describe what you want to pull out</h2>
        <p>
          The model writes BAML for you. It lands in the editor as ordinary text — and gets compiled like anything
          else, mistakes included.
        </p>
        {!live && (
          <div className="banner warn">
            No API key set, so this returns a canned schema. Set <code>ANTHROPIC_API_KEY</code> or{' '}
            <code>OPENAI_API_KEY</code> and restart the backend for the real thing.
          </div>
        )}
        <textarea
          className="text-input"
          autoFocus
          value={text}
          placeholder="e.g. a purchase order: vendor, PO number, ship date, ordered items as short phrases"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !busy) onSubmit(text.trim());
          }}
        />
        <div className="chip-row">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" className="chip" onClick={() => setText(idea)}>
              {idea}
            </button>
          ))}
        </div>
        {error && <div className="banner">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || text.trim().length === 0}
            onClick={() => onSubmit(text.trim())}
          >
            {busy ? 'Writing…' : 'Write the schema'}
          </button>
        </div>
      </div>
    </div>
  );
}
