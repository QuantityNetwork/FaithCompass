/**
 * Registry of frozen Decision Twin engines.
 *
 * An engine is the whole evaluation of a passport: calculation rules, the Adversarial Chamber, the Contradiction
 * Map, the decision configuration and the content (rendering) spec. Each engine's source directory is hashed
 * (see `engineSourceHash`, run by tests/passport-versions.test.ts) and the hash pinned here when the engine was
 * frozen. Never edit a frozen engine or its pinned hash; add a new engine directory instead.
 */
export interface EngineEntry {
  version: string;
  /** Source directory of the frozen engine. */
  source: string;
  /** SHA-256 over the engine's source files, pinned at freezing. */
  sha256: string;
}

export const ENGINES: Record<string, EngineEntry> = {
  '1.0.0': {
    version: 'dt-engine-1.0.0',
    source: 'src/lib/decision/engines/v1',
    sha256: '9e4eae8ae339afdeee285fa818f3a53295cc2fca6d39d35822113a4c669b9241',
  },
  // 1.0.0 plus selective recalculation (`recalculate`); passport content is evaluated identically (tested).
  '1.1.0': {
    version: 'dt-engine-1.1.0',
    source: 'src/lib/decision/engines/v1_1',
    sha256: 'cc226a98bf0f096f7e8341401bb1ec8d699e380ab422a90120ee98f516038230',
  },
  // Not a Decision Twin engine: the frozen builder of workspace decision records (src/lib/workspace/passport.ts).
  // Pinned like the engines so both offline verifiers recognise workspace passports as a known release.
  'workspace-1.0.0': {
    version: 'am-workspace-record-1.0.0',
    source: 'src/lib/workspace/record/v1',
    sha256: '8e0d87775778f6e6fd2d6e23266942397773b29ccc26509cf6d6309fd628f808',
  },
};

/**
 * Which engine new passports of each archived case version name. Case 1.0.0 stays on engine 1.0.0: 1.1.0 changes no
 * passport content, and switching would change the hash of every newly issued passport (an owner decision).
 */
export const ENGINE_FOR_CASE: Record<string, string> = { '1.0.0': '1.0.0' };

/**
 * The hash definition: files sorted by name, each contributing "<name>\n<length>\n<utf-8 content>\n", with CRLF
 * normalised to LF. Takes file contents so it runs without filesystem access.
 */
export function engineSourceHash(files: Record<string, string>, hash: (s: string) => string): string {
  const body = Object.keys(files)
    .sort()
    .map((name) => {
      const text = files[name].replace(/\r\n/g, '\n');
      return `${name}\n${Buffer.byteLength(text, 'utf8')}\n${text}\n`;
    })
    .join('');
  return hash(body);
}
