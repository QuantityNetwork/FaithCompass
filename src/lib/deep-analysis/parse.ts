/**
 * Server-side parsing of an uploaded document into normalised plain text. PDF through unpdf (pdf.js, text layer
 * only), DOCX through mammoth (raw text), TXT and Markdown as UTF-8. Scanned PDFs (no text layer) are refused
 * rather than guessed at: there is no OCR. Files over MAX_UPLOAD_BYTES (the request-body cap) are read in the browser
 * with the same libraries and rules (lib/deep-analysis/text.ts) and only their text is sent: see documentFromText.
 */
import { createHash } from 'node:crypto';
import { MAX_DIRECT_BYTES, ParseError, decodeUtf8, detectFormat, finalText, pdfPagesToText, type Format } from './text';

export { MAX_FILE_BYTES, MAX_TEXT_CHARS, ParseError, detectFormat, normalizeText, type Format } from './text';
/** Largest file the server accepts as raw bytes (the request body cap); larger files are read in the browser. */
export const MAX_UPLOAD_BYTES = MAX_DIRECT_BYTES;

export interface ParsedDocument {
  filename: string;
  format: Format;
  bytes: number;
  bytesSha256: string;
  text: string;
  textSha256: string;
  pages: number | null;
  /** Where the text was extracted: on the server from the file, or in the user's browser (large files). */
  extraction?: 'server' | 'browser';
}

export const sha256Hex = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

async function pdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new ParseError('UNREADABLE', 'The PDF could not be opened (damaged or password-protected).');
  }
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { text: pdfPagesToText(text as string[], totalPages), pages: totalPages };
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

export async function parseDocument(filename: string, bytes: Uint8Array): Promise<ParsedDocument> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new ParseError('TOO_LARGE', `Files over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB are read in the browser; send the extracted text instead.`, 413);
  if (bytes.byteLength === 0) throw new ParseError('EMPTY', 'The file is empty.');
  const format = detectFormat(filename, bytes);
  let raw: string;
  let pages: number | null = null;
  if (format === 'pdf') ({ text: raw, pages } = await pdfText(bytes));
  else if (format === 'docx') raw = await docxText(bytes);
  else raw = decodeUtf8(bytes);
  const text = finalText(raw);
  return { filename: filename.slice(0, 200), format, bytes: bytes.byteLength, bytesSha256: sha256Hex(bytes), text, textSha256: sha256Hex(text), pages, extraction: 'server' };
}

/**
 * A document whose text was extracted in the user's browser (files over MAX_UPLOAD_BYTES, up to MAX_FILE_BYTES). The
 * server never receives the file: it re-normalises and re-checks the text and hashes it itself; the file size and
 * file hash are as reported by the browser.
 */
export function documentFromText(input: { filename: string; format: Format; text: string; pages: number | null; bytes: number; bytesSha256: string }): ParsedDocument {
  const text = finalText(input.text);
  return { filename: input.filename.slice(0, 200), format: input.format, bytes: input.bytes, bytesSha256: input.bytesSha256, text, textSha256: sha256Hex(text), pages: input.pages, extraction: 'browser' };
}
