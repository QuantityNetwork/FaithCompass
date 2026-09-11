/**
 * First-run seeding.
 *
 * The demonstration analyses are produced by running the real pipeline over the
 * curated subjects, not by loading finished records. If the scoring engine or a
 * calibration rule changes, the demonstrations change with it — which is the
 * only way they stay an honest showcase rather than a set of screenshots.
 */

import { SEEDED_SUBJECTS } from './seed';
import { runAnalysis } from './pipeline';
import { getStore } from './store';
import { CorpusReasoningProvider } from './providers/corpus';
import { ANALYSIS_VERSION } from './prompts';

let done: Promise<void> | null = null;

async function seed(): Promise<void> {
  const store = getStore();
  // Curated demonstrations always run on the curated provider, whatever the
  // deployment has configured. They are meant to be reproducible.
  const provider = new CorpusReasoningProvider();

  for (const subject of SEEDED_SUBJECTS) {
    const existing = await store.getAnalysisBySlug(subject.slug);
    if (existing && existing.analysisVersion === ANALYSIS_VERSION) continue;

    await runAnalysis(
      {
        query: subject.aliases[0],
        reference: subject.reference,
        passageText: subject.passageText,
      },
      provider,
    );
  }
}

/** Idempotent, and safe to call from any route or page. */
export function ensureSeeded(): Promise<void> {
  done ??= seed().catch((err) => {
    // Reset so a transient failure (a locked file, a cold volume) is retried
    // rather than poisoning every later request.
    done = null;
    throw err;
  });
  return done;
}
