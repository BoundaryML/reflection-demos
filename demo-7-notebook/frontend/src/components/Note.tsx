import { Fragment, type ReactNode } from 'react';

/** Just enough Markdown for the guided tour: headings, lists, bold, code. */
export function Note({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.split('\n');
  let list: string[] = [];
  let paragraph: string[] = [];

  const flushList = (key: string): void => {
    if (list.length === 0) {
      return;
    }
    blocks.push(
      <ul key={key}>
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  const flushParagraph = (key: string): void => {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push(<p key={key}>{inline(paragraph.join(' '))}</p>);
    paragraph = [];
  };

  lines.forEach((line, index) => {
    const key = `b${index}`;
    if (line.startsWith('## ')) {
      flushParagraph(`${key}p`);
      flushList(`${key}l`);
      blocks.push(<h2 key={key}>{inline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      flushParagraph(`${key}p`);
      flushList(`${key}l`);
      blocks.push(<h1 key={key}>{inline(line.slice(2))}</h1>);
    } else if (line.startsWith('- ')) {
      flushParagraph(`${key}p`);
      list.push(line.slice(2));
    } else if (line.trim() === '') {
      flushParagraph(`${key}p`);
      flushList(`${key}l`);
    } else {
      flushList(`${key}l`);
      paragraph.push(line);
    }
  });
  flushParagraph('tailp');
  flushList('taill');

  return <div className="note">{blocks}</div>;
}

const INLINE = /(\*\*.+?\*\*|\*[^*]+\*|`[^`]+`)/g;

function inline(text: string): ReactNode {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      // Bold may wrap a code span, so recurse rather than emit raw text.
      return <strong key={index}>{inline(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{inline(part.slice(1, -1))}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
