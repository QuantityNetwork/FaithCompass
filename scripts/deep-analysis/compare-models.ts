/**
 * Run one sample document through the full pipeline on one model and save the sealed report with its wall time.
 *   DEEP_ANALYSIS_MODEL=gpt-5.6-sol npx tsx scripts/deep-analysis/compare-models.ts sample-nda /tmp/out
 * Needs OPENAI_API_KEY; the key is read at call time and never printed or written.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openAiProvider } from '@/lib/deep-analysis/ai';
import { analyzeDocument } from '@/lib/deep-analysis/analyze';
import { parseDocument } from '@/lib/deep-analysis/parse';
import { SAMPLE_FILES } from '@/lib/deep-analysis/samples';

(async () => {
  const [id, outDir = 'out'] = process.argv.slice(2);
  const s = SAMPLE_FILES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown sample ${id}`);
  const provider = openAiProvider();
  if (!provider.configured) throw new Error('OPENAI_API_KEY is not set; nothing was run.');
  const doc = await parseDocument(s.file, readFileSync(`public/deep-analysis/samples/${s.file}`));
  const t0 = Date.now();
  const r = await analyzeDocument(doc, { provider, sample: true });
  const seconds = (Date.now() - t0) / 1000;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/${s.id}.${provider.model}.report.json`, JSON.stringify(r, null, 1) + '\n');
  const ai = r.engine.ai;
  const count = (layer: string) => r.findings.filter((f) => f.layer === layer).length;
  console.log(JSON.stringify({ sample: s.id, model: ai.model, status: ai.status, note: ai.status === 'used' ? undefined : ai.note, seconds, findings: r.findings.length, aiFindings: count('ai'), proposed: ai.proposed, dropped: ai.dropped, vetoed: ai.vetoed, usage: ai.usage, rating: r.finalStatement.rating, confidence: r.finalStatement.confidence, keyConcerns: r.finalStatement.keyConcerns?.length, actions: r.finalStatement.recommendedActions?.length }));
})();
