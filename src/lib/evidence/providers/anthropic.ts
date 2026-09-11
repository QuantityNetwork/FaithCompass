/**
 * Claude-backed reasoning provider.
 *
 * Calls the Messages API directly over fetch rather than pulling in an SDK —
 * the request shape here is small and stable, and the surface we need is one
 * endpoint. Model ids come from configuration so the deployment, not the code,
 * decides which model does which tier of work.
 *
 * Everything this provider returns is parsed through the schemas in schema.ts
 * before the pipeline touches it, and every source reference it emits is
 * verified against the corpus afterwards. A hallucinated citation from here
 * cannot reach the store; it is dropped and flagged.
 */

import {
  ChallengeResultSchema,
  ClaimAssessmentResultSchema,
  ClaimExtractionResultSchema,
  parseStructured,
  type ChallengeResult,
  type ClaimAssessmentResult,
  type ClaimExtractionResult,
} from '../schema';
import {
  ASSESSMENT_INSTRUCTIONS,
  CHALLENGE_INSTRUCTIONS,
  EXTRACTION_INSTRUCTIONS,
  SYSTEM_PROMPT,
} from '../prompts';
import {
  ProviderUnavailableError,
  type AssessmentRequest,
  type ChallengeRequest,
  type EvidenceReasoningProvider,
  type ExtractionRequest,
  type ProviderIdentity,
  type ReasoningTier,
} from './types';
import { getCorpusEntry } from '../corpus';
import { CLAIM_TYPES, EVIDENCE_DIMENSIONS, EVIDENCE_RELATIONSHIPS } from '../taxonomy';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const FAST_MODEL = process.env.EVIDENCE_MODEL_FAST || 'claude-haiku-4-5-20251001';
const DEEP_MODEL = process.env.EVIDENCE_MODEL_DEEP || 'claude-opus-5';

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

function describeSources(ids: string[]): string {
  const lines = ids
    .map((id) => {
      const e = getCorpusEntry(id);
      if (!e) return null;
      return `- ${id} | ${e.title}${e.author ? ` (${e.author})` : ''} | ${e.date ?? 'n.d.'} | Tier ${e.qualityTier} | ${e.traditionPerspective}`;
    })
    .filter(Boolean);
  return lines.join('\n');
}

export class AnthropicReasoningProvider implements EvidenceReasoningProvider {
  readonly name = 'anthropic';
  private readonly apiKey: string | undefined;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    this.apiKey = apiKey;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  identity(tier: ReasoningTier): ProviderIdentity {
    return { provider: this.name, modelVersion: tier === 'deep' ? DEEP_MODEL : FAST_MODEL };
  }

  private async call(tier: ReasoningTier, userPrompt: string, maxTokens: number): Promise<unknown> {
    if (!this.apiKey) {
      throw new ProviderUnavailableError(this.name, 'ANTHROPIC_API_KEY is not set');
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: this.identity(tier).modelVersion,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ProviderUnavailableError(this.name, `HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json()) as AnthropicResponse;
    const text = (body.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');

    return extractJson(text);
  }

  async extractClaims(req: ExtractionRequest): Promise<ClaimExtractionResult> {
    const prompt = [
      EXTRACTION_INSTRUCTIONS,
      '',
      `Claim types: ${CLAIM_TYPES.join(', ')}`,
      '',
      req.reference ? `Reference: ${req.reference.display}` : '',
      req.passageText ? `Passage:\n"""${req.passageText}"""` : '',
      `Question: ${req.query}`,
      req.lens?.note ? `Lens: ${req.lens.note}` : '',
      '',
      'Return JSON: { "claims": [ { "statement", "claimType", "scope", "rationale" } ] }',
    ]
      .filter(Boolean)
      .join('\n');

    return parseStructured('extractClaims', ClaimExtractionResultSchema, await this.call('fast', prompt, 4000));
  }

  async assessClaim(req: AssessmentRequest): Promise<ClaimAssessmentResult> {
    const prompt = [
      ASSESSMENT_INSTRUCTIONS,
      '',
      `Claim: ${req.claimStatement}`,
      `Claim type: ${req.claimType}`,
      `Scope: ${req.scope}`,
      req.reference ? `Reference: ${req.reference.display}` : '',
      req.passageText ? `Passage:\n"""${req.passageText}"""` : '',
      req.lens?.note ? `Lens: ${req.lens.note}` : '',
      '',
      'You may cite ONLY these source identifiers. Use the identifier verbatim in "sourceRef".',
      describeSources(req.availableSourceIds),
      '',
      `Evidence dimensions: ${EVIDENCE_DIMENSIONS.join(', ')}`,
      `Relationships: ${EVIDENCE_RELATIONSHIPS.join(', ')}`,
      '',
      'Return JSON matching the ClaimAssessmentResult schema. Do not include any score, percentage or probability.',
    ]
      .filter(Boolean)
      .join('\n');

    // Contested interpretation and evidence weighting go to the deep tier.
    return parseStructured(
      'assessClaim',
      ClaimAssessmentResultSchema,
      await this.call('deep', prompt, 12000),
    );
  }

  async challengeAssessment(req: ChallengeRequest): Promise<ChallengeResult> {
    const prompt = [
      CHALLENGE_INSTRUCTIONS,
      '',
      `Claim: ${req.claimStatement}`,
      `Claim type: ${req.claimType}`,
      `Current assessment summary: ${req.currentSummary}`,
      `Current evidence confidence: ${req.currentScore ?? 'not directly scorable'}`,
      '',
      `Assumptions the current assessment rests on:\n${req.assumptions.map((a) => `- ${a}`).join('\n')}`,
      `Supporting evidence cited:\n${req.supportingEvidence.map((a) => `- ${a}`).join('\n')}`,
      `Counter-evidence cited:\n${req.counterEvidence.map((a) => `- ${a}`).join('\n')}`,
      '',
      'Available sources:',
      describeSources(req.availableSourceIds),
      '',
      'Return JSON matching the ChallengeResult schema. supportDelta and penaltyDelta are bounded to [-0.35, 0.35].',
    ].join('\n');

    return parseStructured(
      'challengeAssessment',
      ChallengeResultSchema,
      await this.call('deep', prompt, 8000),
    );
  }
}

/**
 * Pull a JSON object out of a model response.
 *
 * Models sometimes wrap JSON in a fenced block or a sentence of preamble even
 * when told not to. Recovering from that is fine; guessing at the contents is
 * not, so anything that does not parse cleanly raises rather than being
 * patched up.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Reasoning provider returned no parseable JSON object');
  }
}
