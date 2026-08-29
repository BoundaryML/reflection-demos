/**
 * A small BAML tokenizer, just enough to colour a notebook cell.
 * Deliberately not a parser: it never fails, it only decides on a colour.
 */

export type TokenKind =
  | 'comment'
  | 'string'
  | 'keyword'
  | 'type'
  | 'number'
  | 'package'
  | 'field'
  | 'plain';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'let',
  'class',
  'function',
  'enum',
  'type',
  'client',
  'interface',
  'implements',
  'if',
  'else',
  'for',
  'in',
  'while',
  'return',
  'throw',
  'throws',
  'catch',
  'match',
  'spawn',
  'await',
  'true',
  'false',
  'null',
  'self',
  'extends',
]);

const PRIMITIVES = new Set([
  'string',
  'int',
  'float',
  'bool',
  'bigint',
  'unknown',
  'never',
  'void',
  'map',
  'image',
  'audio',
]);

const PATTERN = new RegExp(
  [
    '(\\/\\/[^\\n]*)', // 1 line comment
    '(#"[\\s\\S]*?"#|"(?:[^"\\\\\\n]|\\\\.)*"|`(?:[^`\\\\]|\\\\.)*`)', // 2 strings
    '(\\b\\d+(?:\\.\\d+)?n?\\b)', // 3 numbers
    '([A-Za-z_][A-Za-z0-9_]*)', // 4 identifiers
  ].join('|'),
  'g',
);

export function tokenizeBaml(source: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  const push = (kind: TokenKind, text: string): void => {
    if (text.length === 0) {
      return;
    }
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) {
      last.text += text;
    } else {
      tokens.push({ kind, text });
    }
  };

  PATTERN.lastIndex = 0;
  let match = PATTERN.exec(source);
  while (match !== null) {
    push('plain', source.slice(cursor, match.index));
    const [whole, comment, str, num, ident] = match;

    if (comment !== undefined) {
      push('comment', comment);
    } else if (str !== undefined) {
      push('string', str);
    } else if (num !== undefined) {
      push('number', num);
    } else if (ident !== undefined) {
      const before = source[match.index - 1];
      const after = source.slice(match.index + ident.length);
      if (before === '.') {
        push('field', ident);
      } else if (KEYWORDS.has(ident)) {
        push('keyword', ident);
      } else if (PRIMITIVES.has(ident)) {
        push('type', ident);
      } else if (after.startsWith('.') && /^[a-z_]/.test(ident)) {
        push('package', ident);
      } else if (/^[A-Z]/.test(ident)) {
        push('type', ident);
      } else {
        push('plain', ident);
      }
    }

    cursor = match.index + whole.length;
    match = PATTERN.exec(source);
  }

  push('plain', source.slice(cursor));
  return tokens;
}
