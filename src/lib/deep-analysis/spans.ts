/**
 * Hash-anchored spans. A span is a [start, end) range of the normalised text plus the verbatim quote and its
 * SHA-256; `verifySpan` re-derives both. `locateQuote` is how an AI-layer quotation becomes a span: the quotation
 * must occur in the text word for word (only runs of whitespace may differ, as line breaks in extracted PDF text
 * do). Anything else is not found, and the finding citing it is dropped.
 */
import { sha256Hex } from './parse';
import type { Span } from './schema';

export const MIN_QUOTE_CHARS = 12;

export class SpanTable {
  private byKey = new Map<string, Span>();
  readonly spans: Span[] = [];
  constructor(readonly text: string, private clauseAt: (offset: number) => string | null) {}

  /** The span for [start, end), trimmed of surrounding whitespace; the same range always gets the same id. */
  add(start: number, end: number): Span {
    while (start < end && /\s/.test(this.text[start])) start++;
    while (end > start && /\s/.test(this.text[end - 1])) end--;
    if (end <= start) throw new Error('empty span');
    const key = `${start}:${end}`;
    const hit = this.byKey.get(key);
    if (hit) return hit;
    const quote = this.text.slice(start, end);
    const s: Span = { id: `S${this.spans.length + 1}`, start, end, quote, sha256: sha256Hex(quote), clause: this.clauseAt(start) };
    this.byKey.set(key, s);
    this.spans.push(s);
    return s;
  }
}

export function verifySpan(text: string, s: Pick<Span, 'start' | 'end' | 'quote' | 'sha256'>): boolean {
  return s.start >= 0 && s.end <= text.length && s.end > s.start && text.slice(s.start, s.end) === s.quote && sha256Hex(s.quote) === s.sha256;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where `quote` occurs verbatim in `text`, or null. Exact match first; then the same words with any whitespace
 * between them. When `within` is given, an occurrence inside that range is preferred.
 */
export function locateQuote(text: string, quote: string, within?: { start: number; end: number }): { start: number; end: number } | null {
  const q = quote.trim().replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  if (q.length < MIN_QUOTE_CHARS) return null;
  const hits: { start: number; end: number }[] = [];
  let i = text.indexOf(q);
  while (i !== -1 && hits.length < 50) {
    hits.push({ start: i, end: i + q.length });
    i = text.indexOf(q, i + 1);
  }
  if (!hits.length) {
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length < 2) return null;
    const re = new RegExp(words.map(escape).join('\\s+'), 'g');
    for (const m of text.matchAll(re)) {
      hits.push({ start: m.index!, end: m.index! + m[0].length });
      if (hits.length >= 50) break;
    }
  }
  if (!hits.length) return null;
  if (within) return hits.find((h) => h.start >= within.start && h.end <= within.end) ?? hits[0];
  return hits[0];
}
