import { describe, expect, it } from 'vitest';
import {
  isDisplayableAsAuthoritative,
  verificationCaveat,
  verifyCitations,
  verificationStateFor,
} from '@/lib/evidence/citations';
import { allCorpusEntries, effectiveIndependence, filterCorpus, getCorpusEntry } from '@/lib/evidence/corpus';

describe('citation verification', () => {
  it('resolves a real corpus record', () => {
    const { sources, flags } = verifyCitations(['insc.pilate-stone']);
    expect(flags).toHaveLength(0);
    expect(sources).toHaveLength(1);
    expect(sources[0].title).toMatch(/Pilate Stone/);
  });

  it('drops an invented citation and flags it rather than reshaping it', () => {
    const { sources, flags } = verifyCitations([
      'sch.definitely-real-2019',
      'insc.pilate-stone',
    ]);
    expect(sources.map((s) => s.id)).toEqual(['insc.pilate-stone']);
    expect(flags).toHaveLength(1);
    expect(flags[0].sourceRef).toBe('sch.definitely-real-2019');
    expect(flags[0].reason).toContain('could not be independently verified');
  });

  it('does not double-count a source cited twice', () => {
    const { sources } = verifyCitations(['ms.4qdan', 'ms.4qdan']);
    expect(sources).toHaveLength(1);
  });

  it('does not promote a record to VERIFIED merely by citing it', () => {
    const { sources } = verifyCitations(['sch.calvin-daniel']);
    expect(sources[0].verified).toBe('INTERNAL_CORPUS');
    expect(isDisplayableAsAuthoritative(sources[0])).toBe(false);
  });

  it('marks a record with an external identifier as partially verified', () => {
    const { sources } = verifyCitations(['sch.collins-daniel']);
    expect(sources[0].verified).toBe('PARTIALLY_VERIFIED');
    expect(verificationCaveat(sources[0])).toContain('no live catalogue check');
  });

  it('preserves an explicit UNVERIFIED state and surfaces it as such', () => {
    const { sources } = verifyCitations(['gen.native-american-ancestry-literature']);
    expect(sources[0].verified).toBe('UNVERIFIED');
    expect(isDisplayableAsAuthoritative(sources[0])).toBe(false);
    expect(verificationCaveat(sources[0])).toBe('Source could not be independently verified.');
  });

  it('never assigns VERIFIED without an actual catalogue check on the entry', () => {
    for (const entry of allCorpusEntries()) {
      if (verificationStateFor(entry) === 'VERIFIED') {
        expect(entry.verified).toBe('VERIFIED');
      }
    }
  });
});

describe('source independence', () => {
  it('discounts a source when the source it depends on is also cited', () => {
    const withParent = effectiveIndependence(['ed.bhs', 'ms.leningradensis']);
    const alone = effectiveIndependence(['ed.bhs']);
    expect(withParent.get('ed.bhs')!).toBeLessThan(alone.get('ed.bhs')!);
  });

  it('leaves a genuinely independent source undiscounted', () => {
    const map = effectiveIndependence(['insc.pilate-stone', 'anc.philo-legatio']);
    expect(map.get('insc.pilate-stone')).toBe(getCorpusEntry('insc.pilate-stone')!.independence);
  });

  it('treats an unresolvable reference as contributing nothing', () => {
    expect(effectiveIndependence(['not.a.real.source']).get('not.a.real.source')).toBe(0);
  });
});

describe('corpus filtering', () => {
  it('restricts to primary evidence when asked for primary sources only', () => {
    const primary = filterCorpus({ primaryOnly: true });
    expect(primary.length).toBeGreaterThan(0);
    expect(primary.every((e) => e.qualityTier === 'A')).toBe(true);
  });

  it('restricts by composition date for an "evidence before AD 500" lens', () => {
    const early = filterCorpus({ beforeYear: 500 });
    expect(early.length).toBeGreaterThan(0);
    expect(early.every((e) => (e.yearApprox ?? Infinity) <= 500)).toBe(true);
    expect(early.map((e) => e.id)).not.toContain('sch.collins-daniel');
  });

  it('restricts by standpoint without removing a tradition from the corpus', () => {
    const lds = filterCorpus({ perspectives: ['LATTER_DAY_SAINT'] });
    expect(lds.length).toBeGreaterThan(0);
  });
});

describe('corpus integrity', () => {
  it('has unique ids', () => {
    const ids = allCorpusEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('records a reliability assessment and a citation for every entry', () => {
    for (const entry of allCorpusEntries()) {
      expect(entry.citation.length, entry.id).toBeGreaterThan(10);
      expect(entry.reliabilityAssessment.length, entry.id).toBeGreaterThan(30);
      expect(entry.independence, entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.independence, entry.id).toBeLessThanOrEqual(1);
    }
  });

  it('only declares dependencies on entries that exist', () => {
    for (const entry of allCorpusEntries()) {
      for (const dep of entry.dependsOn ?? []) {
        expect(getCorpusEntry(dep), `${entry.id} depends on missing ${dep}`).toBeDefined();
      }
    }
  });
});
