import Link from 'next/link';
import type { Analysis, Claim } from '@/lib/evidence/schema';
import {
  certaintyDefinition,
  certaintyLabel,
  claimTypeLabel,
  dimensionLabel,
  ordinal,
  perspectiveLabel,
  scholarlyPositionLabel,
} from '@/lib/evidence/format';
import { ABSENCE_VERDICT_META } from '@/lib/evidence/taxonomy';
import { EvidenceProfileGrid } from './evidence-profile';
import { EvidenceLedger } from './evidence-ledger';
import { EvidenceMap } from './evidence-map';
import { ConfidenceFigure, Disclosure, ReasonList, SectionTitle, Tag } from './primitives';

export function ClaimHeadline({ claim }: { claim: Claim }) {
  return (
    <div className="claim__verdict">
      <div
        className={`claim__verdict-band${claim.overallConfidence === null ? ' claim__verdict-band--na' : ''}`}
      >
        {claim.confidenceLabel}
      </div>
      {claim.overallConfidence !== null ? (
        <div className="claim__verdict-score">{claim.overallConfidence}</div>
      ) : null}
    </div>
  );
}

/** Collapsed row in the passage view. */
export function ClaimRow({ analysis, claim }: { analysis: Analysis; claim: Claim }) {
  const items = analysis.evidence.filter((e) => e.claimId === claim.id);
  return (
    <details className="claim">
      <summary className="claim__summary">
        <span className="claim__ordinal">{ordinal(claim.ordinal)}</span>
        <span>
          <span className="claim__statement">{claim.statement}</span>
          <span className="claim__meta">
            <Tag variant="tag--type">{claimTypeLabel(claim.claimType)}</Tag>
            <span className="tiny faint">{certaintyLabel(claim.certainty)}</span>
            {claim.positionNote ? (
              <span className="tiny muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {claim.positionNote}
              </span>
            ) : null}
          </span>
        </span>
        <ClaimHeadline claim={claim} />
      </summary>
      <div className="claim__body">
        <p className="prose" style={{ marginTop: 0 }}>
          {claim.summary}
        </p>
        <EvidenceProfileGrid profile={claim.primaryProfile} />
        <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link className="button" href={`/evidence/claim/${claim.id}`}>
            View Evidence · {items.length} item{items.length === 1 ? '' : 's'}
          </Link>
          <Link className="button button--quiet" href={`/evidence/claim/${claim.id}/card`}>
            Evidence Card
          </Link>
        </div>
      </div>
    </details>
  );
}

