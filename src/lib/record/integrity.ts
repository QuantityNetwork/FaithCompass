/**
 * Record integrity.
 *
 * One function, used by the test suite, the status page and /api/v1/status,
 * so "the record is consistent" means the same thing everywhere. Errors make
 * the record unpublishable; warnings are editorial work still outstanding,
 * shown publicly so a reader knows what has and has not been verified.
 */

import { baselineDefects, type DependencyGraph } from './engine';
import { RecordSchema, type RecordData } from './schema';
import { CASE_RESPONSES, STATUS_META, isGroundedInSource } from './taxonomy';

export interface Finding {
  level: 'error' | 'warning';
  code: string;
  subject: string;
  message: string;
}

/** Minimum depth every flagship case must reach, so no tradition's case is a token entry. */
export const CASE_MINIMUMS = { claims: 12, positions: 3, counterModels: 3, responses: 6 } as const;

export function checkRecord(data: RecordData, graph: DependencyGraph): Finding[] {
  const out: Finding[] = [];
  const err = (code: string, subject: string, message: string) => out.push({ level: 'error', code, subject, message });
  const warn = (code: string, subject: string, message: string) => out.push({ level: 'warning', code, subject, message });

  const parsed = RecordSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 20)) {
      err('schema', issue.path.join('.'), issue.message);
    }
    return out;
  }

  const unique = (label: string, codes: string[]) => {
    const seen = new Set<string>();
    for (const c of codes) {
      if (seen.has(c)) err('duplicate_code', c, `Duplicate ${label} code.`);
      seen.add(c);
    }
    return seen;
  };

  const claims = unique('claim', data.claims.map((c) => c.code));
  const axioms = unique('axiom', data.axioms.map((a) => a.code));
  const derivations = unique('derivation', data.derivations.map((d) => d.code));
  unique('counter-model', data.counterModels.map((m) => m.code));
  const covenantCodes = unique('covenant', data.covenants.map((e) => e.code));
  const doctrineCodes = unique('doctrine', data.doctrine.map((e) => e.code));
  const traditions = new Set(data.traditions.map((t) => t.id));
  const works = new Set(data.works.map((w) => w.id));
  const translations = new Set(data.translations.map((t) => t.id));
  const cases = new Set(data.cases.map((c) => c.slug));
  const covenantNodes = new Set(data.covenantNodes.map((n) => n.id));
  const doctrineNodes = new Set(data.doctrineNodes.map((n) => n.id));
  void derivations;

  const tradition = (id: string, subject: string) => {
    if (!traditions.has(id)) err('unknown_tradition', subject, `Unknown tradition "${id}".`);
  };
  const work = (id: string, subject: string) => {
    if (!works.has(id)) err('unknown_work', subject, `Unknown work "${id}".`);
  };

  /* Claims and revisions */
  for (const c of data.claims) {
    c.revisions.forEach((r, i) => {
      if (r.rev !== i + 1) err('revision_sequence', c.code, `Revision ${r.rev} is out of sequence (expected ${i + 1}).`);
      if (i > 0 && r.publishedAt < c.revisions[i - 1].publishedAt) {
        err('revision_order', c.code, `Revision ${r.rev} is dated before revision ${r.rev - 1}.`);
      }
      for (const ref of [...r.primaryWitnesses, ...r.evidence.map((e) => e.reference), ...r.variants.map((v) => v.reference)]) {
        work(ref.work, c.code);
      }
      for (const q of r.quotations) {
        work(q.reference.work, c.code);
        if (q.translation && !translations.has(q.translation)) {
          err('unknown_translation', c.code, `Unknown translation "${q.translation}".`);
        }
      }
      for (const a of r.acceptance) tradition(a.tradition, c.code);
      for (const t of r.attribution.traditions) tradition(t, c.code);
    });
    for (const slug of c.cases) if (!cases.has(slug)) err('unknown_case', c.code, `Unknown case "${slug}".`);

    const current = c.revisions[c.revisions.length - 1];
    if (!isGroundedInSource(current.classification) && !data.derivations.some((d) => d.claim === c.code)) {
      err('underived', c.code, 'A derived claim (inference or interpretation) has no recorded derivation.');
    }
    if (current.confidence === null) warn('no_confidence_profile', c.code, 'The current revision has no confidence profile.');
    if (current.machine.verification === 'pending') {
      warn('verification_pending', c.code, `Revision ${current.rev} awaits editorial verification.`);
    }
    if (current.editorial.reviewers.length === 0 && current.status === 'externally_reviewed') {
      err('reviewer_missing', c.code, 'Marked externally reviewed with no reviewer recorded.');
    }
  }

  /* Derivations */
  for (const d of data.derivations) {
    if (!claims.has(d.claim)) err('unknown_claim', d.code, `Derivation of unknown claim ${d.claim}.`);
    for (const p of d.premises) {
      if (!claims.has(p.claim)) err('unknown_claim', d.code, `Unknown premise ${p.claim}.`);
      if (p.claim === d.claim) err('self_premise', d.code, 'A claim cannot be its own premise.');
    }
    for (const a of d.axioms) if (!axioms.has(a.axiom)) err('unknown_axiom', d.code, `Unknown axiom ${a.axiom}.`);
    if (d.premises.length === 0 && d.axioms.length === 0) {
      err('empty_derivation', d.code, 'A derivation must name at least one premise or axiom.');
    }
  }

  /* Axioms */
  for (const a of data.axioms) {
    for (const s of a.stances) tradition(s.tradition, a.code);
    if (a.stancesStatus === 'provisional') warn('stances_provisional', a.code, 'Tradition stances await editorial verification.');
  }

  /* Counter-models */
  for (const m of data.counterModels) {
    if (!claims.has(m.targets)) err('unknown_claim', m.code, `Targets unknown claim ${m.targets}.`);
    if (m.position && !claims.has(m.position)) err('unknown_claim', m.code, `Unknown position ${m.position}.`);
    for (const a of [...m.reliesOn, ...m.rejects]) if (!axioms.has(a)) err('unknown_axiom', m.code, `Unknown axiom ${a}.`);
    for (const t of m.traditions) tradition(t, m.code);
    for (const e of m.evidence) work(e.work, m.code);
  }

  /* Maps */
  for (const e of data.covenants) {
    if (!covenantNodes.has(e.source) || !covenantNodes.has(e.target)) err('unknown_node', e.code, 'Covenant edge references an unknown node.');
    for (const ref of e.evidence) work(ref.work, e.code);
  }
  for (const e of data.doctrine) {
    if (!doctrineNodes.has(e.source) || !doctrineNodes.has(e.target)) err('unknown_node', e.code, 'Doctrine edge references an unknown node.');
    for (const ref of e.evidence) work(ref.work, e.code);
  }
  for (const l of data.mapLinks) {
    const known = l.mapKind === 'covenant' ? covenantCodes : doctrineCodes;
    if (!known.has(l.code)) err('unknown_edge', l.code, `Map link to unknown ${l.mapKind} edge.`);
    if (!claims.has(l.claim)) err('unknown_claim', l.code, `Map link to unknown claim ${l.claim}.`);
  }

  /* Cases */
  for (const rc of data.cases) {
    const positionCodes = rc.positions.map((p) => p.claim);
    for (const p of rc.positions) {
      if (!claims.has(p.claim)) err('unknown_claim', rc.slug, `Unknown position ${p.claim}.`);
      if (!data.derivations.some((d) => d.claim === p.claim)) err('underived', rc.slug, `Position ${p.claim} has no derivation.`);
      for (const t of p.heldBy) tradition(t, rc.slug);
      const c = data.claims.find((x) => x.code === p.claim);
      if (c && !c.cases.includes(rc.slug)) err('case_membership', rc.slug, `Position ${p.claim} does not list this case.`);
    }
    for (const f of rc.featured) if (!positionCodes.includes(f)) err('featured', rc.slug, `Featured ${f} is not a position.`);
    if (!axioms.has(rc.suggestedRejection)) err('unknown_axiom', rc.slug, `Unknown suggested rejection ${rc.suggestedRejection}.`);
    for (const r of rc.responses) {
      tradition(r.tradition, rc.slug);
      if (!CASE_RESPONSES.includes(r.response)) err('response', rc.slug, `Unknown response ${r.response}.`);
      if (r.position && !claims.has(r.position)) err('unknown_claim', rc.slug, `Unknown response position ${r.position}.`);
    }

    // Equal treatment: every flagship case meets the same minimum depth.
    const inCase = data.claims.filter((c) => c.cases.includes(rc.slug)).map((c) => c.code);
    const counters = data.counterModels.filter((m) => inCase.includes(m.targets)).length;
    const depth = { claims: inCase.length, positions: rc.positions.length, counterModels: counters, responses: rc.responses.length };
    for (const [key, min] of Object.entries(CASE_MINIMUMS) as Array<[keyof typeof CASE_MINIMUMS, number]>) {
      if (depth[key] < min) err('case_depth', rc.slug, `Has ${depth[key]} ${key}; every flagship case needs at least ${min}.`);
    }
    if (STATUS_META[rc.status].label === 'Provisional') {
      warn('case_provisional', rc.slug, 'The case awaits editorial verification and review by scholars of the tradition.');
    }
  }

  /* Translations */
  for (const t of data.translations) {
    if (!t.verified) warn('translation_unverified', t.id, 'Quotations attributed to this translation await verification.');
  }

  /* Every claim must be established when nothing is rejected (no unsupported cycles). */
  for (const code of baselineDefects(graph)) {
    err('ungrounded', code, 'Not established at baseline: its derivations are circular or rest on missing claims.');
  }

  return out;
}

export function summarise(findings: Finding[]) {
  return {
    errors: findings.filter((f) => f.level === 'error').length,
    warnings: findings.filter((f) => f.level === 'warning').length,
  };
}
