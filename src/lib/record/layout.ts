/**
 * Layered layout for the dependency graph, left to right.
 *
 * Reading principles sit in the first column; claims are placed in columns by
 * the length of their longest chain of in-scope premises, so every arrow runs
 * rightward from what a claim rests on to the claim itself, and the
 * conclusions traditions dispute end up on the right. Width is bounded by the
 * depth of the argument rather than by how many texts it cites, so the graph
 * grows downward on narrow screens. One barycentre pass orders each column by
 * the positions of its premises to reduce crossings. Pure and deterministic:
 * the server and the browser draw the same picture.
 */

import type { DependencyGraph } from './engine';

export const NODE_W = 196;
export const NODE_H = 60;
const GAP_X = 64;
const GAP_Y = 14;
const PAD = 20;

export interface LayoutNode {
  id: string;
  kind: 'claim' | 'axiom';
  role: string;
  x: number;
  y: number;
  title: string;
  lines: string[];
}

export interface LayoutEdge {
  from: string;
  to: string;
  derivation: string;
  kind: 'necessary' | 'supporting' | 'requires' | 'strengthened_by';
  d: string;
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

function wrap(text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line ? `${line} ${w}` : w).length > width) {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.;:]?$/, '').slice(0, width - 1)}…`;
  }
  return lines;
}

export function layoutGraph(graph: DependencyGraph, scope: string[]): GraphLayout {
  const inScope = new Set(scope);
  const claims = graph.claims.filter((c) => inScope.has(c.code));
  const derivations = graph.derivations.filter((d) => inScope.has(d.claim));
  const axiomCodes = [...new Set(derivations.flatMap((d) => d.axioms.map((a) => a.axiom)))].sort();

  // Level: 1 + longest chain of in-scope premises; cycle-safe.
  const premisesOf = new Map<string, string[]>();
  for (const d of derivations) {
    const list = premisesOf.get(d.claim) ?? [];
    for (const p of d.premises) if (inScope.has(p.claim) && !list.includes(p.claim)) list.push(p.claim);
    premisesOf.set(d.claim, list);
  }
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const levelOf = (code: string): number => {
    if (level.has(code)) return level.get(code)!;
    if (visiting.has(code)) return 1;
    visiting.add(code);
    const ps = premisesOf.get(code) ?? [];
    const l = ps.length === 0 ? 1 : 1 + Math.max(...ps.map(levelOf));
    visiting.delete(code);
    level.set(code, l);
    return l;
  };
  for (const c of claims) levelOf(c.code);

  const rows: string[][] = [axiomCodes];
  for (const c of claims) {
    const l = level.get(c.code)!;
    (rows[l] ??= []).push(c.code);
  }
  for (let i = 0; i < rows.length; i++) rows[i] ??= [];

  // Order rows: initial by code, then one barycentre pass top-down.
  const xIndex = new Map<string, number>();
  rows.forEach((row) => {
    row.sort();
    row.forEach((id, i) => xIndex.set(id, i - (row.length - 1) / 2));
  });
  const parentsOf = (id: string): string[] => [
    ...(premisesOf.get(id) ?? []),
    ...derivations.filter((d) => d.claim === id).flatMap((d) => d.axioms.map((a) => a.axiom)),
  ];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const bary = new Map(
      row.map((id) => {
        const ps = parentsOf(id).filter((p) => xIndex.has(p));
        return [id, ps.length ? ps.reduce((s, p) => s + xIndex.get(p)!, 0) / ps.length : 0];
      }),
    );
    row.sort((a, b) => bary.get(a)! - bary.get(b)! || a.localeCompare(b));
    row.forEach((id, j) => xIndex.set(id, j - (row.length - 1) / 2));
  }

  // Columns are the levels; within a column, nodes stack top to bottom.
  const columns = rows.filter((r) => r.length > 0);
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const width = PAD * 2 + columns.length * NODE_W + (columns.length - 1) * GAP_X;
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * GAP_Y;

  const claimById = new Map(claims.map((c) => [c.code, c]));
  const axiomById = new Map(graph.axioms.map((a) => [a.code, a]));
  const nodes: LayoutNode[] = [];
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((column, c) => {
    const columnHeight = column.length * NODE_H + (column.length - 1) * GAP_Y;
    const startY = (height - columnHeight) / 2;
    column.forEach((id, i) => {
      const x = PAD + c * (NODE_W + GAP_X);
      const y = startY + i * (NODE_H + GAP_Y);
      pos.set(id, { x, y });
      const claim = claimById.get(id);
      if (claim) {
        nodes.push({ id, kind: 'claim', role: claim.role, x, y, title: claim.statement, lines: wrap(claim.statement, 30, 2) });
      } else {
        const a = axiomById.get(id)!;
        nodes.push({ id, kind: 'axiom', role: 'axiom', x, y, title: `${a.label} — ${a.heldBy}`, lines: wrap(a.label, 30, 2) });
      }
    });
  });

  const curve = (from: string, to: string) => {
    const a = pos.get(from)!;
    const b = pos.get(to)!;
    const x1 = a.x + NODE_W;
    const y1 = a.y + NODE_H / 2;
    const x2 = b.x;
    const y2 = b.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 6} ${y2}`;
  };

  const edges: LayoutEdge[] = [];
  for (const d of derivations) {
    for (const p of d.premises) {
      if (!pos.has(p.claim) || !pos.has(d.claim)) continue;
      edges.push({ from: p.claim, to: d.claim, derivation: d.code, kind: p.necessity, d: curve(p.claim, d.claim) });
    }
    for (const a of d.axioms) {
      if (!pos.has(a.axiom)) continue;
      edges.push({ from: a.axiom, to: d.claim, derivation: d.code, kind: a.role, d: curve(a.axiom, d.claim) });
    }
  }
  return { nodes, edges, width, height };
}

/**
 * The claims a case's graph shows: its claims that are derived, and
 * everything they rest on. Texts that nothing in the case argues from are
 * listed on the case page rather than drawn as unconnected boxes.
 */
export function caseScope(graph: DependencyGraph, caseClaims: string[]): string[] {
  const derived = new Set(graph.derivations.map((d) => d.claim));
  const seeds = caseClaims.filter((c) => derived.has(c));
  const out = new Set(seeds);
  const stack = [...seeds];
  while (stack.length) {
    const c = stack.pop()!;
    for (const d of graph.derivations) {
      if (d.claim !== c) continue;
      for (const p of d.premises) {
        if (!out.has(p.claim)) {
          out.add(p.claim);
          stack.push(p.claim);
        }
      }
    }
  }
  return [...out].sort();
}
