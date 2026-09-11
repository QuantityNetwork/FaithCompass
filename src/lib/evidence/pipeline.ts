/**
 * The Evidence Intelligence reasoning pipeline.
 *
 * Fourteen stages, not one large model call. The separation is what makes the
 * output auditable: claim extraction can be cheap and fast, evidence weighting
 * can be deterministic application logic, citations get verified before
 * anything is persisted, and scores are computed rather than asserted. A single
 * call that returned a finished analysis would give us no place to stand
 * between the model and the database.
 *
 *   1  Understand the query and passage
 *   2  Extract atomic claims
 *   3  Classify claim types
 *   4  Determine admissible evidence dimensions
 *   5  Retrieve candidate sources
 *   6  Evaluate source quality and independence
 *   7  Generate the supporting case
 *   8  Generate the strongest opposing case
 *   9  Compare the evidence
 *  10  Compute calibrated confidence
 *  11  Generate the uncertainty statement
 *  12  Generate "what would change this assessment"
 *  13  Validate citations
 *  14  Persist analysis and audit records
 */

import { randomUUID } from 'node:crypto';
import {
  AnalysisSchema,
  ClaimSchema,
  parseStructured,
  type Analysis,
  type Claim,
  type EvidenceItem,
  type PassageReference,
  type PrimaryProfile,
  type Source,
} from './schema';
import {
  ADMISSIBLE_DIMENSIONS,
  PRIMARY_DIMENSIONS,
  PRIMARY_DIMENSION_META,
  confidenceLabelFor,
  isDimensionAdmissible,
  type EvidenceDimensionType,
} from './taxonomy';
import { computeScore, rollUpPrimary, scoreDimension, type ScorableEvidence } from './scoring';
import { verifyCitations, type CitationFlag } from './citations';
import { effectiveIndependence, filterCorpus, getCorpusEntry } from './corpus';
import { getReasoningProvider } from './providers/registry';
import type { AnalysisLens, EvidenceReasoningProvider } from './providers/types';
import { ANALYSIS_VERSION, PROMPT_VERSION } from './prompts';
import { getStore } from './store';
import { checkRequest, type GuardrailFinding } from './guardrails';
import { seededByQuery, seededBySlug } from './seed';

export interface AnalyseRequest {
  query: string;
  reference?: PassageReference | null;
  passageText?: string | null;
  lens?: AnalysisLens;
  /** Skip persistence — used by tests and previews. */
  persist?: boolean;
}

export interface AnalyseResult {
  analysis: Analysis | null;
  guardrail: GuardrailFinding | null;
  citationFlags: CitationFlag[];
}

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Stage 1 — understand the query and passage
 * ------------------------------------------------------------------ */

function resolveSubject(req: AnalyseRequest): {
  reference: PassageReference | null;
  passageText: string | null;
  title: string;
  subtitle: string | null;
  attribution: string | null;
  resourceId: string;
  resourceType: Analysis['resourceType'];
  seeded: boolean;
  summary: string | null;
} {
  const seeded =
    (req.reference ? seededBySlug(req.reference.slug) : undefined) ?? seededByQuery(req.query);

  if (seeded) {
    return {
      reference: seeded.reference,
      passageText: req.passageText ?? seeded.passageText,
      title: seeded.title,
      subtitle: seeded.subtitle,
      attribution: seeded.passageAttribution,
      resourceId: seeded.slug,
      resourceType: seeded.resourceType,
      seeded: true,
      summary: seeded.summary,
    };
  }

  return {
    reference: req.reference ?? null,
    passageText: req.passageText ?? null,
    title: req.reference?.display ?? req.query,
    subtitle: null,
    attribution: req.reference?.display ?? null,
    resourceId: req.reference?.slug ?? slugifyQuery(req.query),
    resourceType: req.reference ? 'PASSAGE' : 'CLAIM_QUERY',
    seeded: false,
    summary: null,
  };
}

function slugifyQuery(q: string): string {
  return `query/${q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)}`;
}

/* ------------------------------------------------------------------ *
 * Stage 5 — retrieve candidate sources
 * ------------------------------------------------------------------ */

/**
 * Narrow the corpus to what the provider is permitted to cite.
 *
 * The lens applies here rather than after the fact: "show only primary sources"
 * and "use only evidence before AD 500" have to constrain what the reasoning
 * sees, not merely what the interface displays. Filtering afterwards would
 * produce an assessment reasoned from sources it then hides.
 */
