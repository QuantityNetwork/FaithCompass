/**
 * Run the full Deep Analysis pipeline (deterministic + AI layer) on the three fictional sample documents and save
 * the sealed reports as recorded sample runs. Needs OPENAI_API_KEY in the environment; the key is read by the
 * provider at call time and never printed or written.
 *   npx tsx scripts/deep-analysis/run-samples.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { openAiProvider } from '@/lib/deep-analysis/ai';
import { analyzeDocument } from '@/lib/deep-analysis/analyze';
import { parseDocument } from '@/lib/deep-analysis/parse';
import { SAMPLE_FILES } from '@/lib/deep-analysis/samples';

(async () => {
  const provider = openAiProvider();
  if (!provider.configured) throw new Error('OPENAI_API_KEY is not set; nothing was run.');
  let total = 0;
  for (const s of SAMPLE_FILES) {
    const doc = await parseDocument(s.file, readFileSync(`public/deep-analysis/samples/${s.file}`));
    const r = await analyzeDocument(doc, { provider, sample: true });
    writeFileSync(`public/deep-analysis/samples/${s.id}.report.json`, JSON.stringify(r, null, 1) + '\n');
    const usd = r.engine.ai.usage?.usd ?? 0;
    total += usd;
    const ai = r.findings.filter((f) => f.layer === 'ai').length;
    console.log(`${s.id}: ai=${r.engine.ai.status} model=${r.engine.ai.model} findings=${r.findings.length} (ai ${ai}) proposed=${r.engine.ai.proposed} dropped=${r.engine.ai.dropped} vetoed=${r.engine.ai.vetoed} tokens=${r.engine.ai.usage?.inputTokens}/${r.engine.ai.usage?.outputTokens} usd=${usd.toFixed(4)} rating=${r.finalStatement.rating}`);
    if (r.engine.ai.droppedExamples.length) console.log('  dropped e.g.:', r.engine.ai.droppedExamples.slice(0, 3));
  }
  console.log(`total usd=${total.toFixed(4)}`);
})();
