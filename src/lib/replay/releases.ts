/**
 * Engine releases for replay: the frozen, pinned dt-engine-1.0.0 and dt-engine-1.1.0 (engines/v1, engines/v1_1), and
 * the live engine module (src/lib/decision/engine.ts, unfrozen; its digest is computed when supplied, never pinned).
 */
import { evaluate as evaluateActive } from '@/lib/decision/engine';
import { ENGINES, engineSourceHash } from '@/lib/decision/engines';
import { evaluate as evaluateV1 } from '@/lib/decision/engines/v1/engine';
import { evaluate as evaluateV11 } from '@/lib/decision/engines/v1_1/engine';
import { sha256 } from '@/lib/decision/canonical';
import type { EngineRelease } from './index';

export const RELEASE_V1: EngineRelease = { key: '1.0.0', version: ENGINES['1.0.0'].version, sha256: ENGINES['1.0.0'].sha256, evaluate: evaluateV1 };

/** Frozen 1.1.0: 1.0.0 plus selective recalculation, pinned. */
export const RELEASE_V1_1: EngineRelease = { key: '1.1.0', version: ENGINES['1.1.0'].version, sha256: ENGINES['1.1.0'].sha256, evaluate: evaluateV11 };

export function activeRelease(engineTs?: string): EngineRelease {
  return { key: 'active', version: 'dt-engine-active (unfrozen; selective recalculation)', sha256: engineTs ? engineSourceHash({ 'engine.ts': engineTs }, sha256) : null, evaluate: evaluateActive };
}
