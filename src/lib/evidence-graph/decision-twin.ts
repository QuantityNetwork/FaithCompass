/**
 * SDEP export of the Private Credit Decision Twin (case DT-PC-001), built from the frozen v1 engine and the
 * archived case data: nothing here re-implements a calculation or restates a document. The graph is what the
 * engine already evaluates (inputs, premises, effective values, metrics, conditions, warnings, conclusion), anchored
 * to the archived documents' fields, with the Contradiction Map attached.
 *
 * Honest gaps, left empty rather than invented: no HumanAttestation (no one has attested this synthetic case), no
 * Alternative and no MonitoringSignal nodes. `answerCoverage` reports those questions as unanswered.
 */
import { ARCHIVED_CASES } from '@/lib/decision/versions';
import { ENGINES, ENGINE_FOR_CASE } from '@/lib/decision/engines';
import { CASE, CASE_ID, CASE_VERSION, DOCUMENTS, RULESET_VERSION, documentHash, type CaseDocument } from '@/lib/decision/engines/v1/case';
import { CONTRADICTIONS } from '@/lib/decision/engines/v1/contradictions';
import { CONTROLS, DEFAULT_ASSUMPTIONS, evaluate, type Assumptions, type EvaluatedNode } from '@/lib/decision/engines/v1/engine';
import { SDEP_PROTOCOL, SDEP_VERSION, type NodeKind, type SdepDocument, type SdepEdge, type SdepNode } from './schema';

const docNode = (id: string) => `doc:${id}`;
const verNode = (id: string) => `ver:${id}@${CASE_VERSION}`;
const spanNode = (doc: string, field: string) => `span:${doc}#${field}`;
const dtNode = (id: string) => `dt:${id}`;

const KIND: Record<EvaluatedNode['kind'], NodeKind> = {
  input: 'Assumption',
  premise: 'Assumption',
  effective: 'Calculation',
  metric: 'Calculation',
  condition: 'DecisionCondition',
  warning: 'Interpretation',
  conclusion: 'Conclusion',
};

/** The document field a numeric control was read from: the one field of its source document holding its default. */
export function controlField(source: string, value: number): string[] {
  const d = DOCUMENTS.find((x) => x.id === source);
  return (d?.fields ?? []).filter((f) => f.value === value).map((f) => f.key);
}

function sourceNodes(d: CaseDocument): SdepNode[] {
  const hash = documentHash(d);
  const prov = {
    contentSha256: hash,
    version: CASE_VERSION,
    locator: null,
    period: null,
    unit: null,
    basis: null,
    extractionMethod: null,
    verification: d.verification,
    permission: 'synthetic case material, public',
    retrievedAt: null,
  } as const;
  return [
    { id: docNode(d.id), kind: 'SourceDocument', label: d.title, tenant: null, provenance: prov, note: `${d.kind}; ${d.author}; dated ${d.date}` },
    { id: verNode(d.id), kind: 'SourceVersion', label: `${d.title} (case ${CASE_VERSION})`, tenant: null, provenance: prov },
    ...d.fields.map<SdepNode>((f) => ({
      id: spanNode(d.id, f.key),
      kind: 'EvidenceSpan',
      label: f.label,
      tenant: null,
      value: f.value,
      sourceSha256: hash,
      provenance: {
        ...prov,
        locator: { type: 'field', path: `fields.${f.key}` },
        period: f.period ?? null,
        unit: f.unit ?? null,
        basis: f.basis ?? null,
        extractionMethod: 'structured field of the synthetic data room',
      },
      context: { entity: CASE.borrower, measure: f.key, period: f.period ?? '', unit: f.unit ?? '', basis: f.basis ?? '' },
    })),
  ];
}

