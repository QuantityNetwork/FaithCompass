/**
 * Private evidence workspaces: the data model.
 *
 * A workspace is a tenant (`tenants/{t}` in Firestore). Members import source documents, propose decisions that cite
 * passages of those documents, and a second member with the tenant role `editor` approves or rejects each decision.
 * Membership comes from the custom claim `am_tenants` (a map tenant id → 'member' | 'editor'), which only the project
 * owner can set (Firebase CLI or console); no client can write it. firestore.rules enforce every rule here again, so
 * the server can never do more than the signed-in user could do directly.
 */
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';

export type TenantRole = 'member' | 'editor';

export const TENANT_ID = /^[a-z0-9][a-z0-9-]{1,62}$/;
export const ENTITY_ID = /^[A-Za-z0-9_-]{6,64}$/;

/** Plain-text formats accepted by import. PDF and Word files are not parsed yet (stated on the page). */
export const IMPORT_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.html': 'text/html',
  '.htm': 'text/html',
};
export const MAX_IMPORT_BYTES = 200_000;
export const MAX_PASSAGES = 1_500;
export const MAX_PASSAGE_CHARS = 1_800;

export const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export function tenantRoles(claim: unknown): Record<string, TenantRole> {
  const out: Record<string, TenantRole> = {};
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return out;
  for (const [t, r] of Object.entries(claim as Record<string, unknown>)) {
    if (TENANT_ID.test(t) && (r === 'member' || r === 'editor')) out[t] = r;
  }
  return out;
}

export interface Passage {
  n: number;
  text: string;
  sha256: string;
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export function mediaTypeFor(filename: string): string | null {
  const m = /\.[A-Za-z0-9]+$/.exec(filename.trim());
  return m ? (IMPORT_TYPES[m[0].toLowerCase()] ?? null) : null;
}

/** HTML to text: scripts and styles dropped, block ends become paragraph breaks, entities for the common cases. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|pre|table|ul|ol)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Normalise text: Unicode NFC, LF line ends, no NUL or other control characters except tab and newline. */
export function normaliseText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Split text into numbered passages: paragraphs separated by blank lines; a paragraph longer than MAX_PASSAGE_CHARS is
 * split at line ends, then at sentence ends, then hard. CSV is one passage per row (with the header row repeated in
 * none of them; row 1 is passage 1).
 */
export function passagesOf(text: string, mediaType: string): Passage[] {
  const blocks = mediaType === 'text/csv' ? text.split('\n') : text.split(/\n{2,}/);
  const pieces: string[] = [];
  for (const b of blocks.map((x) => x.trim()).filter(Boolean)) {
    if (b.length <= MAX_PASSAGE_CHARS) {
      pieces.push(b);
      continue;
    }
    let cur = '';
    for (const unit of b.split(/(?<=\n)|(?<=[.!?])\s+/)) {
      if ((cur + unit).length > MAX_PASSAGE_CHARS && cur) {
        pieces.push(cur.trim());
        cur = '';
      }
      let u = unit;
      while (u.length > MAX_PASSAGE_CHARS) {
        pieces.push(u.slice(0, MAX_PASSAGE_CHARS));
        u = u.slice(MAX_PASSAGE_CHARS);
      }
      cur += u + (unit.endsWith('\n') ? '' : ' ');
    }
    if (cur.trim()) pieces.push(cur.trim());
  }
  if (pieces.length > MAX_PASSAGES) throw new ImportError(`The document has ${pieces.length} passages; at most ${MAX_PASSAGES} are accepted.`);
  return pieces.map((p, i) => ({ n: i + 1, text: p, sha256: sha256Hex(p) }));
}

export interface ParsedImport {
  title: string;
  filename: string;
  mediaType: string;
  bytes: number;
  fileSha256: string;
  text: string;
  textSha256: string;
  passages: Passage[];
}

/** Parse an uploaded file. `fileSha256` is the hash of the exact bytes received, before any normalisation. */
export function parseImport(input: { filename: string; title?: string; bytes: Uint8Array }): ParsedImport {
  const filename = input.filename.trim().replace(/[\\/]/g, '_').slice(0, 200);
  if (!filename) throw new ImportError('A file name is required.');
  const mediaType = mediaTypeFor(filename);
  if (!mediaType) throw new ImportError(`Unsupported file type. Accepted: ${Object.keys(IMPORT_TYPES).join(', ')} (PDF and Word are not parsed yet; export them as text).`, 415);
  if (input.bytes.byteLength === 0) throw new ImportError('The file is empty.');
  if (input.bytes.byteLength > MAX_IMPORT_BYTES) throw new ImportError(`The file is ${input.bytes.byteLength} bytes; the limit is ${MAX_IMPORT_BYTES}.`, 413);
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
  } catch {
    throw new ImportError('The file is not valid UTF-8 text.', 415);
  }
  if (mediaType === 'application/json') {
    try {
      JSON.parse(decoded);
    } catch {
      throw new ImportError('The file is not valid JSON.');
    }
  }
  const text = normaliseText(mediaType === 'text/html' ? htmlToText(decoded) : decoded);
  if (!text) throw new ImportError('The file contains no text.');
  const title = (input.title ?? '').trim().slice(0, 200) || filename.replace(/\.[^.]+$/, '');
  return {
    title,
    filename,
    mediaType,
    bytes: input.bytes.byteLength,
    fileSha256: createHash('sha256').update(input.bytes).digest('hex'),
    text,
    textSha256: sha256Hex(text),
    passages: passagesOf(text, mediaType),
  };
}

/* ---------- stored records ---------- */

export interface WorkspaceDocument extends ParsedImport {
  id: string;
  tenant: string;
  importedBy: string;
  importedByEmail: string | null;
  importedAt: string;
  auditId: string;
}

export interface EvidenceRef {
  documentId: string;
  passage: number;
  /** SHA-256 of the cited passage text, checked against the stored document when the decision is proposed. */
  passageSha256: string;
  note: string;
}

export type DecisionStatus = 'proposed' | 'approved' | 'rejected';

export interface WorkspaceDecision {
  id: string;
  tenant: string;
  title: string;
  question: string;
  conclusion: string;
  rationale: string;
  evidence: EvidenceRef[];
  status: DecisionStatus;
  proposedBy: string;
  proposedByEmail: string | null;
  proposedAt: string;
  proposalAuditId: string;
  decidedBy: string | null;
  decidedByEmail: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  decisionAuditId: string | null;
}

export type AuditChange = 'IMPORTED' | 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXPORTED';

export interface WorkspaceAuditEvent {
  id: string;
  tenant: string;
  changeType: AuditChange;
  entityType: 'DOCUMENT' | 'DECISION';
  entityId: string;
  actorId: string;
  actorEmail: string | null;
  at: string;
  detail: string;
}

export interface PassportRecord {
  sha256: string;
  tenant: string;
  decisionId: string;
  decisionStatus: DecisionStatus;
  passportId: string;
  exportedBy: string;
  exportedAt: string;
  signed: boolean;
}

export const ProposeSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    question: z.string().trim().min(3).max(2_000),
    conclusion: z.string().trim().min(3).max(4_000),
    rationale: z.string().trim().max(8_000).default(''),
    evidence: z
      .array(
        z.object({
          documentId: z.string().regex(ENTITY_ID),
          passage: z.number().int().min(1).max(MAX_PASSAGES),
          note: z.string().trim().max(1_000).default(''),
        }),
      )
      .min(1)
      .max(50),
  })
  .strict();

export const DecideSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    note: z.string().trim().min(3).max(2_000),
  })
  .strict();

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(15).toString('base64url')}`;
}