function retrieveSources(lens: AnalysisLens | undefined): string[] {
  const entries = filterCorpus({
    primaryOnly: lens?.primarySourcesOnly,
    beforeYear: lens?.beforeYear,
  });
  return entries.map((e) => e.id);
}

/* ------------------------------------------------------------------ *
 * The pipeline
 * ------------------------------------------------------------------ */

export async function runAnalysis(
  req: AnalyseRequest,
  provider: EvidenceReasoningProvider = getReasoningProvider(),
): Promise<AnalyseResult> {
  // Guardrails run before anything else. A request for a tradition-level truth
  // score is redirected rather than analysed.
  const guard = checkRequest(req.query);
  if (!guard.allowed) {
    return { analysis: null, guardrail: guard.finding, citationFlags: [] };
  }

  const subject = resolveSubject(req);
  const analysisId = subject.seeded ? `analysis-${subject.resourceId.replace(/\//g, '-')}` : randomUUID();
  const availableSourceIds = retrieveSources(req.lens);

  // Stages 2–3: extract atomic claims and classify them.
  const extraction = await provider.extractClaims({
    passageText: subject.passageText,
    reference: subject.reference,
    query: req.query,
    lens: req.lens,
  });

  const claims: Claim[] = [];
  const allEvidence: EvidenceItem[] = [];
  const sourceMap = new Map<string, Source>();
  const citationFlags: CitationFlag[] = [];

  for (const [index, extracted] of extraction.claims.entries()) {
    const claimId = subject.seeded
      ? `${analysisId}-claim-${index + 1}`
      : randomUUID();

    // Stage 4: admissible dimensions for this claim type. A dimension outside
    // this set is a category error and is dropped in stage 6.
    const admissible = ADMISSIBLE_DIMENSIONS[extracted.claimType];

    // Stages 7–9: supporting case, opposing case, comparison. The provider
    // returns both cases in one structured assessment; the comparison is the
    // signed evidence ledger it produces.
    const assessment = await provider.assessClaim({
      claimStatement: extracted.statement,
      claimType: extracted.claimType,
      scope: extracted.scope,
      passageText: subject.passageText,
      reference: subject.reference,
      availableSourceIds,
      lens: req.lens,
    });

    // Stage 13, run early: verify citations before any of this is weighed.
    // An unresolvable reference must not reach the scoring engine, let alone
    // the store.
    const proposedRefs = assessment.evidence.map((e) => e.sourceRef);
    const { sources, flags } = verifyCitations(proposedRefs);
    citationFlags.push(...flags);
    for (const s of sources) sourceMap.set(s.id, s);

    const resolvedIds = new Set(sources.map((s) => s.id));

    // Stage 6: source quality and independence. Two sources descending from a
    // common original are one witness, and the corpus dependency graph is what
    // says so.
    const independenceByRef = effectiveIndependence([...resolvedIds]);

    const claimEvidence: EvidenceItem[] = [];
    for (const proposal of assessment.evidence) {
      if (!resolvedIds.has(proposal.sourceRef)) continue;
      if (!admissible.includes(proposal.dimension)) {
        citationFlags.push({
          sourceRef: proposal.sourceRef,
          reason: `Evidence dimension "${proposal.dimension}" cannot bear on a ${extracted.claimType} claim and was excluded as a category error.`,
        });
        continue;
      }

      const entry = getCorpusEntry(proposal.sourceRef)!;
      const corpusIndependence = independenceByRef.get(proposal.sourceRef) ?? entry.independence;

      const item: EvidenceItem = {
        id: `${claimId}-ev-${claimEvidence.length + 1}`,
        claimId,
        title: proposal.title,
        description: proposal.description,
        sourceId: proposal.sourceRef,
        relationship: proposal.relationship,
        dimension: proposal.dimension,
        directness: proposal.directness,
        relevance: proposal.relevance,
        // The lower of the provider's judgement and the corpus dependency
        // graph. The provider can spot a dependency the graph does not record;
        // it should not be able to assert independence the graph denies.
        independence: Math.min(proposal.independence, corpusIndependence),
        qualityTier: entry.qualityTier,
        excerpt: proposal.excerpt,
        whyItMatters: proposal.whyItMatters,
      };
      claimEvidence.push(item);
    }

    const scorable: ScorableEvidence[] = claimEvidence.map((e) => ({
      relationship: e.relationship,
      dimension: e.dimension,
      qualityTier: e.qualityTier,
      directness: e.directness,
      relevance: e.relevance,
      independence: e.independence,
    }));

    // Stage 10: calibrated confidence. Individual dimensions first, then the
    // three headline dimensions, then the claim.
    const dimensionScores: Partial<Record<EvidenceDimensionType, number>> = {};
    const evidencedDimensions = new Set<EvidenceDimensionType>(claimEvidence.map((e) => e.dimension));
    const dimensionAssessments = assessment.dimensionReasoning
      .filter((d) => isDimensionAdmissible(extracted.claimType, d.dimensionType))
      .map((d, i) => {
        const score = scoreDimension(d.dimensionType, extracted.claimType, scorable, d.strength);
        dimensionScores[d.dimensionType] = score;
        return {
          id: `${claimId}-dim-${i + 1}`,
          claimId,
          dimensionType: d.dimensionType,
          score,
          confidenceLabel: confidenceLabelFor(score),
          reasoningSummary: d.reasoningSummary,
        };
      });

    const scoreResult = computeScore({
      claimType: extracted.claimType,
      evidence: scorable,
      penalties: assessment.penalties,
      scholarlyPosition: assessment.scholarlyPosition,
      absencePenalty: assessment.absence?.penalty,
      evidenceInconsistent: assessment.absence?.verdict === 'EVIDENCE_INCONSISTENT_WITH_CLAIM',
    });

    const primaryProfile: PrimaryProfile[] = PRIMARY_DIMENSIONS.map((p) => {
      const stated = assessment.primaryReasoning.find((r) => r.dimension === p);
      const applicable = stated?.applicable ?? false;
      const raw = applicable
        ? rollUpPrimary(p, {
            claimType: extracted.claimType,
            dimensionScores,
            evidencedDimensions,
          })
        : null;

      // Hold the headline dimensions to the same calibration floor as the claim
      // they feed. Without this a claim can show an overall confidence above
      // the only dimension that produced it, which reads as a contradiction.
      const rolled =
        raw !== null && scoreResult.floor !== null ? Math.max(raw, scoreResult.floor) : raw;

      return {
        dimension: p,
        score: applicable ? rolled : null,
        // Three distinct states, and conflating them would mislead: a scored
        // dimension, a dimension that applies but which no admissible evidence
        // reached, and a dimension that cannot bear on this claim type at all.
        confidenceLabel: !applicable
          ? 'NOT DIRECTLY SCORABLE'
          : rolled === null
            ? 'NOT ASSESSED'
            : confidenceLabelFor(rolled),
        reasoningSummary:
          stated?.reasoningSummary ??
          `${PRIMARY_DIMENSION_META[p].label} was not assessed for this claim.`,
        applicable,
      };
    });

    const interpretations = assessment.interpretations.map((interp, i) => {
      // Interpretation confidence uses the same calibration ceiling as the
      // claim itself, so a reading cannot outrank what its evidence supports.
      const raw = Math.round(interp.strength * 100);
      return {
        id: `${claimId}-interp-${i + 1}`,
        claimId,
        name: interp.name,
        description: interp.description,
        tradition: interp.tradition,
        confidence: raw,
        confidenceLabel: confidenceLabelFor(raw),
        scholarlyPosition: interp.scholarlyPosition,
        directTextualSupport: interp.directTextualSupport,
        canonicalSupport: interp.canonicalSupport,
        historicalReception: interp.historicalReception,
        assumptionsRequired: interp.assumptionsRequired,
        counterarguments: interp.counterarguments,
        supportingEvidenceIds: claimEvidence
          .filter((e) => e.relationship === 'SUPPORTS' || e.relationship === 'WEAKLY_SUPPORTS')
          .map((e) => e.id),
        challengingEvidenceIds: claimEvidence
          .filter(
            (e) =>
              e.relationship === 'CHALLENGES' ||
              e.relationship === 'WEAKLY_CHALLENGES' ||
              e.relationship === 'CONTRADICTS',
          )
          .map((e) => e.id),
      };
    });

    // Stages 11–12 come from the provider as structured prose and are carried
    // through unchanged; they are the parts a reader checks the score against.
    const claim = parseStructured('claim', ClaimSchema, {
      id: claimId,
      analysisId,
      ordinal: index + 1,
      statement: extracted.statement,
      claimType: extracted.claimType,
      scope: assessment.scope || extracted.scope,
      certainty: scoreResult.certainty,
      overallConfidence: scoreResult.score,
      confidenceLabel: scoreResult.confidenceLabel,
      summary: assessment.summary,
      positionNote: assessment.positionNote ?? null,
      scholarlyPosition: assessment.scholarlyPosition,
      scholarlyLandscape: assessment.scholarlyLandscape,
      assumptions: assessment.assumptions,
      uncertainties: assessment.uncertainties,
      whatWouldChangeThis: assessment.whatWouldChangeThis,
      whyThisScore: assessment.whyThisScore,
      certaintyBreakdown: assessment.certaintyBreakdown,
      primaryProfile,
      dimensions: dimensionAssessments,
      interpretations,
      absence: assessment.absence,
      prophetic: assessment.prophetic,
      metaphysical: assessment.metaphysical,
      scoringFactors: scoreResult.factors,
      calibrationNotes: scoreResult.calibrationNotes,
    } satisfies Claim);

    claims.push(claim);
    allEvidence.push(...claimEvidence);
  }

  const identity = provider.identity('deep');
  const timestamp = nowIso();

  const analysis = parseStructured('analysis', AnalysisSchema, {
    id: analysisId,
    resourceId: subject.resourceId,
    resourceType: subject.resourceType,
    passageReference: subject.reference,
    title: subject.title,
    subtitle: subject.subtitle,
    passageText: subject.passageText,
    passageAttribution: subject.attribution,
    summary: subject.summary ?? synthesiseSummary(claims),
    analysisVersion: ANALYSIS_VERSION,
    promptVersion: PROMPT_VERSION,
    modelProvider: identity.provider,
    modelVersion: identity.modelVersion,
    claims,
    evidence: allEvidence,
    sources: [...sourceMap.values()],
    seeded: subject.seeded,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies Analysis);

  // Stage 14: persist, with an audit record carrying the model and prompt
  // versions. Without those an assessment that changes later is unexplainable.
  if (req.persist !== false) {
    const store = getStore();
    await store.saveAnalysis(analysis);
    await store.appendAudit({
      id: randomUUID(),
      entityType: 'ANALYSIS',
      entityId: analysis.id,
      changeType: 'CREATED',
      oldValue: null,
      newValue: { claimCount: claims.length, sourceCount: sourceMap.size },
      reason: `Analysis generated for "${analysis.title}".`,
      modelProvider: identity.provider,
      modelVersion: identity.modelVersion,
      promptVersion: PROMPT_VERSION,
      timestamp,
    });

    for (const flag of citationFlags) {
      await store.appendAudit({
        id: randomUUID(),
        entityType: 'SOURCE',
        entityId: analysis.id,
        changeType: 'CITATION_FLAGGED',
        oldValue: { sourceRef: flag.sourceRef },
        newValue: null,
        reason: flag.reason,
        modelProvider: identity.provider,
        modelVersion: identity.modelVersion,
        promptVersion: PROMPT_VERSION,
        timestamp,
      });
    }
  }

  return { analysis, guardrail: null, citationFlags };
}

function synthesiseSummary(claims: Claim[]): string {
  if (claims.length === 0) return 'No claims were extracted from this material.';
  const scored = claims.filter((c) => c.overallConfidence !== null);
  const unscorable = claims.length - scored.length;
  const parts = [
    `${claims.length} claim${claims.length === 1 ? '' : 's'} assessed.`,
  ];
  if (scored.length > 0) {
    const strongest = scored.reduce((a, b) =>
      (b.overallConfidence ?? 0) > (a.overallConfidence ?? 0) ? b : a,
    );
    const weakest = scored.reduce((a, b) =>
      (b.overallConfidence ?? 100) < (a.overallConfidence ?? 100) ? b : a,
    );
    parts.push(
      `Evidence confidence ranges from ${weakest.confidenceLabel.toLowerCase()} to ${strongest.confidenceLabel.toLowerCase()}, which is why the claims are reported separately rather than aggregated.`,
    );
  }
  if (unscorable > 0) {
    parts.push(
      `${unscorable} claim${unscorable === 1 ? ' is' : 's are'} not directly scorable under historical method.`,
    );
  }
  return parts.join(' ');
}