export function decisionTwinSdep(assumptions: Assumptions = DEFAULT_ASSUMPTIONS, createdAt = '2026-10-20T00:00:00.000Z'): SdepDocument {
  const engineVersion = ENGINE_FOR_CASE[CASE_VERSION];
  const engine = ENGINES[engineVersion];
  const archive = ARCHIVED_CASES[CASE_VERSION];
  const evaluation = evaluate(assumptions);
  const nodes: SdepNode[] = DOCUMENTS.flatMap(sourceNodes);
  const edges: SdepEdge[] = [];
  for (const d of DOCUMENTS) {
    edges.push({ from: verNode(d.id), to: docNode(d.id), type: 'DerivedFrom' });
    for (const f of d.fields) edges.push({ from: spanNode(d.id, f.key), to: verNode(d.id), type: 'Quotes' });
  }

  const ruleId = `rule:${RULESET_VERSION}`;
  nodes.push({ id: ruleId, kind: 'Rule', label: `Decision rules ${RULESET_VERSION}`, tenant: null, note: `Evaluated by ${engine.version} (${engine.source})` });

  for (const n of Object.values(evaluation)) {
    const kind = KIND[n.kind];
    nodes.push({
      id: dtNode(n.id),
      kind,
      label: n.label,
      tenant: null,
      value: n.value,
      ...(kind === 'Calculation' ? { formula: n.formula ?? `computed by ${engine.version}, node ${n.id}` } : {}),
      ...(kind === 'DecisionCondition' && typeof n.status === 'string' && ['MET', 'NOT_MET', 'EVIDENCE_MISSING', 'NEEDS_HUMAN_JUDGMENT'].includes(n.status) ? { status: n.status as SdepNode['status'] } : {}),
      ...(n.note ? { note: n.note } : n.kind === 'warning' ? { note: `warning: ${n.status ?? ''}`.trim() } : {}),
    });
    for (const dep of n.deps) {
      const depKind = KIND[evaluation[dep].kind];
      const type = depKind === 'Assumption' && kind !== 'Assumption' ? 'UsesAssumption' : kind === 'Calculation' ? 'ComputedUsing' : 'DependsOn';
      edges.push({ from: dtNode(n.id), to: dtNode(dep), type });
    }
    if (kind === 'DecisionCondition') edges.push({ from: dtNode(n.id), to: ruleId, type: 'DependsOn' });
    // Anchor to evidence: a control to the field it was read from; anything else to the document version it cites.
    const control = CONTROLS.find((c) => `in.${c.key}` === n.id);
    if (control) {
      for (const field of controlField(control.source, control.default)) edges.push({ from: dtNode(n.id), to: spanNode(control.source, field), type: 'DerivedFrom' });
    } else {
      const type = kind === 'DecisionCondition' || kind === 'Conclusion' ? 'DependsOn' : 'DerivedFrom';
      for (const s of n.sources) edges.push({ from: dtNode(n.id), to: verNode(s), type });
    }
  }

  for (const c of CONTRADICTIONS) {
    nodes.push({ id: `contradiction:${c.id}`, kind: 'Contradiction', label: c.title, tenant: null, contradictionClass: c.class, note: c.reasoning });
    for (const ref of [c.a, c.b]) if (ref) edges.push({ from: `contradiction:${c.id}`, to: spanNode(ref.doc, ref.field), type: 'Contradicts' });
  }

  const conclusion = Object.values(evaluation).find((n) => n.kind === 'conclusion');
  const snapshot = `snapshot:${CASE_ID}@${CASE_VERSION}`;
  nodes.push({ id: snapshot, kind: 'DecisionSnapshot', label: `${CASE.title} (case ${CASE_VERSION})`, tenant: null, value: archive.sha256, note: 'Archived case data; value is the pinned archive hash.' });
  if (conclusion) edges.push({ from: snapshot, to: dtNode(conclusion.id), type: 'DerivedFrom' });

  return {
    protocol: SDEP_PROTOCOL,
    version: SDEP_VERSION,
    id: `sdep:${CASE_ID}@${CASE_VERSION}`,
    question: CASE.question,
    createdAt,
    software: { producer: 'AbrahamMoses Decision Twin', engine: { version: engine.version, sha256: engine.sha256 }, ruleset: RULESET_VERSION, model: null },
    nodes,
    edges,
  };
}
