/**
 * Pin every public claim revision.
 *
 *   npm run record:lock    add newly published revisions to the lock
 *   npm run record:check   fail if any revision is unpinned or has changed
 *
 * A published revision is immutable: correcting one means appending a new
 * revision, never editing the old. This script will add entries but refuses to
 * rewrite one, so the only way to change history is to edit the lock by hand
 * in a commit a reviewer can see.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_RECORD, revisionHash } from '../src/lib/record/record';

const LOCK = join(process.cwd(), 'src/lib/record/revisions.lock.json');
const check = process.argv.includes('--check');

const lock: Record<string, string> = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {};
const changed: string[] = [];
const added: string[] = [];

for (const claim of RAW_RECORD.claims) {
  for (const revision of claim.revisions) {
    if (revision.status === 'draft') continue;
    const key = `${claim.code}@${revision.rev}`;
    const hash = revisionHash(claim.code, revision);
    if (lock[key] === undefined) {
      added.push(key);
      lock[key] = hash;
    } else if (lock[key] !== hash) {
      changed.push(key);
    }
  }
}

if (changed.length > 0) {
  console.error(
    `Published revisions were edited in place: ${changed.join(', ')}.\n` +
      'Append a new revision instead. Published revisions are immutable.',
  );
  process.exit(1);
}

if (check) {
  if (added.length > 0) {
    console.error(`Unpinned public revisions: ${added.join(', ')}. Run npm run record:lock.`);
    process.exit(1);
  }
  console.log(`All ${Object.keys(lock).length} public revisions match the lock.`);
} else {
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LOCK, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Pinned ${added.length} new revision(s); ${Object.keys(sorted).length} in total.`);
}
