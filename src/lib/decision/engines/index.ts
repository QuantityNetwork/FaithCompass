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
};

/** Which engine evaluates each archived case version. */
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
