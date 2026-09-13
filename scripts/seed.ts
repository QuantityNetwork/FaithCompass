/**
 * One-shot seed of the curated demonstration analyses.
 *
 * Seeding also happens lazily on first request, which is fine but means the
 * first visitor after a cold start pays for it, and it makes populating the
 * database a side effect of traffic rather than a deliberate deploy step. Run
 * this once after applying the migration and setting the environment.
 *
 *   npm run seed
 *
 * Idempotent: analyses upsert on a stable id, and a subject already stored at
 * the current analysis version is skipped.
 */

import { SEEDED_SUBJECTS } from '../src/lib/evidence/seed';
import { runAnalysis } from '../src/lib/evidence/pipeline';
import { CorpusReasoningProvider } from '../src/lib/evidence/providers/corpus';
import { getStore } from '../src/lib/evidence/store';
import { ANALYSIS_VERSION } from '../src/lib/evidence/prompts';

async function main() {
  const store = getStore();
  const provider = new CorpusReasoningProvider();

  console.log(`Seeding ${SEEDED_SUBJECTS.length} curated analyses (version ${ANALYSIS_VERSION})\n`);

  let written = 0;
  let skipped = 0;

  for (const subject of SEEDED_SUBJECTS) {
    const existing = await store.getAnalysisBySlug(subject.slug);
    if (existing && existing.analysisVersion === ANALYSIS_VERSION) {
      console.log(`  skip   ${subject.title} — already at ${ANALYSIS_VERSION}`);
      skipped += 1;
      continue;
    }

    const result = await runAnalysis(
      {
        query: subject.aliases[0],
        reference: subject.reference,
        passageText: subject.passageText,
      },
      provider,
    );

    const analysis = result.analysis!;
    const scored = analysis.claims.filter((c) => c.overallConfidence !== null).length;
    console.log(
      `  write  ${subject.title} — ${analysis.claims.length} claims (${scored} scored), ${analysis.sources.length} sources`,
    );

    for (const flag of result.citationFlags) {
      console.warn(`         citation flagged: ${flag.sourceRef} — ${flag.reason}`);
    }
    written += 1;
  }

  console.log(`\nDone. ${written} written, ${skipped} already current.`);
}

main().catch((err) => {
  console.error('\nSeeding failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
