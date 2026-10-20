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
    // A missing key degrades the system to curated analyses rather than taking
    // the feature down. The degradation is not silent: providerStatus() reports
    // it, the analyze response carries it, and /status shows it as a warning.
    cached = anthropic.isAvailable() ? anthropic : corpus;
    return cached;
  }

  cached = corpus;
  return cached;
}

export interface ProviderStatus {
  /** What the deployment asked for (EVIDENCE_PROVIDER, default "corpus"). */
  configured: string;
  /** What actually runs. */
  active: string;
  /** True when the configured provider could not be used. */
  degraded: boolean;
  reason: string | null;
  models: { fast: string; deep: string } | null;
}

/** Honest report of the reasoning provider: configured vs. active, and why they differ. */
export function providerStatus(env: Record<string, string | undefined> = process.env): ProviderStatus {
  const configured = (env.EVIDENCE_PROVIDER || 'corpus').toLowerCase();
  if (configured === 'corpus') {
    return { configured, active: 'corpus', degraded: false, reason: null, models: null };
  }
  if (configured === 'anthropic') {
    const anthropic = new AnthropicReasoningProvider(env.ANTHROPIC_API_KEY);
    const models = {
      fast: anthropic.identity('fast').modelVersion,
      deep: anthropic.identity('deep').modelVersion,
    };
    return anthropic.isAvailable()
      ? { configured, active: 'anthropic', degraded: false, reason: null, models }
      : {
          configured,
          active: 'corpus',
          degraded: true,
          reason: 'The configured provider "anthropic" has no API key; curated analyses only.',
          models,
        };
  }
  return {
    configured,
    active: 'corpus',
    degraded: true,
    reason: `The configured provider "${configured}" is not supported; curated analyses only.`,
    models: null,
  };
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