/** Full claim analysis. */
export function ClaimDetail({ analysis, claim }: { analysis: Analysis; claim: Claim }) {
  const items = analysis.evidence.filter((e) => e.claimId === claim.id);
  const supporting = items.filter(
    (e) => e.relationship === 'SUPPORTS' || e.relationship === 'WEAKLY_SUPPORTS',
  );
  const opposing = items.filter(
    (e) =>
      e.relationship === 'CHALLENGES' ||
      e.relationship === 'WEAKLY_CHALLENGES' ||
      e.relationship === 'CONTRADICTS',
  );
  const contextual = items.filter(
    (e) =>
      e.relationship === 'CONTEXTUAL' ||
      e.relationship === 'NEUTRAL' ||
      e.relationship === 'INSUFFICIENT_DATA',
  );

  return (
    <>
      <SectionTitle>Evidence Profile</SectionTitle>
      <EvidenceProfileGrid profile={claim.primaryProfile} />

      <div className="panel" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 190 }}>
            <ConfidenceFigure
              score={claim.overallConfidence}
              label={claim.confidenceLabel}
              caption="Overall evidence confidence"
            />
            <p className="small faint" style={{ marginTop: 14, marginBottom: 0 }}>
              An assessment of evidential support. Not a probability that the claim is true.
            </p>
          </div>
          <div style={{ flex: '1 1 320px' }}>
            <div className="profile__label">Certainty</div>
            <div className="profile__band" style={{ marginTop: 12 }}>
              {certaintyLabel(claim.certainty)}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              {certaintyDefinition(claim.certainty)}
            </p>
            <div className="profile__label" style={{ marginTop: 22 }}>
              Scholarly position
            </div>
            <div className="profile__band" style={{ marginTop: 12 }}>
              {scholarlyPositionLabel(claim.scholarlyPosition)}
            </div>
            <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
              {claim.scholarlyLandscape}
            </p>
          </div>
        </div>
      </div>

      {claim.metaphysical ? (
        <div className="notice">
          <div className="tiny" style={{ color: 'var(--gold)', marginBottom: 12 }}>
            Metaphysical conclusion
          </div>
          <p className="small" style={{ marginTop: 0 }}>
            <strong>What historical method reaches.</strong> {claim.metaphysical.historicalReach}
          </p>
          <p className="small" style={{ marginBottom: 0 }}>
            <strong>Theological reading.</strong> {claim.metaphysical.theologicalReading}
          </p>
        </div>
      ) : null}

      <Disclosure title="Why this score?" open>
        <div className="balance">
          <div>
            <div className="compare__row-label" style={{ marginTop: 0 }}>
              Evidence increasing confidence
            </div>
            <ReasonList items={claim.whyThisScore.increasing} variant="plus" />
          </div>
          <div>
            <div className="compare__row-label" style={{ marginTop: 0 }}>
              Evidence lowering confidence
            </div>
            <ReasonList items={claim.whyThisScore.lowering} variant="minus" />
          </div>
        </div>

        <div className="balance" style={{ marginTop: 30 }}>
          <div>
            <div className="compare__row-label" style={{ marginTop: 0 }}>
              Important uncertainties
            </div>
            <ReasonList items={claim.whyThisScore.uncertainties} variant="neutral" />
            <div className="compare__row-label">Assumptions</div>
            <ReasonList items={claim.whyThisScore.assumptions} variant="neutral" />
          </div>
          <div>
            <div className="compare__row-label" style={{ marginTop: 0 }}>
              Alternative interpretations
            </div>
            <ReasonList items={claim.whyThisScore.alternativeInterpretations} variant="neutral" />
            <div className="compare__row-label">Missing evidence</div>
            <ReasonList items={claim.whyThisScore.missingEvidence} variant="neutral" />
            <div className="compare__row-label">Major scholarly disagreements</div>
            <ReasonList items={claim.whyThisScore.scholarlyDisagreements} variant="neutral" />
          </div>
        </div>

        <div className="notice" style={{ marginBottom: 0 }}>
          <div className="tiny" style={{ color: 'var(--gold)', marginBottom: 10 }}>
            Conclusion
          </div>
          <p className="small" style={{ margin: 0 }}>
            {claim.whyThisScore.conclusion}
          </p>
        </div>
      </Disclosure>

      <Disclosure title="What would change this assessment?" open>
        <ReasonList items={claim.whatWouldChangeThis} variant="neutral" />
      </Disclosure>

      <Disclosure title={`Supporting evidence · ${supporting.length}`}>
        <EvidenceLedger items={supporting} sources={analysis.sources} />
      </Disclosure>

      <Disclosure title={`Counter-evidence · ${opposing.length}`}>
        <EvidenceLedger items={opposing} sources={analysis.sources} />
      </Disclosure>

      {contextual.length > 0 ? (
        <Disclosure title={`Contextual evidence · ${contextual.length}`}>
          <EvidenceLedger items={contextual} sources={analysis.sources} />
        </Disclosure>
      ) : null}

      <Disclosure title="Evidence map">
        <EvidenceMap claim={claim} items={items} sources={analysis.sources} />
      </Disclosure>

      <Disclosure title="Certainty breakdown">
        <div className="ladder">
          <LadderStep label="What is certain" items={claim.certaintyBreakdown.certain} />
          <LadderStep label="What is probable" items={claim.certaintyBreakdown.probable} />
          <LadderStep label="What is possible" items={claim.certaintyBreakdown.possible} />
          <LadderStep label="What is speculative" items={claim.certaintyBreakdown.speculative} />
          <LadderStep label="What we do not know" items={claim.certaintyBreakdown.unknown} />
        </div>
      </Disclosure>

      {claim.absence ? (
        <Disclosure title="Absence of evidence">
          <div className="notice" style={{ marginTop: 0 }}>
            <div className="tiny" style={{ color: 'var(--gold)', marginBottom: 10 }}>
              {ABSENCE_VERDICT_META[claim.absence.verdict].label}
            </div>
            <p className="small" style={{ margin: 0 }}>
              {ABSENCE_VERDICT_META[claim.absence.verdict].definition}
            </p>
          </div>
          <AbsenceRow label="Would evidence survive?" value={claim.absence.wouldEvidenceSurvive} />
          <AbsenceRow label="Excavation coverage" value={claim.absence.excavationCoverage} />
          <AbsenceRow
            label="Expected material footprint"
            value={claim.absence.expectedMaterialFootprint}
          />
          <AbsenceRow label="Dating precision" value={claim.absence.datingPrecision} />
          <AbsenceRow
            label="Material culture distinctiveness"
            value={claim.absence.materialCultureDistinctiveness}
          />
        </Disclosure>
      ) : null}

      {claim.prophetic ? (
        <Disclosure title="Prophetic assessment">
          <AbsenceRow label="Date of composition" value={claim.prophetic.compositionDate} />
          <AbsenceRow
            label="Earliest manuscript evidence"
            value={claim.prophetic.earliestManuscriptEvidence}
          />
          <AbsenceRow label="Specificity of prediction" value={claim.prophetic.specificity} />
          <AbsenceRow label="Ambiguity" value={claim.prophetic.ambiguity} />
          <AbsenceRow
            label="Retrospective composition risk"
            value={claim.prophetic.retrospectiveCompositionRisk}
          />
          <AbsenceRow
            label="Historical correspondence"
            value={claim.prophetic.historicalCorrespondence}
          />
          <AbsenceRow
            label="Interpretive assumptions required"
            value={String(claim.prophetic.interpretiveAssumptionCount)}
          />
          {claim.prophetic.alternativeFulfilmentCandidates.length > 0 ? (
            <>
              <div className="compare__row-label">Alternative fulfilment candidates</div>
              <ReasonList
                items={claim.prophetic.alternativeFulfilmentCandidates}
                variant="neutral"
              />
            </>
          ) : null}
        </Disclosure>
      ) : null}

      <Disclosure title="Evidence dimensions">
        <div className="ledger">
          {claim.dimensions.map((d) => (
            <div className="ledger__row" key={d.id}>
              <div className="ledger__head">
                <h4 className="ledger__title">{dimensionLabel(d.dimensionType)}</h4>
                <span className="ledger__rel" style={{ color: 'var(--gold-bright)' }}>
                  {d.confidenceLabel} · {d.score}
                </span>
              </div>
              <p className="small muted" style={{ marginBottom: 0 }}>
                {d.reasoningSummary}
              </p>
            </div>
          ))}
        </div>
      </Disclosure>

      {claim.interpretations.length > 0 ? (
        <Disclosure title={`Compare interpretations · ${claim.interpretations.length}`}>
          <InterpretationComparison claim={claim} />
        </Disclosure>
      ) : null}

      <Disclosure title="Assessment provenance">
        <p className="small muted" style={{ marginTop: 0 }}>
          Produced by <strong>{analysis.modelProvider}</strong> ({analysis.modelVersion}) under
          prompt version <strong>{analysis.promptVersion}</strong>, analysis version{' '}
          {analysis.analysisVersion}. Created {analysis.createdAt.slice(0, 10)}, last updated{' '}
          {analysis.updatedAt.slice(0, 10)}.
        </p>
        <div className="compare__row-label">Scoring factors</div>
        <div className="ledger">
          <div className="ledger__row">
            <p className="small" style={{ margin: 0 }}>
              Supporting strength {claim.scoringFactors.supportingStrength.toFixed(2)} · challenge
              strength {claim.scoringFactors.challengeStrength.toFixed(2)} · missing evidence{' '}
              {claim.scoringFactors.missingEvidence.toFixed(2)} · source dependence{' '}
              {claim.scoringFactors.sourceDependence.toFixed(2)} · chronology uncertainty{' '}
              {claim.scoringFactors.chronologyUncertainty.toFixed(2)} · interpretive ambiguity{' '}
              {claim.scoringFactors.interpretiveAmbiguity.toFixed(2)} · scholarly disagreement{' '}
              {claim.scoringFactors.scholarlyDisagreement.toFixed(2)}
            </p>
          </div>
        </div>
        {claim.calibrationNotes.length > 0 ? (
          <>
            <div className="compare__row-label">Calibration rules applied</div>
            <ReasonList items={claim.calibrationNotes} variant="neutral" />
          </>
        ) : null}
      </Disclosure>
    </>
  );
}

