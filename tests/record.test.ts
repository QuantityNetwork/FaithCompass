import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { simulate } from '@/lib/record/engine';
import { CASE_MINIMUMS, checkRecord } from '@/lib/record/integrity';
import { AbrahamMosesRecord, RAW_RECORD, getRecord, publicView, revisionHash } from '@/lib/record/record';
import type { RecordData } from '@/lib/record/schema';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures/live', name), 'utf8'));

const record = getRecord();

describe('record integrity', () => {
  it('has no integrity errors', () => {
    const errors = checkRecord(record.data, record.graph()).filter((f) => f.level === 'error');
    expect(errors).toEqual([]);
  });

  it('establishes every claim when nothing is rejected', () => {
    const result = simulate(record.graph(), {});
    expect(result.affected).toEqual([]);
  });

  it('develops every flagship case to the same minimum depth', () => {
    expect(record.data.cases.map((c) => c.field).sort()).toEqual([
      'christian-studies',
      'islamic-studies',
      'jewish-studies',
      'latter-day-saint-studies',
    ]);
    for (const rc of record.data.cases) {
      const claims = record.claimsInCase(rc.slug);
      const counters = record.data.counterModels.filter((m) => claims.some((c) => c.code === m.targets));
      expect(claims.length, rc.slug).toBeGreaterThanOrEqual(CASE_MINIMUMS.claims);
      expect(rc.positions.length, rc.slug).toBeGreaterThanOrEqual(CASE_MINIMUMS.positions);
      expect(counters.length, rc.slug).toBeGreaterThanOrEqual(CASE_MINIMUMS.counterModels);
      expect(rc.responses.length, rc.slug).toBeGreaterThanOrEqual(CASE_MINIMUMS.responses);
    }
  });

  it('records at least one explicit non-comparability, so no tradition is forced into another’s question', () => {
    const responses = record.data.cases.flatMap((c) => c.responses.map((r) => r.response));
    expect(responses).toContain('not_comparable');
    expect(responses).toContain('reframes');
  });

  it('renames “Contemporary witness” to historical witnesses and material evidence', () => {
    const categories = new Set(record.data.works.map((w) => w.category));
    expect(categories.has('historical_witness')).toBe(true);
    expect(JSON.stringify(record.data)).not.toMatch(/Contemporary witness/);
  });
});

describe('the guided walkthrough', () => {
  it('changes one featured position and leaves its rival standing, in every case', () => {
    for (const rc of record.data.cases) {
      const r = simulate(record.graph(), { rejectAxioms: [rc.suggestedRejection] });
      const [a, b] = rc.featured;
      expect([r.statuses[a], r.statuses[b]].filter((s) => s === 'stands').length, rc.slug).toBe(1);
      expect(r.input.rejectClaims).toEqual([]);
    }
  });

  it('never alters a source: the record is identical before and after a simulation', () => {
    const before = JSON.stringify(record.data);
    simulate(record.graph(), { rejectAxioms: record.data.axioms.map((a) => a.code) });
    expect(JSON.stringify(record.data)).toBe(before);
  });
});

describe('fidelity to the published record', () => {
  const live = fixture('claims.json').data as Array<Record<string, unknown>>;

  it('reproduces every claim of the earlier ledger exactly as revision 1', () => {
    for (const l of live) {
      const claim = record.claim(l.code as string)!;
      const r1 = record.revision(claim, 1)!;
      // Imported without a recorded reviewer, so provisional — see STATUS_CORRECTION_2026_10_20.
      expect(r1.status).toBe('provisional');
      expect(r1.statement).toBe(l.statement);
      expect(r1.primaryWitnesses.map((w) => w.display)).toEqual(l.sources);
      expect(r1.headlineConfidence).toBe(l.textual_confidence);
      expect(r1.disputed).toBe(l.disputed);
      expect(r1.interpretiveDivergence).toBe(l.interpretive_divergence);
      expect(r1.publishedAt).toBe(l.updated_at);
      const provenance = fixture(`claim_${l.code}.json`).data.provenance as Array<{ label: string; detail: string }>;
      expect(r1.provenanceNotes).toEqual(provenance.map(({ label, detail }) => ({ label, detail })));
    }
  });

  it('keeps every published statement unchanged in later revisions', () => {
    for (const l of live) {
      const claim = record.claim(l.code as string)!;
      expect(record.current(claim).statement).toBe(l.statement);
    }
  });

  it('carries every published dependency into a derivation, with its rationale verbatim', () => {
    const deps = fixture('hermeneutics/deps.json') as Array<{
      a: { code: string };
      b: { code: string };
      necessity: string;
      rationale: string;
    }>;
    for (const d of deps) {
      const premise = record
        .derivationsOf(d.a.code)
        .flatMap((x) => x.premises)
        .find((p) => p.claim === d.b.code && p.rationale === d.rationale);
      expect(premise, `${d.a.code} → ${d.b.code}`).toBeDefined();
      expect(premise!.necessity).toBe(d.necessity);
    }
  });

  it('carries every published claim–axiom link with its note verbatim', () => {
    const links = fixture('hermeneutics/claim_axioms.json') as Array<{
      role: string;
      note: string;
      c: { code: string };
      x: { code: string };
    }>;
    for (const l of links) {
      const match = record
        .derivationsOf(l.c.code)
        .flatMap((d) => d.axioms)
        .find((a) => a.axiom === l.x.code && a.role === l.role && a.note === l.note);
      expect(match, `${l.c.code} ${l.role} ${l.x.code}`).toBeDefined();
    }
  });

  it('reproduces the published axioms, counter-models and map edges', () => {
    for (const a of fixture('hermeneutics/axioms.json') as Array<Record<string, string>>) {
      const axiom = record.axiom(a.code)!;
      expect([axiom.label, axiom.statement, axiom.rationale, axiom.heldBy]).toEqual([a.label, a.statement, a.rationale, a.tradition]);
    }
    for (const m of fixture('hermeneutics/counters.json') as Array<Record<string, unknown>>) {
      const cm = record.counterModel(m.code as string)!;
      expect([cm.title, cm.heldBy, cm.thesis, cm.alternativeReading, cm.strength]).toEqual([
        m.title,
        m.held_by,
        m.thesis,
        m.alternative_reading,
        m.strength,
      ]);
      expect(cm.evidence.map((e) => e.display)).toEqual(m.evidence);
    }
    for (const e of fixture('covenants.json').data as Array<Record<string, unknown>>) {
      const edge = record.covenantEdge(e.code as string)!;
      expect([edge.description, edge.relationshipType, edge.covenantName]).toEqual([e.description, e.relationship_type, e.covenant_name]);
    }
    for (const e of fixture('doctrine.json').data as Array<Record<string, unknown>>) {
      const edge = record.doctrineEdge(e.code as string)!;
      expect([edge.description, edge.traditionStatus, edge.topic]).toEqual([e.description, e.tradition_status, e.topic]);
    }
    expect(record.data.mapLinks.length).toBeGreaterThan(fixture('hermeneutics/maplinks.json').length);
  });
});

