/**
 * Builds a real PDF (Helvetica text layer, WinAnsi encoding) in memory for tests, with the text wrapped at word
 * boundaries like a word processor would, optional hyphenation across lines, and an optional raw grey-scale image
 * to make the file large (a 13.8 MB test file without committing a binary). No dependencies.
 */
import { randomBytes } from 'node:crypto';

const WIN_ANSI: Record<string, number> = { '€': 0x80, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97 };

function pdfString(s: string): Buffer {
  const bytes: number[] = [];
  for (const ch of s) {
    const c = WIN_ANSI[ch] ?? ch.codePointAt(0)!;
    if (c > 0xff) throw new Error(`character not in WinAnsi: ${ch}`);
    if (c === 0x28 || c === 0x29 || c === 0x5c) bytes.push(0x5c);
    bytes.push(c);
  }
  return Buffer.from(bytes);
}

/** Wraps each paragraph at `width` characters on word boundaries; words longer than the rest of a line are hyphenated when `hyphenate` is set. */
export function wrapLines(text: string, width: number, hyphenate = false): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const room = width - line.length - (line ? 1 : 0);
      if (word.length <= room) { line += (line ? ' ' : '') + word; continue; }
      if (hyphenate && /^[a-z]{8,}$/.test(word) && room >= 5) {
        const cut = room - 1;
        out.push(`${line}${line ? ' ' : ''}${word.slice(0, cut)}-`);
        line = word.slice(cut);
        continue;
      }
      out.push(line);
      line = word;
    }
    out.push(line);
  }
  return out;
}

export function buildPdf(lines: string[], opts: { linesPerPage?: number; imageBytes?: number } = {}): Uint8Array {
  const perPage = opts.linesPerPage ?? 52;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  const objs: Buffer[] = [];
  const add = (b: Buffer | string) => (objs.push(typeof b === 'string' ? Buffer.from(b, 'latin1') : b), objs.length);
  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  let image = 0;
  let side = 0;
  if (opts.imageBytes) {
    side = Math.ceil(Math.sqrt(opts.imageBytes));
    const data = randomBytes(side * side);
    image = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${side} /Height ${side} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${data.length} >>\nstream\n`), data, Buffer.from('\nendstream')]));
  }
  const kids: number[] = [];
  pages.forEach((pl, pi) => {
    const parts: Buffer[] = [Buffer.from('BT /F1 10 Tf 13 TL 50 800 Td\n')];
    for (const l of pl) parts.push(Buffer.from('('), pdfString(l), Buffer.from(') Tj T*\n'));
    parts.push(Buffer.from('ET\n'));
    if (image && pi === pages.length - 1) parts.push(Buffer.from('q 120 0 0 120 420 40 cm /Im1 Do Q\n'));
    const content = Buffer.concat(parts);
    const c = add(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('endstream')]));
    const res = `<< /Font << /F1 ${font} 0 R >>${image ? ` /XObject << /Im1 ${image} 0 R >>` : ''} >>`;
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources ${res} /Contents ${c} 0 R >>`));
  });
  objs[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  objs[pagesObj - 1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = chunks[0].length;
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(offset);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from('\nendobj\n')]);
    chunks.push(b);
    offset += b.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref));
  return new Uint8Array(Buffer.concat(chunks));
}