function LadderStep({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="ladder__step">
      <div className="ladder__label">{label}</div>
      <div>
        {items.length === 0 ? (
          <p className="small faint" style={{ margin: 0 }}>
            Nothing recorded at this level.
          </p>
        ) : (
          <ul className="reasons reasons--neutral" style={{ margin: 0 }}>
            {items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AbsenceRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="compare__row-label">{label}</div>
      <p className="small" style={{ margin: 0 }}>
        {value}
      </p>
    </>
  );
}

export function InterpretationComparison({ claim }: { claim: Claim }) {
  return (
    <div className="compare">
      {claim.interpretations.map((interp) => (
        <div className="compare__col" key={interp.id}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Tag variant="tag--type">{perspectiveLabel(interp.tradition)}</Tag>
            <Tag>{scholarlyPositionLabel(interp.scholarlyPosition)}</Tag>
          </div>
          <h4 style={{ fontSize: 20, color: 'var(--ink-strong)' }}>{interp.name}</h4>
          <p className="small muted" style={{ marginTop: 10 }}>
            {interp.description}
          </p>

          <div style={{ marginTop: 22 }}>
            <ConfidenceFigure
              score={interp.confidence}
              label={interp.confidenceLabel}
              caption="Interpretive confidence"
            />
          </div>

          <div className="compare__row-label">Direct textual support</div>
          <p className="small" style={{ margin: 0 }}>
            {interp.directTextualSupport}
          </p>

          <div className="compare__row-label">Canonical support</div>
          <p className="small" style={{ margin: 0 }}>
            {interp.canonicalSupport}
          </p>

          <div className="compare__row-label">Historical reception</div>
          <p className="small" style={{ margin: 0 }}>
            {interp.historicalReception}
          </p>

          <div className="compare__row-label">Assumptions required</div>
          <ReasonList items={interp.assumptionsRequired} variant="neutral" />

          <div className="compare__row-label">Counterarguments</div>
          <ReasonList items={interp.counterarguments} variant="minus" />
        </div>
      ))}
    </div>
  );
}
