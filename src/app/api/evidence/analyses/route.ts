import { NextResponse } from 'next/server';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { getStore } from '@/lib/evidence/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureSeeded();
  const analyses = await getStore().listAnalyses();
  return NextResponse.json({
    analyses: analyses.map((a) => ({
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      resourceId: a.resourceId,
      resourceType: a.resourceType,
      claimCount: a.claims.length,
      sourceCount: a.sources.length,
      modelProvider: a.modelProvider,
      modelVersion: a.modelVersion,
      promptVersion: a.promptVersion,
      updatedAt: a.updatedAt,
    })),
  });
}
