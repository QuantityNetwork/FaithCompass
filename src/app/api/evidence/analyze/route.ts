import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { PassageReferenceSchema } from '@/lib/evidence/schema';
import { NoAnalysisAvailableError } from '@/lib/evidence/providers/types';
import { StructuredOutputError } from '@/lib/evidence/schema';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
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
    .optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await runAnalysis({
      query: parsed.data.query,
      reference: parsed.data.reference ?? null,
      passageText: parsed.data.passageText ?? null,
      lens: parsed.data.lens,
    });

    if (result.guardrail) {
      // 200, not an error: the request was understood and answered, just not in
      // the form it was asked. A 4xx would suggest the user did something wrong.
      return NextResponse.json({ kind: 'GUARDRAIL', guardrail: result.guardrail });
    }

    return NextResponse.json({
      kind: 'ANALYSIS',
      analysis: result.analysis,
      citationFlags: result.citationFlags,
    });
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
