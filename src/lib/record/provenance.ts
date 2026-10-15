/**
 * Provenance chains and citations.
 *
 * The published ledger stored provenance as hand-written steps, and three of
 * its eight claims had none. Here a chain is generated for every claim from
 * the structured record — derivations, evidence, witnesses and their
 * editions, map links, acceptance and counter-models — using the eight step
 * labels the ledger established. Where a revision has authored steps, those
 * are kept and the structure is shown alongside.
 */

import type { AbrahamMosesRecord } from './record';
import type { Claim } from './schema';
import { ACCEPTANCE_META, CLASSIFICATION_META, STATUS_META, type AcceptanceStance } from './taxonomy';

export interface ProvenanceStep {
  position: number;
  label: string;
  detail: string;
  codes: string[];
}

export const PROVENANCE_LABELS = [
  'Finding',
  'Claims used',
  'Supporting evidence',
  'Primary source',
  'Covenant relationships',
  'Doctrine connections',
  'Interpretations',
  'Counterviews',
] as const;

export function generateProvenance(record: AbrahamMosesRecord, claim: Claim, rev?: number): ProvenanceStep[] {
  const r = (rev && record.revision(claim, rev)) || record.current(claim);
  if (r.provenanceNotes.length > 0) {
    return r.provenanceNotes.map((n, i) => ({ position: i + 1, label: n.label, detail: n.detail, codes: [] }));
  }

  const derivations = record.derivationsOf(claim.code);
  const premiseCodes = [...new Set(derivations.flatMap((d) => d.premises.map((p) => p.claim)))];
  const links = record.mapLinksFor(claim.code);
  const counters = record.counterModelsFor(claim.code);
  const grounded = CLASSIFICATION_META[r.classification].grounding !== 'derived';

  const claimsUsed =
    derivations.length === 0
      ? 'None — the claim is reported directly from its witness.'
      : derivations
          .map(
            (d) =>
              `${d.label}: ${d.premises.map((p) => `${p.claim} (${p.necessity})`).join(', ') || 'no premises'}${
                d.axioms.length ? `; reading principles ${d.axioms.map((a) => `${a.axiom} (${a.role === 'requires' ? 'required' : 'strengthening'})`).join(', ')}` : ''
              }`,
          )
          .join(' · ') + (grounded ? ' · The claim is also reported directly from its witness.' : '');

  const evidence = r.evidence.length
    ? r.evidence.map((e) => `${e.reference.display}${e.note ? ` — ${e.note}` : ''}`).join('; ')
    : `The primary witness itself: ${r.primaryWitnesses.map((w) => w.display).join('; ')}.`;

  const witnesses = r.primaryWitnesses
    .map((w) => {
      const work = record.work(w.work);
      return `${w.display}${work ? ` (${work.edition.title})` : ''}`;
    })
    .join('; ');

  const mapLine = (kind: 'covenant' | 'doctrine') => {
    const own = links.filter((l) => l.mapKind === kind);
    if (own.length === 0) return 'None recorded.';
    return own.map((l) => `${l.code} (${l.role}) — ${l.note}`).join('; ');
  };

  const byStance = new Map<AcceptanceStance, string[]>();
  for (const a of r.acceptance) {
    const list = byStance.get(a.stance) ?? [];
    list.push(record.tradition(a.tradition)?.name ?? a.tradition);
    byStance.set(a.stance, list);
  }
  const interpretations =
    r.acceptance.length > 0
      ? [...byStance.entries()].map(([stance, names]) => `${ACCEPTANCE_META[stance].label}: ${names.join(', ')}`).join('. ') + '.'
      : r.attribution.kind === 'textual_report'
        ? `As a report of what the text says, this is not disputed between traditions. ${r.interpretiveDivergence}`
        : r.interpretiveDivergence;

  const counterviews = counters.length
    ? counters.map((m) => `${m.code} “${m.title}”, held by ${m.heldBy}`).join('; ')
    : 'No counter-model recorded against this claim.';

  return [
    { position: 1, label: 'Finding', detail: `${r.statement} (${CLASSIFICATION_META[r.classification].label}.)`, codes: [claim.code] },
    { position: 2, label: 'Claims used', detail: claimsUsed, codes: premiseCodes },
    { position: 3, label: 'Supporting evidence', detail: evidence, codes: [] },
    { position: 4, label: 'Primary source', detail: witnesses, codes: [] },
    { position: 5, label: 'Covenant relationships', detail: mapLine('covenant'), codes: links.filter((l) => l.mapKind === 'covenant').map((l) => l.code) },
    { position: 6, label: 'Doctrine connections', detail: mapLine('doctrine'), codes: links.filter((l) => l.mapKind === 'doctrine').map((l) => l.code) },
    { position: 7, label: 'Interpretations', detail: interpretations, codes: [] },
    { position: 8, label: 'Counterviews', detail: counterviews, codes: counters.map((m) => m.code) },
  ];
}

/* ------------------------------------------------------------------ *
 * Citations
 * ------------------------------------------------------------------ */

function citeUrl(origin: string, code: string, rev: number) {
  return `${origin}/claims/${code}?rev=${rev}`;
}

function year(date: string) {
  return date.slice(0, 4);
}

export function citationText(record: AbrahamMosesRecord, claim: Claim, rev: number, origin = ''): string {
  const r = record.revision(claim, rev) ?? record.current(claim);
  const author = r.editorial.author;
  const status = STATUS_META[r.status].label.toLowerCase();
  const url = origin ? citeUrl(origin, claim.code, r.rev) : `/claims/${claim.code}?rev=${r.rev}`;
  return `${author}. “${r.statement}” AbrahamMoses Claim Ledger, ${claim.code}, revision ${r.rev} (${status}), ${r.publishedAt.slice(0, 10)}. ${url}`;
}

export function citationFormats(record: AbrahamMosesRecord, claim: Claim, rev: number, origin: string) {
  const r = record.revision(claim, rev) ?? record.current(claim);
  const url = citeUrl(origin, claim.code, r.rev);
  const key = `${claim.code.replace(/-/g, '').toLowerCase()}r${r.rev}`;
  const escapeTex = (s: string) => s.replace(/([{}&%$#_])/g, '\\$1');
  const bibtex = [
    `@misc{${key},`,
    `  author       = {{${escapeTex(r.editorial.author)}}},`,
    `  title        = {{${escapeTex(r.statement)}}},`,
    `  howpublished = {AbrahamMoses Claim Ledger, ${claim.code}, revision ${r.rev}},`,
    `  year         = {${year(r.publishedAt)}},`,
    `  note         = {${STATUS_META[r.status].label}},`,
    `  url          = {${url}}`,
    '}',
  ].join('\n');
  const csl = {
    id: `${claim.code}@${r.rev}`,
    type: 'entry-encyclopedia',
    title: r.statement,
    'container-title': 'AbrahamMoses Claim Ledger',
    author: [{ literal: r.editorial.author }],
    issued: { 'date-parts': [r.publishedAt.slice(0, 10).split('-').map(Number)] },
    version: String(r.rev),
    number: claim.code,
    note: STATUS_META[r.status].label,
    URL: url,
  };
  return { text: citationText(record, claim, r.rev, origin), bibtex, csl };
}
