/**
 * Clause and sentence segmentation by fixed rules. A clause starts at a heading line: a numbered heading
 * ("4. Payment", "Section 4", "Article IV"), a schedule or annex heading, or a short line in capitals. Numbered
 * sub-clauses ("4.2 ...") stay inside their top-level clause. Text before the first heading is the preamble. A text
 * with no headings at all is split into paragraphs.
 */
import { sha256Hex } from './parse';

export interface RawClause {
  id: string;
  number: string | null;
  heading: string;
  start: number;
  end: number;
  sha256: string;
}

export interface Sentence {
  start: number;
  end: number;
  text: string;
}

const NUMBERED = /^(?:(?:[Ss]ection|SECTION|[Cc]lause|CLAUSE|[Aa]rticle|ARTICLE)\s+)?(\d{1,3}|[IVX]{1,5})(?:\.)?(?:\s+|\s*[.:)–-]\s*)([A-Z][^\n]{0,110})$/;
const SUB = /^\d{1,3}\.\d{1,3}/;
const SCHEDULE = /^(schedule|annex|appendix|exhibit|attachment)\b[^\n]{0,100}$/i;
const CAPS = /^[A-Z][A-Z0-9 ,&'’()\-/]{3,70}$/;

function lines(text: string): { start: number; end: number; s: string }[] {
  const out: { start: number; end: number; s: string }[] = [];
  let i = 0;
  for (const s of text.split('\n')) {
    out.push({ start: i, end: i + s.length, s });
    i += s.length + 1;
  }
  return out;
}

function headingOf(line: string): { number: string | null; heading: string } | null {
  const t = line.trim().replace(/^#{1,6}\s+/, '').replace(/^\*\*(.+)\*\*$/, '$1');
  if (!t || SUB.test(t)) return null;
  const inlineOk = /^\d{1,3}\.\s+[A-Z][A-Za-z ,&'’-]{2,50}\.\s+\S/.test(t);
  if (t.length > 120 && !inlineOk) return null;
  const sched = SCHEDULE.exec(t);
  if (sched) return { number: null, heading: t };
  const m = NUMBERED.exec(t);
  if (m) {
    const h = m[2].trim();
    if (h.split(/\s+/).length <= 8 && !/[.;,]$/.test(h)) return { number: m[1], heading: h.replace(/[:]$/, '') };
  }
  // "4. Payment. The Customer shall ..." : an inline heading at the start of a numbered paragraph.
  const inline = /^(\d{1,3})\.\s+([A-Z][A-Za-z ,&'’-]{2,50})\.\s+\S/.exec(t.length > 120 ? t.slice(0, 120) : t);
  if (inline && inline[2].split(/\s+/).length <= 6) return { number: inline[1], heading: inline[2] };
  if (CAPS.test(t) && /[A-Z]{3}/.test(t) && t.split(/\s+/).length <= 8) return { number: null, heading: t };
  return null;
}

export function segmentClauses(text: string): RawClause[] {
  const ls = lines(text);
  const heads: { start: number; number: string | null; heading: string }[] = [];
  for (const l of ls) {
    const h = headingOf(l.s);
    if (h) heads.push({ start: l.start, ...h });
  }
  // The first capitals line is usually the title, not a clause.
  if (heads.length && heads[0].number === null && heads[0].start === 0 && !SCHEDULE.test(heads[0].heading)) heads.shift();
  const out: RawClause[] = [];
  const push = (number: string | null, heading: string, start: number, end: number) => {
    let s = start, e = end;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e <= s) return;
    out.push({ id: `C${out.length + 1}`, number, heading, start: s, end: e, sha256: sha256Hex(text.slice(s, e)) });
  };
  if (heads.length >= 2) {
    if (heads[0].start > 0) push(null, 'Preamble', 0, heads[0].start);
    heads.forEach((h, i) => push(h.number, h.heading, h.start, i + 1 < heads.length ? heads[i + 1].start : text.length));
    return out;
  }
  // No structure: paragraphs.
  let i = 0;
  for (const p of text.split(/\n\s*\n/)) {
    const start = text.indexOf(p, i);
    i = start + p.length;
    if (p.trim()) push(null, p.trim().split('\n')[0].slice(0, 60), start, start + p.length);
  }
  return out;
}

/** Sentences (and list items) with offsets into `text`, inside [from, to). */
export function sentences(text: string, from = 0, to = text.length): Sentence[] {
  const out: Sentence[] = [];
  const chunk = text.slice(from, to);
  // Split at line breaks and after ". " / "; " followed by a capital, a digit or an opening bracket.
  const re = /\n+|(?<=[.;!?])\s+(?=[A-Z0-9("“(])/g;
  let last = 0;
  const emit = (a: number, b: number) => {
    let s = a, e = b;
    while (s < e && /\s/.test(chunk[s])) s++;
    while (e > s && /\s/.test(chunk[e - 1])) e--;
    if (e - s >= 3) out.push({ start: from + s, end: from + e, text: chunk.slice(s, e) });
  };
  for (const m of chunk.matchAll(re)) {
    // Do not split after common abbreviations.
    const before = chunk.slice(Math.max(0, m.index! - 6), m.index!);
    if (/\b(e\.g|i\.e|etc|No|no|art|Art|Sec|cl|para|approx|Ltd|Inc|Co|vs)\.$/.test(before)) continue;
    emit(last, m.index!);
    last = m.index! + m[0].length;
  }
  emit(last, chunk.length);
  return out;
}
