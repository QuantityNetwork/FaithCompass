/**
 * Changing the live engine must not change v1 passports. Every live evaluation module is replaced here by a
 * deliberately different implementation; v1 passports (formats 1, 2 and 3) must still rebuild to the same hashes.
 */
import { describe, expect, it, vi } from 'vitest';

const changed = () => {
  throw new Error('the live engine was called');
};
vi.mock('@/lib/decision/engine', async (orig) => ({ ...(await orig<object>()), evaluate: changed, traceFromDefaults: changed, PREMISES: [], CONTROLS: [] }));
vi.mock('@/lib/decision/chamber', async (orig) => ({ ...(await orig<object>()), chamber: changed, CHAMBER_RULES: [] }));
vi.mock('@/lib/decision/contradictions', async (orig) => ({ ...(await orig<object>()), contradictionsView: changed, CONTRADICTIONS: [] }));
vi.mock('@/lib/decision/product', async (orig) => ({ ...(await orig<object>()), CONFIG_VERSION: 'dr-config-9', decisionConfiguration: changed }));

import { DEFAULT_ASSUMPTIONS } from '@/lib/decision/engines/v1/engine';
import { buildPassport, encodePassportId, verifyPassport } from '@/lib/decision/passport';
import { FORMAT2_GOLDEN, FORMAT3_GOLDEN } from './fixtures/passport-golden';

describe('frozen v1 evaluation', () => {
  it('rebuilds format 2 and 3 passports to their pinned hashes with the live engine changed', () => {
    for (const [id, hash] of [...FORMAT2_GOLDEN, FORMAT3_GOLDEN]) expect(verifyPassport(id, hash).valid).toBe(true);
    expect(buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-10-20T18:00:00Z'))).integrity.sha256).toBe(FORMAT3_GOLDEN[1]);
  });
});
