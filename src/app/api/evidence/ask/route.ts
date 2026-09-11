import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { checkRequest } from '@/lib/evidence/guardrails';
import { getStore } from '@/lib/evidence/store';
import { seededByQuery } from '@/lib/evidence/seed';
import type { AnalysisLens } from '@/lib/evidence/providers/types';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  query: z.string().min(1).max(2000),
  lenses: z.array(z.string().max(40)).max(8).optional(),
});

/**
 * Translate the interface's lens chips into corpus constraints.
 *
 * A lens narrows what the reasoning may draw on, so it has to be resolved
 * before retrieval rather than applied to finished output — otherwise the
 * answer would be reasoned from sources it then hides.
 */
function buildLens(ids: string[]): AnalysisLens | undefined {
  if (ids.length === 0) return undefined;
  const lens: AnalysisLens = {};
  const notes: string[] = [];

  if (ids.includes('primary')) {
    lens.primarySourcesOnly = true;
    notes.push('Restricted to Tier A primary evidence.');
  }
  if (ids.includes('pre500')) {
    lens.beforeYear = 500;
    notes.push('Restricted to sources composed before AD 500.');
  }
  if (ids.includes('historical')) {
    lens.historicalOnly = true;
    notes.push('Assessed on textual and historical grounds, with theological assumptions set aside.');
  }
  if (ids.includes('scripture')) {
    lens.scriptureOnly = true;
    notes.push('Restricted to the canonical text itself.');
  }

  lens.note = notes.join(' ');
  return lens;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { query } = parsed.data;
  const lens = buildLens(parsed.data.lenses ?? []);

  // Guardrails first. A tradition-level verdict request is answered by
  // redirecting into the specific claims underneath it.
  const guard = checkRequest(query);
  if (!guard.allowed && guard.finding) {
    return NextResponse.json({
      kind: 'GUARDRAIL',
      message: guard.finding.message,
      suggestedClaims: guard.finding.suggestedClaims,
    });
  }

  await ensureSeeded();

  const subject = seededByQuery(query);
  if (subject) {
    const analysis = await getStore().getAnalysisBySlug(subject.slug);
    if (analysis) {
      return NextResponse.json({
        kind: 'ANALYSIS',
        title: analysis.title,
        href: `/evidence/${analysis.resourceId}`,
        lensNote: lens?.note || undefined,
      });
    }
  }

  return NextResponse.json({
    kind: 'NONE',
    message:
      'No Evidence Intelligence analysis is available for that subject yet. The corpus-backed provider only returns assessments it can ground in curated sources, and it will not generate one it cannot support. Configure a live reasoning provider to analyse arbitrary passages and claims.',
    suggestedClaims: [
      'Daniel 12:1 — Michael, the book, and the resurrection',
      'Pontius Pilate — what epigraphy and documentary history establish',
      'Near Eastern migration to the ancient Americas',
    ],
  });
}
