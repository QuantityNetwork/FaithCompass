/**
 * Evidence-graph queries shared by REST v1 and MCP: "every conclusion depending on this passage", with the paths.
 * Read-only, computed from the synthetic Decision Twin's SDEP export; no state, no model.
 */
import { ApiError } from '@/lib/api/http';
import { decisionTwinSdep } from './decision-twin';
import { checkIntegrity, conclusionsDependingOn, dependencyPaths } from './integrity';
import type { SdepDocument } from './schema';

let cached: { doc: SdepDocument; report: ReturnType<typeof checkIntegrity> } | null = null;
export function graph() {
  if (!cached) {
    const doc = decisionTwinSdep();
    cached = { doc, report: checkIntegrity(doc) };
  }
  return cached;
}

export const MAX_PATHS = 20;

export function impactOf(passage: string, limit = 5) {
  const { doc, report } = graph();
  const node = doc.nodes.find((n) => n.id === passage);
  if (!node) throw new ApiError('not_found', `No node "${passage}" in ${doc.id}.`, { example: 'span:DOC-03#total_debt' });
  const { conclusions, conditions } = conclusionsDependingOn(doc, passage);
  const label = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? null;
  const target = (id: string) => ({ id, label: label(id), ...dependencyPaths(doc, passage, id, limit) });
  return {
    object: 'evidence_impact' as const,
    label: 'Synthetic Decision Twin (DT-PC-001). Deterministic graph query; no AI.',
    sdep: { id: doc.id, protocol: doc.protocol, version: doc.version, sha256: report.sha256, integrity_ok: report.ok },
    passage: { id: node.id, kind: node.kind, label: node.label, value: node.value ?? null },
    conclusions: conclusions.map(target),
    conditions: conditions.map(target),
    paths_per_target: limit,
  };
}

export function graphSummary() {
  const { doc, report } = graph();
  const kinds: Record<string, number> = {};
  for (const n of doc.nodes) kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
  return {
    object: 'evidence_graph' as const,
    label: 'Synthetic Decision Twin (DT-PC-001) as an SDEP document.',
    sdep: { id: doc.id, protocol: doc.protocol, version: doc.version, sha256: report.sha256 },
    software: doc.software,
    counts: { nodes: doc.nodes.length, edges: doc.edges.length, by_kind: kinds },
    integrity: { ok: report.ok, findings: report.findings },
    passages: doc.nodes.filter((n) => n.kind === 'EvidenceSpan').map((n) => n.id),
    document: doc,
  };
}
