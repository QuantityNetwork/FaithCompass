'use client';
/**
 * Reads a large file in the browser (files over the server's request-body cap, up to 15 MB) with the same libraries
 * and text rules as the server parser, so the file itself never leaves the user's device: only the extracted text is
 * sent for analysis. PDF through unpdf (pdf.js, text layer only), DOCX through mammoth (browser build), TXT/MD as UTF-8.
 */
import { MAX_FILE_BYTES, MAX_TEXT_CHARS, ParseError, decodeUtf8, detectFormat, finalText, pdfPagesToText, type Format } from '@/lib/deep-analysis/text';

export interface BrowserExtraction { format: Format; text: string; pages: number | null; bytes: number; bytesSha256: string }

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function extractInBrowser(filename: string, buf: ArrayBuffer): Promise<BrowserExtraction> {
  if (buf.byteLength > MAX_FILE_BYTES) throw new ParseError('TOO_LARGE', `Files up to ${MAX_FILE_BYTES / 1024 / 1024} MB are accepted.`, 413);
  if (buf.byteLength === 0) throw new ParseError('EMPTY', 'The file is empty.');
  const bytes = new Uint8Array(buf);
  const format = detectFormat(filename, bytes);
  let raw: string;
  let pages: number | null = null;
  if (format === 'pdf') {
    const { getDocumentProxy, extractText } = await import('unpdf');
    let pdf;
    try {
      pdf = await getDocumentProxy(new Uint8Array(bytes));
    } catch {
      throw new ParseError('UNREADABLE', 'The PDF could not be opened (damaged or password-protected).');
    }
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    raw = pdfPagesToText(text as string[], totalPages);
    pages = totalPages;
  } else if (format === 'docx') {
    const mammoth = await import('mammoth');
    try {
      raw = (await mammoth.extractRawText({ arrayBuffer: buf } as unknown as Parameters<typeof mammoth.extractRawText>[0])).value;
    } catch {
      throw new ParseError('UNREADABLE', 'The .docx could not be read.');
    }
  } else raw = decodeUtf8(bytes);
  const text = finalText(raw);
  if (text.length > MAX_TEXT_CHARS) throw new ParseError('TOO_LONG', 'The text is too long; split the document.', 413);
  return { format, text, pages, bytes: buf.byteLength, bytesSha256: await sha256Hex(buf) };
}
