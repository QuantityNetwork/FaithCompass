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

/** Joins pdf.js page texts; refuses PDFs without a usable text layer (scanned) instead of guessing. */
export function pdfPagesToText(pageTexts: string[], totalPages: number): string {
  const joined = pageTexts.map((p) => normalizeText(p)).filter(Boolean).join('\n\n');
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
