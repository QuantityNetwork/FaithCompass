import type { Claim, EvidenceItem, Source } from '@/lib/evidence/schema';
import { dimensionLabel, relationshipLabel } from '@/lib/evidence/format';
import { RELATIONSHIP_VALENCE } from '@/lib/evidence/taxonomy';

/**
 * The Evidence Map.
 *
 * A radial view of one claim and the evidence around it. Every node is a real
 * ledger item — position and edge weight are derived from the item's dimension
 * and its computed weight, not chosen for looks. A decorative graph would be
 * worse than no graph, because it would imply structure the data does not have.
 */
export function EvidenceMap({
  claim,
  items,
  sources,
}: {
  claim: Claim;
  items: EvidenceItem[];
  sources: Source[];
}) {
  if (items.length === 0) return null;

  const byId = new Map(sources.map((s) => [s.id, s]));

  // Group by dimension so the map shows which kinds of evidence bear on the
  // claim, not merely how many items there are.
  const groups = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const list = groups.get(item.dimension) ?? [];
    list.push(item);
    groups.set(item.dimension, list);
  }

  const dimensions = [...groups.keys()];

  // Size to the data. A claim resting on two dimensions should not be drawn in
  // a frame built for eight, and stacking two nodes vertically in a tall canvas
  // reads as an empty diagram rather than a small one.
  const sparse = dimensions.length <= 2;
  const width = 900;
  const height = sparse ? 260 : dimensions.length <= 4 ? 420 : 520;
  const cx = width / 2;
  const cy = height / 2;
  const radius = sparse ? 250 : dimensions.length <= 4 ? 150 : 190;

  const nodes = dimensions.map((dimension, i) => {
    // Two nodes sit left and right of the claim; three or more fan out from the
    // top of a circle.
    const angle = sparse
      ? i * Math.PI
      : (i / dimensions.length) * Math.PI * 2 - Math.PI / 2;
    const group = groups.get(dimension)!;
    const netValence =
      group.reduce((sum, it) => sum + RELATIONSHIP_VALENCE[it.relationship], 0) / group.length;
    return {
      dimension,
      items: group,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      netValence,
    };
  });

  const edgeColour = (v: number) =>
    v > 0.05 ? 'var(--gold)' : v < -0.05 ? '#c98a7a' : 'var(--ink-faint)';

  return (
    <div className="map-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Evidence map for the claim: ${claim.statement}`}
        style={{ display: 'block', width: '100%', minWidth: 620 }}
      >
        <title>Evidence map</title>

        {nodes.map((n) => (
          <line
            key={`edge-${n.dimension}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={edgeColour(n.netValence)}
            strokeWidth={0.8 + Math.abs(n.netValence) * 1.6}
            opacity={0.75}
          />
        ))}

        {/* The claim sits at the centre. */}
        <circle cx={cx} cy={cy} r={58} fill="var(--ground-raised)" stroke="var(--gold-dim)" />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill="var(--gold)"
          fontSize="10"
          letterSpacing="2.4"
          fontFamily="var(--sans)"
        >
          CLAIM
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill="var(--ink-strong)"
          fontSize="14"
          fontFamily="var(--sans)"
        >
          {claim.overallConfidence === null ? '—' : claim.overallConfidence}
        </text>

        {nodes.map((n) => {
          const label = dimensionLabel(n.dimension);
          const plateWidth = Math.max(132, label.length * 6.6);
          const sourceNames = n.items
            .map((it) => byId.get(it.sourceId)?.title ?? it.sourceId)
            .join('; ');
          return (
            <g className="map-node" key={n.dimension}>
              <title>
                {`${label} — ${n.items.length} item(s): ${n.items
                  .map((it) => relationshipLabel(it.relationship))
                  .join(', ')}. ${sourceNames}`}
              </title>
              <rect
                className="map-node__plate"
                x={n.x - plateWidth / 2}
                y={n.y - 21}
                width={plateWidth}
                height={42}
                fill="var(--ground-raised)"
                stroke="var(--rule-strong)"
              />
              <text
                x={n.x}
                y={n.y - 3}
                textAnchor="middle"
                fill="var(--ink)"
                fontSize="10.5"
                fontFamily="var(--sans)"
              >
                {label}
              </text>
              <text
                x={n.x}
                y={n.y + 12}
                textAnchor="middle"
                fill="var(--ink-faint)"
                fontSize="9"
                fontFamily="var(--sans)"
                letterSpacing="1.2"
              >
                {n.items.length} ITEM{n.items.length === 1 ? '' : 'S'}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <span className="lg-supports">Supports</span>
        <span className="lg-challenges">Challenges</span>
        <span className="lg-contextual">Contextual</span>
        <span style={{ marginLeft: 'auto' }}>
          Hover a node for its sources · every node is a ledger item
        </span>
      </div>
    </div>
  );
}
