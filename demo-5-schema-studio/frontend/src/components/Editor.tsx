import { useEffect, useMemo, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { setDiagnostics, lintGutter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { bamlLanguage, bamlHighlight } from '../lib/bamlLanguage';
import type { Diagnostic } from '../lib/api';

const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'transparent', color: '#d6deeb' },
    '.cm-scroller': {
      fontFamily: 'var(--mono)',
      lineHeight: '1.65',
      overflow: 'auto',
    },
    '.cm-content': { padding: '14px 0 40vh 0', caretColor: '#7dd3fc' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#4a5261',
      border: 'none',
      paddingRight: '4px',
    },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(125,211,252,0.06)', color: '#8ba0bd' },
    '.cm-activeLine': { backgroundColor: 'rgba(125,211,252,0.045)' },
    '.cm-cursor': { borderLeftColor: '#7dd3fc', borderLeftWidth: '2px' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(125,211,252,0.20)',
    },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      borderBottom: '2px wavy #f87171',
      textDecoration: 'underline wavy #f87171 1.5px',
      textUnderlineOffset: '3px',
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      textDecoration: 'underline wavy #fbbf24 1.5px',
      textUnderlineOffset: '3px',
    },
    '.cm-lint-marker-error': { content: 'none' },
    '.cm-tooltip': {
      backgroundColor: '#161a21',
      border: '1px solid #2a3140',
      borderRadius: '8px',
      color: '#d6deeb',
      fontFamily: 'var(--mono)',
      fontSize: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    },
    '.cm-tooltip .cm-diagnostic': { padding: '8px 10px', borderLeft: 'none' },
    '.cm-tooltip .cm-diagnostic-error': { borderLeft: '3px solid #f87171' },
  },
  { dark: true },
);

export interface EditorProps {
  value: string;
  onChange: (next: string) => void;
  diagnostics: Diagnostic[];
  /** Scroll to and select a diagnostic's span. `nonce` re-triggers the same one. */
  reveal: { index: number; nonce: number } | null;
}

/** Convert a 1-based line/column span into absolute document offsets. */
function spanToRange(view: EditorView, d: Diagnostic): { from: number; to: number } | null {
  if (!d.span) return null;
  const doc = view.state.doc;
  const clampLine = (n: number) => Math.min(Math.max(n, 1), doc.lines);
  const startLine = doc.line(clampLine(d.span.startLine));
  const endLine = doc.line(clampLine(d.span.endLine));
  const from = Math.min(startLine.from + Math.max(d.span.startColumn - 1, 0), startLine.to);
  let to = Math.min(endLine.from + Math.max(d.span.endColumn - 1, 0), endLine.to);
  if (to <= from) to = Math.min(from + 1, doc.length);
  return { from, to };
}

export function Editor({ value, onChange, diagnostics, reveal }: EditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const extensions = useMemo<Extension[]>(
    () => [
      lineNumbers(),
      lintGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      bamlLanguage,
      bamlHighlight,
      editorTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      }),
    ],
    [],
  );

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions]);

  // Push external value changes (presets, model-written schemas) into the doc.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: Math.min(value.length, view.state.selection.main.anchor) },
    });
  }, [value]);

  // Real compiler diagnostics -> CodeMirror lint markers.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const marks: CmDiagnostic[] = [];
    for (const d of diagnostics) {
      const range = spanToRange(view, d);
      if (!range) continue;
      marks.push({
        from: range.from,
        to: range.to,
        severity: d.severity,
        source: d.code,
        message: `${d.code}  ${d.message}`,
      });
    }
    view.dispatch(setDiagnostics(view.state, marks));
  }, [diagnostics]);

  // Clicking a diagnostic in the rail jumps the cursor to its span.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || reveal === null) return;
    const d = diagnostics[reveal.index];
    if (!d) return;
    const range = spanToRange(view, d);
    if (!range) return;
    view.dispatch({
      selection: { anchor: range.from, head: range.to },
      effects: EditorView.scrollIntoView(range.from, { y: 'center' }),
    });
    view.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  return <div className="editor-host" ref={host} />;
}