describe('corrected rejection semantics, against the published engine', () => {
  const published = fixture('hermeneutics_reject_AX002.json') as {
    claims: Array<{ code: string; effect: string }>;
    map_edges: Array<{ relationship_code: string; effect: string }>;
  };
  const ours = simulate(record.graph(), { rejectAxioms: ['AM-AX-002'] });

  it('no longer breaks a conclusion that has a second, independent derivation', () => {
    // The published engine collapsed AM-CLAIM-000191 when typology was rejected.
    expect(published.claims.find((c) => c.code === 'AM-CLAIM-000191')!.effect).toBe('collapses');
    // Hebrews 8's covenant argument does not need typology, so the claim survives, weakened.
    expect(ours.statuses['AM-CLAIM-000191']).toBe('weakened');
    expect(ours.derivations['AM-DRV-0006'].valid).toBe(false);
    expect(ours.derivations['AM-DRV-0007'].valid).toBe(true);
  });

  it('no longer collapses a map edge that a second claim still grounds', () => {
    expect(published.map_edges.find((e) => e.relationship_code === 'AM-DOC-0004')!.effect).toBe('collapses');
    const edge = ours.mapEdges.find((e) => e.code === 'AM-DOC-0004')!;
    expect(edge.status).toBe('weakened');
    expect(edge.groundedBy).toContain('AM-CLAIM-000186');
  });

  it('keeps a report standing as a report when only its reading is rejected', () => {
    // "Hebrews reads the silence of Genesis 14 as significant" — Hebrews still does.
    expect(ours.statuses['AM-CLAIM-000189']).toBe('unwarranted');
  });
});

describe('publication controls', () => {
  it('pins every public revision: a published revision cannot be edited in place', () => {
    const lock = JSON.parse(readFileSync(join(__dirname, '../src/lib/record/revisions.lock.json'), 'utf8')) as Record<string, string>;
    for (const claim of RAW_RECORD.claims) {
      for (const revision of claim.revisions) {
        if (revision.status === 'draft') continue;
        expect(lock[`${claim.code}@${revision.rev}`], `${claim.code}@${revision.rev}`).toBe(revisionHash(claim.code, revision));
      }
    }
  });

  it('keeps drafts out of the public record, with everything that depends on them', () => {
    const draftClaim = structuredClone(RAW_RECORD.claims[0]);
    draftClaim.code = 'AM-CLAIM-999999';
    draftClaim.revisions = draftClaim.revisions.map((r) => ({ ...r, status: 'draft' as const }));
    const raw: RecordData = {
      ...RAW_RECORD,
      claims: [...RAW_RECORD.claims, draftClaim],
      derivations: [
        ...RAW_RECORD.derivations,
        { ...RAW_RECORD.derivations[0], code: 'AM-DRV-9999', claim: 'AM-CLAIM-000191', premises: [{ ...RAW_RECORD.derivations[0].premises[0], claim: 'AM-CLAIM-999999' }] },
      ],
    };
    const pub = new AbrahamMosesRecord(publicView(raw));
    expect(pub.claim('AM-CLAIM-999999')).toBeUndefined();
    expect(pub.data.derivations.some((d) => d.code === 'AM-DRV-9999')).toBe(false);
    const preview = new AbrahamMosesRecord(publicView(raw, true), true);
    expect(preview.claim('AM-CLAIM-999999')).toBeDefined();
  });

  it('labels every revision drafted with machine assistance as such', () => {
    for (const claim of record.data.claims) {
      for (const r of claim.revisions) {
        if (r.rev > 1 || r.publishedAt >= '2026-10-14T12') {
          expect(r.machine.level, `${claim.code}@${r.rev}`).toBe('assisted');
          expect(r.status, `${claim.code}@${r.rev}`).toBe('provisional');
        }
      }
    }
  });

  it('versions the record by content', () => {
    expect(record.version).toMatch(/^[0-9a-f]{16}$/);
    expect(new AbrahamMosesRecord(record.data).version).toBe(record.version);
  });
});
