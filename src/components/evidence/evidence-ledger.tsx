import Link from 'next/link';
import type { EvidenceItem, Source } from '@/lib/evidence/schema';
import {
  dimensionLabel,
  perspectiveLabel,
  relationshipClass,
  relationshipLabel,
  tierLabel,
  verificationLabel,
} from '@/lib/evidence/format';
import { verificationCaveat } from '@/lib/evidence/citations';
import { Tag } from './primitives';

/**
 * The evidence ledger.
 *
 * Every item names its source, its relationship to the claim, the dimension it
 * speaks to, and why it matters. A reader who disagrees with a conclusion can
 * walk down to the specific item they disagree with — which is the whole point
 * of building this rather than emitting a paragraph of confident prose.
 */
export function EvidenceLedger({
  items,
  sources,
}: {
  items: EvidenceItem[];
  sources: Source[];
}) {
  if (items.length === 0) {
    return (
      <p className="small muted">
        No evidence items are recorded for this claim. Where a claim is not the kind of
        proposition evidence bears on, that is expected; see the assessment note above.
      </p>
    );
  }

  const byId = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="ledger">
      {items.map((item) => {
        const source = byId.get(item.sourceId);
        const caveat = source ? verificationCaveat(source) : null;
        return (
          <div className="ledger__row" key={item.id}>
            <div className="ledger__head">
              <h4 className="ledger__title">{item.title}</h4>
              <span className={`ledger__rel ${relationshipClass(item.relationship)}`}>
                {relationshipLabel(item.relationship)}
              </span>
            </div>

            <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
              {item.description}
            </p>

            {item.excerpt ? <blockquote className="excerpt small">{item.excerpt}</blockquote> : null}

            <p className="small muted" style={{ marginTop: 12, marginBottom: 14 }}>
              <span className="tiny" style={{ color: 'var(--gold)' }}>
                Why it matters ·{' '}
              </span>
              {item.whyItMatters}
            </p>

            {source ? (
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Tag variant={`tag--tier-${item.qualityTier}`}>{tierLabel(item.qualityTier)}</Tag>
                  <Tag>{dimensionLabel(item.dimension)}</Tag>
                  <Tag>{perspectiveLabel(source.traditionPerspective)}</Tag>
                </div>
                <p className="small faint" style={{ margin: 0 }}>
                  {source.citation}
                </p>
                <p style={{ margin: '8px 0 0' }}>
                  <span
                    className={`verification verification--${source.verified.toLowerCase()}`}
                  >
                    {verificationLabel(source.verified)}
                  </span>
                  {caveat ? <span className="small faint"> — {caveat}</span> : null}
                </p>
                <p className="small faint" style={{ margin: '8px 0 0' }}>
                  Independence as weighted: {item.independence.toFixed(2)} · relevance{' '}
                  {item.relevance.toFixed(2)} · directness {item.directness.toFixed(2)}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SourceLedgerTable({ sources }: { sources: Source[] }) {
  return (
    <div className="ledger">
      {sources.map((s) => (
        <div className="ledger__row" key={s.id}>
          <div className="ledger__head">
            <h4 className="ledger__title">{s.title}</h4>
            <Tag variant={`tag--tier-${s.qualityTier}`}>Tier {s.qualityTier}</Tag>
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            {s.author ? `${s.author} · ` : ''}
            {s.publication ? `${s.publication} · ` : ''}
            {s.date ?? 'n.d.'}
          </p>
          <p className="small" style={{ margin: '12px 0 0' }}>
            {s.citation}
          </p>
          <p className="small muted" style={{ margin: '12px 0 0' }}>
            <span className="tiny" style={{ color: 'var(--gold)' }}>
              Reliability ·{' '}
            </span>
            {s.reliabilityAssessment}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Tag>{perspectiveLabel(s.traditionPerspective)}</Tag>
            <Tag>{s.sourceType.replace(/_/g, ' ')}</Tag>
            {s.isbn ? <Tag>ISBN {s.isbn}</Tag> : null}
            {s.archiveReference ? <Tag>{s.archiveReference}</Tag> : null}
          </div>
          <p style={{ margin: '12px 0 0' }}>
            <span className={`verification verification--${s.verified.toLowerCase()}`}>
              {verificationLabel(s.verified)}
            </span>
            {verificationCaveat(s) ? (
              <span className="small faint"> — {verificationCaveat(s)}</span>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export function SourceLedgerLink({ analysisId }: { analysisId: string }) {
  return (
    <Link className="button button--quiet" href={`/evidence/analysis/${analysisId}/sources`}>
      Source Ledger
    </Link>
  );
}
