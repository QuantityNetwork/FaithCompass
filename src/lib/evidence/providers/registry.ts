/**
 * Provider selection.
 *
 * The deployment decides which reasoning engine runs, and the analysis records
 * which one actually did. Adding a provider — a different vendor, a local
 * model, a future reasoning system — means implementing the interface and
 * registering it here; nothing above this layer changes.
 */

import { AnthropicReasoningProvider } from './anthropic';
import { CorpusReasoningProvider } from './corpus';
import type { EvidenceReasoningProvider } from './types';

const corpus = new CorpusReasoningProvider();

let cached: EvidenceReasoningProvider | null = null;

export function getReasoningProvider(): EvidenceReasoningProvider {
  if (cached) return cached;

  const configured = (process.env.EVIDENCE_PROVIDER || 'corpus').toLowerCase();

  if (configured === 'anthropic') {
    const anthropic = new AnthropicReasoningProvider();
    // Falling back rather than throwing: a missing key should degrade the
    // system to curated analyses, not take the whole feature down. The analysis
    // records which provider actually ran, so the fallback is visible.
    cached = anthropic.isAvailable() ? anthropic : corpus;
    return cached;
  }

  cached = corpus;
  return cached;
}

/** Test seam. */
export function setReasoningProvider(provider: EvidenceReasoningProvider | null): void {
  cached = provider;
}

export function availableProviders(): Array<{ name: string; available: boolean }> {
  return [
    { name: 'corpus', available: true },
    { name: 'anthropic', available: new AnthropicReasoningProvider().isAvailable() },
  ];
}
