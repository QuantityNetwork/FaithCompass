/**
 * Footnote citations: a superscript link to a numbered note, and the notes with a link back.
 * Ids are scoped by a prefix so two lists on one page cannot collide.
 */
import type { ReactNode } from 'react';

export function Cite({ n, scope = 'fn' }: { n: number; scope?: string }) {
  return (
    <sup className="am-fn" id={`${scope}-ref-${n}`}>
      <a href={`#${scope}-${n}`} aria-label={`Note ${n}`}>
        {n}
      </a>
    </sup>
  );
}

export function Footnotes({ notes, scope = 'fn', title = 'Notes' }: { notes: ReactNode[]; scope?: string; title?: string }) {
  if (notes.length === 0) return null;
  return (
    <aside className="am-footnotes" aria-label={title}>
      <ol>
        {notes.map((note, i) => (
          <li key={i} id={`${scope}-${i + 1}`}>
            {note}{' '}
            <a className="am-fn-back" href={`#${scope}-ref-${i + 1}`} aria-label={`Back to reference ${i + 1}`}>
              ↩
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
