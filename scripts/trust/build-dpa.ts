/**
 * Builds the downloadable DPA template from src/lib/trust/dpa.ts:
 *   public/trust/abrahammoses-dpa-template-v<version>.docx   (python-docx, scripts/trust/build_dpa.py)
 *   public/trust/abrahammoses-dpa-template-v<version>.pdf    (LibreOffice, from the .docx)
 *   public/trust/dpa-manifest.json                            (content digest; tests/trust.test.ts checks it)
 *
 *   npx tsx scripts/trust/build-dpa.ts
 *
 * Needs python3 with python-docx and LibreOffice (soffice) on the machine that runs it; CI only checks the digest.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DPA_FILES, DPA_VERSION, dpaDigest, dpaDocument } from '../../src/lib/trust/dpa';

const ROOT = join(__dirname, '../..');
const pub = (p: string) => join(ROOT, 'public', p);
const tmp = mkdtempSync(join(tmpdir(), 'dpa-'));
const json = join(tmp, 'dpa.json');
writeFileSync(json, JSON.stringify(dpaDocument()));
const docx = pub(DPA_FILES.docx);
execFileSync('python3', [join(__dirname, 'build_dpa.py'), json, docx], { stdio: 'inherit' });
execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', tmp, docx], { stdio: 'inherit' });
renameSync(join(tmp, DPA_FILES.docx.split('/').pop()!.replace(/\.docx$/, '.pdf')), pub(DPA_FILES.pdf));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(
  pub('/trust/dpa-manifest.json'),
  `${JSON.stringify({ version: DPA_VERSION, contentSha256: dpaDigest(), files: { docx: { path: DPA_FILES.docx, sha256: sha(docx) }, pdf: { path: DPA_FILES.pdf, sha256: sha(pub(DPA_FILES.pdf)) } } }, null, 2)}\n`,
);
console.log(`DPA template v${DPA_VERSION}: ${DPA_FILES.docx}, ${DPA_FILES.pdf}`);
