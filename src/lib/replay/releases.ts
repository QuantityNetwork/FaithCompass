/**
 * Engine releases for replay. Release 1 is the frozen engine (engines/v1, pinned digest). The demo's second release
 * is the active, unfrozen engine (src/lib/decision/engine.ts), which differs from v1 in source (it adds selective
 * recalculation); its digest is computed from its file when supplied, never pinned, because it is not frozen.
 */
import { evaluate as evaluateActive } from '@/lib/decision/engine';
import { ENGINES, engineSourceHash } from '@/lib/decision/engines';
import { evaluate as evaluateV1 } from '@/lib/decision/engines/v1/engine';
import { sha256 } from '@/lib/decision/canonical';
import type { EngineRelease } from './index';

export const RELEASE_V1: EngineRelease = { key: '1.0.0', version: ENGINES['1.0.0'].version, sha256: ENGINES['1.0.0'].sha256, evaluate: evaluateV1 };

export function activeRelease(engineTs?: string): EngineRelease {
  return { key: 'active', version: 'dt-engine-active (unfrozen; selective recalculation)', sha256: engineTs ? engineSourceHash({ 'engine.ts': engineTs }, sha256) : null, evaluate: evaluateActive };
}
