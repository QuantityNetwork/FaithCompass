/**
 * The command palette's index: every public record a reader can open, built from the
 * same record the pages render (not a snapshot). Served as one static JSON file and
 * searched in the browser, so a query never leaves the reader's device.
 */
import { SEEDED_SUBJECTS } from '@/lib/evidence/seed';
import { getRecord } from '@/lib/record/record';
import { CLASSIFICATION_META, REVIEW_STATE_LABELS } from '@/lib/record/taxonomy';
import { NAV_SECTIONS } from './nav';

export interface SearchItem {
  /** Group heading. */
  g: string;
  /** Short kind label (left column). */
  k: string;
  /** Title. */
  t: string;
  /** Subtitle. */
  s?: string;
  /** Destination path. */
  u: string;
  /** Extra text that matches but is not shown. */
  x?: string;
}

export const SEARCH_GROUP_ORDER = ['Research', 'Claims', 'Assumptions', 'Counter-models', 'Traditions', 'Sources', 'Evidence assessments', 'Go to'];

export function buildSearchIndex(): { version: string; items: SearchItem[] } {
  const record = getRecord();
  const items: SearchItem[] = [];

  for (const c of record.data.cases) {
    items.push({
      g: 'Research',
      k: 'Case',
      t: c.question,
      s: `${c.title} · ${REVIEW_STATE_LABELS[c.status].toLowerCase()}`,
      u: `/research/${c.slug}`,
      x: c.aliases.join(' '),
    });
  }

  for (const claim of record.data.claims) {
    const r = record.current(claim);
    items.push({
      g: 'Claims',
      k: claim.code.replace('AM-CLAIM-', ''),
      t: r.statement,
      s: [claim.code, CLASSIFICATION_META[r.classification].label, r.primaryWitnesses.map((w) => w.display).join('; ')].join(' · '),
      u: `/claims/${claim.code}`,
    });
  }

  for (const a of record.data.axioms) {
    items.push({ g: 'Assumptions', k: a.code.replace('AM-', ''), t: a.label, s: `${a.heldBy} · ${a.statement}`, u: `/hermeneutics#${a.code}` });
  }

  for (const m of record.data.counterModels) {
    items.push({ g: 'Counter-models', k: m.code.replace('AM-', ''), t: m.title, s: `${m.heldBy} · ${m.thesis}`, u: `/hermeneutics#${m.code}` });
  }

  for (const t of record.data.traditions) {
    items.push({ g: 'Traditions', k: 'Tradition', t: t.name, s: t.nativeCategories.slice(0, 4).join(' · '), u: `/traditions/${t.id}` });
  }

  for (const w of record.data.works) {
    items.push({ g: 'Sources', k: 'Work', t: w.title, s: [w.edition.title, w.edition.year].filter(Boolean).join(' · '), u: `/corpus#${w.category}`, x: w.aliases.join(' ') });
  }

  for (const s of SEEDED_SUBJECTS) {
    items.push({ g: 'Evidence assessments', k: 'AI-drafted', t: s.title, s: s.subtitle ?? 'Awaiting editorial review', u: `/evidence/${s.slug}`, x: s.aliases.join(' ') });
  }

  items.push({ g: 'Go to', k: 'Page', t: 'Home', u: '/' });
  for (const section of NAV_SECTIONS) {
    for (const p of section.pages) {
      if (p.href.startsWith('/api/')) continue;
      items.push({ g: 'Go to', k: section.label, t: p.label, u: p.href });
    }
  }

  return { version: record.version, items };
}
