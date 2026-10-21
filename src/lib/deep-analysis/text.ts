/**
 * Text rules shared by the server parser (parse.ts) and the in-browser extractor (components/deep-analysis/
 * extract-client.ts), so a document gives the same normalised text wherever it is read. No Node-only imports here.
 */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
/** Files up to this size may be sent to the server as they are; larger ones are read in the browser (request cap). */
export const MAX_DIRECT_BYTES = 3 * 1024 * 1024;
export const MAX_TEXT_CHARS = 300_000;
export type Format = 'pdf' | 'docx' | 'txt' | 'md';

export class ParseError extends Error {
  constructor(public code: 'TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'SCANNED_PDF' | 'EMPTY' | 'UNREADABLE' | 'TOO_LONG', message: string, public status = 422) {
    super(message);
  }
}

/** Unicode NFC, Unix newlines, no non-breaking or zero-width spaces, no trailing spaces, at most one blank line. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\u00ad/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectFormat(filename: string, bytes: Uint8Array): Format {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const head = String.fromCharCode(...bytes.subarray(0, 5));
  if (head.startsWith('%PDF-')) {
    if (ext && ext !== 'pdf') throw new ParseError('UNSUPPORTED_TYPE', 'The file content is a PDF but the name says otherwise.');
    return 'pdf';
  }
  if (head.startsWith('PK\u0003\u0004')) {
    if (ext === 'docx') return 'docx';
    throw new ParseError('UNSUPPORTED_TYPE', 'Only .docx is accepted among Office formats (not .doc, .xlsx or .pptx).');
  }
  if (ext === 'txt' || ext === 'md' || ext === 'markdown') return ext === 'txt' ? 'txt' : 'md';
  if (ext === 'pdf' || ext === 'docx') throw new ParseError('UNREADABLE', `This file does not look like a valid .${ext}.`);
  throw new ParseError('UNSUPPORTED_TYPE', 'Upload a PDF with a text layer, a .docx, or a .txt / .md file.');
}

/** A line that starts a new block: a clause number ("4.", "4.1", "4.1.2"), a list item ("(a)", "(iv)", "A.", "-") or a markdown heading. */
const BLOCK_START = /^(?:\d{1,3}(?:\.\d{1,3})+\.?\s|\d{1,3}\.\s|\((?:[a-z]|[ivx]{1,4}|\d{1,2})\)\s|[A-Z]\.\s|[-•*–—]\s|#{1,6}\s)/;
/** A line that ends a sentence or a clause: . ! ? : ; optionally followed by a closing quote or bracket. */
const SENTENCE_END = /[.!?:;]["'”’)\]]*$/;

function isHeading(line: string, wide: number): boolean {
  if (line.length > 80 || line.length > wide * 0.75 || SENTENCE_END.test(line)) return false;
  const letters = line.replace(/[^\p{L}]/gu, '');
  return (letters.length >= 3 && letters === letters.toUpperCase()) || /^\d+(?:\.\d+)*\.?\s+\S/.test(line) || /^(?:Article|Section|Clause|Annex|Schedule|Appendix|Exhibit)\b/i.test(line);
}

/**
 * Re-joins the visual lines of a PDF page into paragraphs. pdf.js returns one line per printed line, so a sentence
 * wrapped by the PDF's layout is split by hard line breaks, which breaks party, date and clause detection.
 * Joins a line to the next unless it ends a sentence, is a heading, is short (ends a paragraph), or the next line
 * starts a new clause or list item. A word hyphenated across the break ("equiv-" + "alent") is de-hyphenated.
 * Blank lines (paragraph breaks) are kept. Only used for PDFs: DOCX, TXT and MD keep their own line structure.
 */
export function unwrapPdfLines(page: string): string {
  const paragraphs = normalizeText(page).split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
      const lengths = lines.map((l) => l.length).sort((a, b) => a - b);
      const wide = lengths[Math.floor(lengths.length * 0.9)] ?? 0;
      let out = '';
      lines.forEach((line, i) => {
        if (i === 0) return void (out = line);
        const prev = lines[i - 1];
        const hyphenated = /\p{Ll}-$/u.test(prev) && /^\p{Ll}/u.test(line);
        const keepBreak = !hyphenated && (SENTENCE_END.test(prev) || isHeading(prev, wide) || BLOCK_START.test(line) || prev.length < wide * 0.6);
        // A lone closing mark or punctuation left on its own line belongs to the line before.
        if (!keepBreak || /^["'”’)\].,;:]+$/.test(line)) out = hyphenated ? out.slice(0, -1) + line : /^["'”’)\].,;:]/.test(line) ? out + line : `${out} ${line}`;
        else out += `\n${line}`;
      });
      return out;
    })
    .join('\n\n');
}

/** Joins pdf.js page texts; refuses PDFs without a usable text layer (scanned) instead of guessing. */
export function pdfPagesToText(pageTexts: string[], totalPages: number): string {
  const joined = pageTexts.map((p) => unwrapPdfLines(p)).filter(Boolean).join('\n\n');
  if (joined.replace(/\s/g, '').length < Math.max(80, 25 * totalPages))
    throw new ParseError('SCANNED_PDF', 'This PDF has no usable text layer (it looks scanned). Scanned PDFs without text are not supported: there is no OCR.');
  return joined;
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\u0000-\u0008\u000e-\u001f]/.test(t)) throw new Error('binary');
    return t;
  } catch {
    throw new ParseError('UNREADABLE', 'Text files must be UTF-8 plain text.');
  }
}

/** Normalises and checks extracted text: not empty, not longer than the analysis accepts. */
export function finalText(raw: string): string {
  const text = normalizeText(raw);
  if (text.replace(/\s/g, '').length < 40) throw new ParseError('EMPTY', 'No readable text was found in the file.');
  if (text.length > MAX_TEXT_CHARS) throw new ParseError('TOO_LONG', `The text is longer than ${MAX_TEXT_CHARS.toLocaleString('en')} characters; split the document.`, 413);
  return text;
}
