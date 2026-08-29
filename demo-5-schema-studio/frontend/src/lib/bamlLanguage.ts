import { StreamLanguage, type StreamParser, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = new Set([
  'class', 'enum', 'interface', 'function', 'client', 'generator', 'test', 'type',
  'let', 'return', 'if', 'else', 'for', 'while', 'throw', 'throws', 'catch',
  'implements', 'import', 'as', 'in', 'is', 'match', 'unreflect', 'reflect',
]);

const ATOMS = new Set(['true', 'false', 'null', 'never', 'unknown', 'self']);

const TYPES = new Set([
  'string', 'int', 'float', 'bool', 'null', 'image', 'audio', 'pdf', 'video',
  'map', 'array', 'type',
]);

/**
 * A deliberately small hand-rolled BAML highlighter. It only needs to make the
 * editor read like BAML — the authority on whether the text is *valid* is the
 * real compiler, which runs on the backend and reports through the lint gutter.
 */
const bamlParser: StreamParser<{ inBlockComment: boolean; rawHashes: number }> = {
  name: 'baml',
  startState: () => ({ inBlockComment: false, rawHashes: 0 }),
  token(stream, state) {
    if (state.inBlockComment) {
      while (!stream.eol()) {
        if (stream.match('*/')) {
          state.inBlockComment = false;
          break;
        }
        stream.next();
      }
      return 'comment';
    }

    // Raw strings: #"..."#  (and ##"..."##)
    if (state.rawHashes > 0) {
      const close = '"' + '#'.repeat(state.rawHashes);
      while (!stream.eol()) {
        if (stream.match(close)) {
          state.rawHashes = 0;
          break;
        }
        stream.next();
      }
      return 'string';
    }

    if (stream.eatSpace()) return null;

    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      state.inBlockComment = true;
      return 'comment';
    }

    const rawOpen = stream.match(/^#+"/);
    if (rawOpen && rawOpen !== true) {
      state.rawHashes = rawOpen[0].length - 1;
      return 'string';
    }

    const ch = stream.peek();
    if (ch === '"' || ch === '`' || ch === "'") {
      const quote = stream.next() as string;
      let escaped = false;
      while (!stream.eol()) {
        const c = stream.next();
        if (escaped) {
          escaped = false;
          continue;
        }
        if (c === '\\') escaped = true;
        else if (c === quote) break;
      }
      return 'string';
    }

    if (stream.match(/^@[A-Za-z_][A-Za-z0-9_]*/)) return 'meta';
    if (stream.match(/^[0-9]+(\.[0-9]+)?/)) return 'number';

    const word = stream.match(/^[A-Za-z_][A-Za-z0-9_$]*/);
    if (word && word !== true) {
      const w = word[0];
      if (KEYWORDS.has(w)) return 'keyword';
      if (ATOMS.has(w)) return 'atom';
      if (TYPES.has(w)) return 'type';
      // ClassNames and Fn$companions read as definitions.
      if (/^[A-Z]/.test(w)) return 'typeName';
      if (stream.peek() === '(') return 'function';
      return 'variable';
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"', '`'] },
  },
};

export const bamlLanguage = StreamLanguage.define(bamlParser);

export const bamlHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.comment, color: '#5b6472', fontStyle: 'italic' },
    { tag: t.keyword, color: '#c792ea' },
    { tag: t.atom, color: '#f78c6c' },
    { tag: t.number, color: '#f78c6c' },
    { tag: t.string, color: '#c3e88d' },
    { tag: t.meta, color: '#ffcb6b' },
    { tag: t.typeName, color: '#82aaff' },
    { tag: t.function(t.variableName), color: '#82aaff' },
    { tag: t.variableName, color: '#d6deeb' },
    { tag: t.definition(t.variableName), color: '#d6deeb' },
  ]),
);
