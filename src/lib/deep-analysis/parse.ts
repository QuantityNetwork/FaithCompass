/**
 * Server-side parsing of an uploaded document into normalised plain text. PDF through unpdf (pdf.js, text layer
 * only), DOCX through mammoth (raw text), TXT and Markdown as UTF-8. Scanned PDFs (no text layer) are refused
 * rather than guessed at: there is no OCR.
 */
import { createHash } from 'node:crypto';

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_TEXT_CHARS = 300_000;
export type Format = 'pdf' | 'docx' | 'txt' | 'md';

export class ParseError extends Error {
  constructor(public code: 'TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'SCANNED_PDF' | 'EMPTY' | 'UNREADABLE' | 'TOO_LONG', message: string, public status = 422) {
    super(message);
  }
}

export interface ParsedDocument {
  filename: string;
  format: Format;
  bytes: number;
  bytesSha256: string;
  text: string;
  textSha256: string;
  pages: number | null;
}

export const sha256Hex = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

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
  const ext = (filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');
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

async function pdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new ParseError('UNREADABLE', 'The PDF could not be opened (damaged or password-protected).');
  }
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((p) => normalizeText(p));
  const joined = pages.filter(Boolean).join('\n\n');
  const visible = joined.replace(/\s/g, '').length;
  if (visible < Math.max(80, 25 * totalPages)) {
    throw new ParseError('SCANNED_PDF', 'This PDF has no usable text layer (it looks scanned). Scanned PDFs without text are not supported: there is no OCR in this preview.');
  }
  return { text: joined, pages: totalPages };
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import('mammoth');
  try {
    const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return r.value;
  } catch {
    throw new ParseError('UNREADABLE', 'The .docx could not be read.');
  }
}

function utf8Text(bytes: Uint8Array): string {
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\u0000-\u0008\u000e-\u001f]/.test(t)) throw new Error('binary');
    return t;
  } catch {
    throw new ParseError('UNREADABLE', 'Text files must be UTF-8 plain text.');
  }
}

export async function parseDocument(filename: string, bytes: Uint8Array): Promise<ParsedDocument> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new ParseError('TOO_LARGE', `Files up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB are accepted.`, 413);
  if (bytes.byteLength === 0) throw new ParseError('EMPTY', 'The file is empty.');
  const format = detectFormat(filename, bytes);
  let raw: string;
  let pages: number | null = null;
  if (format === 'pdf') ({ text: raw, pages } = await pdfText(bytes));
  else if (format === 'docx') raw = await docxText(bytes);
  else raw = utf8Text(bytes);
  const text = normalizeText(raw);
  if (text.replace(/\s/g, '').length < 40) throw new ParseError('EMPTY', 'No readable text was found in the file.');
  if (text.length > MAX_TEXT_CHARS) throw new ParseError('TOO_LONG', `The text is longer than ${MAX_TEXT_CHARS.toLocaleString('en')} characters; split the document.`, 413);
  return { filename: filename.slice(0, 200), format, bytes: bytes.byteLength, bytesSha256: sha256Hex(bytes), text, textSha256: sha256Hex(text), pages };
}
