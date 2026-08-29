import { useLayoutEffect, useRef } from 'react';

import { tokenizeBaml } from '../highlight';

interface EditorProps {
  value: string;
  onChange: (next: string) => void;
  onRun: () => void;
  onRunAndAdvance: () => void;
  disabled: boolean;
}

/**
 * A highlighted <pre> underlay with a transparent <textarea> on top. The
 * textarea grows to fit its content so the two layers never scroll apart.
 */
export function Editor({ value, onChange, onRun, onRunAndAdvance, disabled }: EditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const node = textarea.current;
    if (!node) {
      return;
    }
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  const tokens = tokenizeBaml(value.endsWith('\n') ? `${value} ` : value);

  return (
    <div className="editor">
      <pre className="editor-underlay" aria-hidden="true">
        {tokens.map((token, index) => (
          <span key={index} className={`tok tok-${token.kind}`}>
            {token.text}
          </span>
        ))}
      </pre>
      <textarea
        ref={textarea}
        className="editor-input"
        value={value}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onRun();
            return;
          }
          if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            onRunAndAdvance();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            const node = event.currentTarget;
            const { selectionStart, selectionEnd } = node;
            const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
            onChange(next);
            requestAnimationFrame(() => {
              node.selectionStart = selectionStart + 2;
              node.selectionEnd = selectionStart + 2;
            });
          }
        }}
      />
    </div>
  );
}
