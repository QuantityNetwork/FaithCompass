/**
 * Decision Room: pure helpers over the evidence workspace's own records (documents, decisions, audit, passports).
 * Nothing here talks to a server or decides anything; the room page renders what these return.
 */
/** The workspace's id formats (lib/workspace/model.ts, which imports node:crypto and so stays server-side). */
export const TENANT_ID = /^[a-z0-9][a-z0-9-]{1,62}$/;
export const ENTITY_ID = /^[A-Za-z0-9_-]{6,64}$/;

export type ReviewStatus = 'proposed' | 'approved' | 'rejected';

export interface RoomPassage { n: number; text: string; sha256: string }
export interface RoomDocument { id: string; title: string; filename: string; textSha256: string; passages: RoomPassage[] }
export interface RoomCitation { documentId: string; passage: number; passageSha256: string; note: string }
export interface RoomDecision {
  id: string;
  title: string;
  question: string;
  conclusion: string;
  rationale: string;
  status: ReviewStatus;
  evidence: RoomCitation[];
  proposedBy: string;
  proposedByEmail: string | null;
  proposedAt: string;
  decidedBy: string | null;
  decidedByEmail: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface ResolvedCitation {
  index: number;
  documentId: string;
  documentTitle: string | null;
  passage: number;
  note: string;
  text: string | null;
  /** true: the passage still hashes as cited; false: the stored passage differs; null: document or passage not found. */
  intact: boolean | null;
}

/** Each citation of the decision, with the passage text it points to and whether that passage is unchanged. */
export function resolveEvidence(decision: Pick<RoomDecision, 'evidence'>, docs: ReadonlyMap<string, RoomDocument>): ResolvedCitation[] {
  return decision.evidence.map((c, index) => {
    const doc = docs.get(c.documentId);
    const p = doc?.passages.find((x) => x.n === c.passage);
    return {
      index,
      documentId: c.documentId,
      documentTitle: doc?.title ?? null,
      passage: c.passage,
      note: c.note,
      text: p?.text ?? null,
      intact: p ? p.sha256 === c.passageSha256 : null,
    };
  });
}

/** A document's text as the workspace stored it: its numbered passages, in order, separated by blank lines. */
export function documentText(doc: Pick<RoomDocument, 'passages'>): string {
  return [...doc.passages].sort((a, b) => a.n - b.n).map((p) => p.text).join('\n\n');
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Whether a quoted span (e.g. one side of a contradiction) lies in, or contains, a cited passage. */
export function quoteTouchesPassage(quote: string, passageText: string): boolean {
  const q = norm(quote);
  const t = norm(passageText);
  if (q.length < 12 || t.length < 12) return q.length > 0 && q === t;
  return t.includes(q) || q.includes(t);
}

/** Citation indexes whose passage is quoted by any of the given contradiction quotes. */
export function implicatedCitations(cites: readonly ResolvedCitation[], contradictionQuotes: readonly string[]): Set<number> {
  const out = new Set<number>();
  for (const c of cites) if (c.text && contradictionQuotes.some((q) => quoteTouchesPassage(q, c.text!))) out.add(c.index);
  return out;
}

export interface Counterfactual {
  withdrawn: number;
  remaining: number;
  remainingDocuments: number;
  unsupported: boolean;
  /** Documents that would no longer be cited at all. */
  droppedDocuments: string[];
  /** Remaining citations that a contradiction finding touches. */
  remainingContested: number;
  summary: string;
}

/**
 * Evidence-withdrawal counterfactual: if these citations were struck out (a document withdrawn, a passage found
 * wrong), what would the decision still rest on? It does not re-decide anything; it shows the dependency.
 */
export function counterfactual(cites: readonly ResolvedCitation[], withdrawn: ReadonlySet<number>, contested: ReadonlySet<number>): Counterfactual {
  const left = cites.filter((c) => !withdrawn.has(c.index));
  const docsBefore = new Set(cites.map((c) => c.documentId));
  const docsAfter = new Set(left.map((c) => c.documentId));
  const droppedDocuments = [...docsBefore].filter((d) => !docsAfter.has(d));
  const remainingContested = left.filter((c) => contested.has(c.index)).length;
  const unsupported = left.length === 0;
  const n = withdrawn.size;
  let summary: string;
  if (n === 0) summary = `As recorded: ${cites.length} cited passage${cites.length === 1 ? '' : 's'} from ${docsBefore.size} document${docsBefore.size === 1 ? '' : 's'}.`;
  else if (unsupported) summary = 'No cited evidence would remain. The conclusion would rest on nothing in the record and should be reopened.';
  else
    summary =
      `${left.length} cited passage${left.length === 1 ? '' : 's'} from ${docsAfter.size} document${docsAfter.size === 1 ? '' : 's'} would remain` +
      (droppedDocuments.length ? `; ${droppedDocuments.length} document${droppedDocuments.length === 1 ? '' : 's'} would no longer be cited` : '') +
      (remainingContested ? `; ${remainingContested} of the remaining passage${remainingContested === 1 ? ' is' : 's are'} touched by a contradiction` : '') +
      '. Whether the conclusion still follows is for the reviewers to judge.';
  return { withdrawn: n, remaining: left.length, remainingDocuments: docsAfter.size, unsupported, droppedDocuments, remainingContested, summary };
}

export interface Review {
  state: 'awaiting' | 'approved' | 'rejected';
  /** The two-person rule: the decider is a different account from the proposer. Null while awaiting review. */
  twoPersonRule: boolean | null;
  label: string;
}

export function reviewOf(d: Pick<RoomDecision, 'status' | 'proposedBy' | 'decidedBy'>): Review {
  if (d.status === 'proposed') return { state: 'awaiting', twoPersonRule: null, label: 'Awaiting review by a second editor' };
  const ok = !!d.decidedBy && d.decidedBy !== d.proposedBy;
  return { state: d.status, twoPersonRule: ok, label: d.status === 'approved' ? 'Approved by a second person' : 'Rejected by a second person' };
}

/** What the signed-in account may do in this room. */
export function reviewActions(d: Pick<RoomDecision, 'status' | 'proposedBy'>, uid: string, role: 'member' | 'editor' | null): { canReview: boolean; reason: string } {
  if (d.status !== 'proposed') return { canReview: false, reason: 'This decision has been reviewed; the record is closed.' };
  if (d.proposedBy === uid) return { canReview: false, reason: 'You proposed this decision. Another editor must review it (two-person rule).' };
  if (role !== 'editor') return { canReview: false, reason: 'Reviewing needs the editor role in this workspace.' };
  return { canReview: true, reason: 'You may approve or reject this decision. A review note is required.' };
}

/** Room address within the Decision Room page. Workspace and decision ids are validated server-side as well. */
export function roomHref(tenant: string, decisionId: string): string {
  return `/institutional/decision-room?w=${encodeURIComponent(tenant)}&d=${encodeURIComponent(decisionId)}`;
}
export function parseRoomParams(sp: Record<string, string | string[] | undefined>): { w: string; d: string } | null {
  const w = typeof sp.w === 'string' ? sp.w : '';
  const d = typeof sp.d === 'string' ? sp.d : '';
  return TENANT_ID.test(w) && ENTITY_ID.test(d) ? { w, d } : null;
}
