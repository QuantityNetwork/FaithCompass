/**
 * Writes docs/PASSPORT_POLICY.md from src/lib/passport/policy.ts and the generated mapping section of
 * docs/STANDARDS_MAPPING.md from src/lib/passport/standards.ts. Run: npx tsx scripts/passport-policy.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { policyMarkdown } from '../src/lib/passport/policy';
import { MAPPING_BEGIN, MAPPING_END, mappingMarkdown } from '../src/lib/passport/standards';

export function standardsDoc(current: string): string {
  const a = current.indexOf(MAPPING_BEGIN);
  const b = current.indexOf(MAPPING_END);
  if (a === -1 || b === -1) return current.trimEnd() + '\n\n' + mappingMarkdown() + '\n';
  return current.slice(0, a) + mappingMarkdown() + current.slice(b + MAPPING_END.length);
}

if (process.argv[1]?.endsWith('passport-policy.ts')) {
  writeFileSync('docs/PASSPORT_POLICY.md', policyMarkdown());
  writeFileSync('docs/STANDARDS_MAPPING.md', standardsDoc(readFileSync('docs/STANDARDS_MAPPING.md', 'utf8')));
  console.log('docs/PASSPORT_POLICY.md and docs/STANDARDS_MAPPING.md written');
}
