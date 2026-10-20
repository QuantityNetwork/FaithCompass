import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { canPersist, getStore, NOT_PERSISTED_MESSAGE } from '@/lib/evidence/store';
import { guardWrite } from '@/lib/security/write-guard';
import { PassageReferenceSchema } from '@/lib/evidence/schema';
import { NoAnalysisAvailableError } from '@/lib/evidence/providers/types';
import { StructuredOutputError } from '@/lib/evidence/schema';

export const dynamic = 'force-dynamic';

/**
 * Generate a provisional analysis.
 *
 * The result is saved as a private *draft*, never into the published analyses,
 * and is not listed or rendered as part of the record. With no durable store
 * the route refuses (503) rather than pretending to keep anything.
 */

const BodySchema = z.strictObject({
  query: z.string().min(1).max(2000),
  reference: PassageReferenceSchema.nullable().optional(),
  passageText: z.string().max(20000).nullable().optional(),
  lens: z
    .object({
      primarySourcesOnly: z.boolean().optional(),
      beforeYear: z.number().int().optional(),
      historicalOnly: z.boolean().optional(),
      scriptureOnly: z.boolean().optional(),
      note: z.string().max(300).optional(),
    })
    .strict()
    .optional(),
});

const noStore = { 'cache-control': 'no-store' };

export async function POST(request: Request) {
  const gate = await guardWrite(request, { permission: 'draft.create', action: 'analysis.draft', maxBytes: 32_768, perMinute: 5, perDay: 200 });
  if (!gate.ok) return gate.response;

  const parsed = BodySchema.safeParse(gate.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', issues: parsed.error.issues },
      { status: 400, headers: noStore },
    );
  }

  if (!canPersist()) {
    return NextResponse.json({ error: NOT_PERSISTED_MESSAGE, persisted: false, published: false }, { status: 503, headers: noStore });
  }

  try {
    const result = await runAnalysis({
      query: parsed.data.query,
      reference: parsed.data.reference ?? null,
      passageText: parsed.data.passageText ?? null,
      lens: parsed.data.lens,
      // Never into the published collection.
      persist: false,
    });

    if (result.guardrail) {
      // 200, not an error: the request was understood and answered, just not in
      // the form it was asked. A 4xx would suggest the user did something wrong.
      return NextResponse.json({ kind: 'GUARDRAIL', guardrail: result.guardrail });
    }

    const draftId = randomUUID();
    const now = new Date().toISOString();
    const store = getStore();
    await store.saveDraft({
      id: draftId,
      status: 'draft',
      createdBy: gate.actor.id,
      creatorRole: gate.actor.role,
      analysis: result.analysis!,
      createdAt: now,
    });
    await store.appendAudit({
      id: randomUUID(),
      entityType: 'DRAFT',
      entityId: draftId,
      changeType: 'DRAFTED',
      oldValue: null,
      newValue: { claimCount: result.analysis!.claims.length },
      reason: 'Provisional analysis generated as an unpublished draft.',
      modelProvider: result.analysis!.modelProvider,
      modelVersion: result.analysis!.modelVersion,
      promptVersion: result.analysis!.promptVersion,
      timestamp: now,
      actorId: gate.actor.id,
      actorRole: gate.actor.role,
    });

    return NextResponse.json(
      {
        kind: 'DRAFT',
        draftId,
        status: 'draft',
        published: false,
        message: 'Saved as an unpublished draft. It is not part of the published record and has not been reviewed.',
        analysis: result.analysis,
        citationFlags: result.citationFlags,
      },
      { status: 202, headers: noStore },
    );
  } catch (err) {
    if (err instanceof NoAnalysisAvailableError) {
      return NextResponse.json({ kind: 'NONE', error: err.message }, { status: 404 });
    }
    if (err instanceof StructuredOutputError) {
      // The model returned something that did not satisfy the schema. Refusing
      // is the correct outcome; a partially-parsed analysis would be worse than
      // none.
      return NextResponse.json(
        { error: err.message, stage: err.stage, issues: err.issues },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed.' },
      { status: 500 },
    );
  }
}
