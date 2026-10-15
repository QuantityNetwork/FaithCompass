/**
 * Server-side preparation of the Dependency Explorer's props.
 *
 * The URL carries the simulation (?reject=AM-AX-002,AM-CLAIM-000190&lens=…),
 * so every state is a shareable, server-rendered page. Codes are validated
 * against the record: unknown ones are dropped rather than echoed back.
 */

import type { ExplorerProps } from '@/components/record/dependency-explorer';
import type { AbrahamMosesRecord } from '@/lib/record/record';

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function parseSimulationParams(record: AbrahamMosesRecord, sp: SearchParams) {
  const raw = (param(sp, 'reject') ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40);
  const reject = [...new Set(raw.filter((c) => record.claim(c) || record.axiom(c)))].sort();
  const lensRaw = param(sp, 'lens');
  const lens = lensRaw && record.tradition(lensRaw) ? lensRaw : null;
  return { reject, lens };
}

export function explorerProps(
  record: AbrahamMosesRecord,
  opts: {
    scope: string[];
    basePath: string;
    searchParams: SearchParams;
    positions?: ExplorerProps['positions'];
    featured?: [string, string];
    suggested?: string;
  },
): ExplorerProps {
  const traditionNames = Object.fromEntries(record.data.traditions.map((t) => [t.id, t.name]));
  const edgeLabels: Record<string, string> = {};
  const covenantLabel = (id: string) => record.data.covenantNodes.find((n) => n.id === id)?.label ?? id;
  const doctrineLabel = (id: string) => record.data.doctrineNodes.find((n) => n.id === id)?.label ?? id;
  for (const e of record.data.covenants) edgeLabels[`covenant:${e.code}`] = `${covenantLabel(e.source)} → ${covenantLabel(e.target)}`;
  for (const e of record.data.doctrine) edgeLabels[`doctrine:${e.code}`] = `${doctrineLabel(e.source)} → ${doctrineLabel(e.target)}`;

  return {
    graph: record.graph(),
    scope: opts.scope,
    basePath: opts.basePath,
    initial: parseSimulationParams(record, opts.searchParams),
    traditions: record.data.traditions.map((t) => ({ id: t.id, name: t.name })),
    positions: opts.positions,
    featured: opts.featured,
    suggested: opts.suggested,
    counterModels: Object.fromEntries(record.data.counterModels.map((m) => [m.code, { title: m.title, heldBy: m.heldBy }])),
    edgeLabels,
    traditionNames,
  };
}
