/**
 * The original public API at /api/public/*, kept for existing clients.
 *
 * Doctrine Lab and the Sagolik sandbox call these endpoints, so the response
 * shapes are preserved field for field (tests compare them with responses
 * captured from the live service). Changes are additive only: new fields may
 * appear, existing ones keep their names and types. Rejection analysis is
 * served by the corrected AND/OR engine and says so in a `semantics` field.
 *
 * New integrations should use /api/v1 (REST) or /mcp (MCP).
 */

import { generateProvenance } from '@/lib/record/provenance';
import { getRecord, type AbrahamMosesRecord } from '@/lib/record/record';
import type { Claim } from '@/lib/record/schema';
import { CLASSIFICATION_META } from '@/lib/record/taxonomy';
import { API_VERSION, SITE_NAME, absoluteUrl } from '@/lib/site/config';
import { SUPPORTED_PROTOCOL_VERSIONS, handleMcpPost } from '@/lib/mcp/server';
import { TOOLS } from '@/lib/mcp/tools';
import { ApiError, errorResponse, guarded, jsonResponse } from './http';
import { SIMULATION_NOTICE } from './views';
import { runSimulation } from './operations';
import { downstreamOf } from '@/lib/record/engine';

type R = AbrahamMosesRecord;

export const APPROVED_CLIENTS = ['sandbox.sagolik.com', 'doctrinelab.org'];

function legacyClaim(record: R, claim: Claim) {
  const r = record.current(claim);
  return {
    code: claim.code,
    statement: r.statement,
    claim_type: CLASSIFICATION_META[r.classification].label,
    topic: claim.topic,
    sources: r.primaryWitnesses.map((w) => w.display),
    textual_confidence: r.headlineConfidence,
    disputed: r.disputed,
    interpretive_divergence: r.interpretiveDivergence,
    updated_at: r.publishedAt,
    // Additive fields.
    revision: r.rev,
    status: r.status,
    url: absoluteUrl(`/claims/${claim.code}`),
  };
}

function legacySteps(record: R, claim: Claim) {
  return generateProvenance(record, claim).map(({ position, label, detail }) => ({ position, label, detail }));
}

function int(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ApiError('invalid_parameter', `Expected an integer between ${min} and ${max}, got “${value}”.`);
  }
  return n;
}

function flatDependencies(record: R) {
  return record.data.derivations.flatMap((d) =>
    d.premises.map((p) => ({
      claim: d.claim,
      depends_on: p.claim,
      dependency_type: p.type,
      necessity: p.necessity,
      rationale: p.rationale,
      derivation: d.code,
    })),
  );
}

export function serviceManifest() {
  const base = absoluteUrl('/api/public');
  return {
    object: 'service_manifest',
    name: SITE_NAME,
    description: 'Structured theological intelligence: published claims, covenant relationships and provenance chains.',
    version: API_VERSION,
    access: 'public, read-only',
    license: 'Attribution required. Inclusion of a source does not constitute endorsement.',
    mcp: {
      endpoint: absoluteUrl('/mcp'),
      transport: 'streamable-http',
      note: 'This URL also accepts MCP JSON-RPC over POST. The canonical MCP endpoint is /mcp.',
      protocol_versions: [...SUPPORTED_PROTOCOL_VERSIONS],
      tools: TOOLS.map((t) => t.name),
    },
    rest_v1: absoluteUrl('/api/v1'),
    resources: [
      { name: 'claims.list', method: 'GET', url: `${base}/claims`, parameters: { topic: 'optional string filter', claim_type: 'optional string filter', limit: '1-200, default 50', offset: 'default 0' } },
      { name: 'claims.get', method: 'GET', url: `${base}/claims/{code}`, parameters: { code: 'claim code, e.g. AM-CLAIM-000184' } },
      { name: 'covenants.list', method: 'GET', url: `${base}/covenants`, parameters: { covenant: 'optional covenant name filter' } },
      { name: 'doctrine.list', method: 'GET', url: `${base}/doctrine`, parameters: { topic: 'optional topic filter', node: 'optional node filter (source or target)' } },
      { name: 'provenance.get', method: 'GET', url: `${base}/provenance?claim={code}`, parameters: { claim: 'claim code' } },
      {
        name: 'dependencies.get',
        method: 'GET',
        url: `${base}/dependencies?claim={code}`,
        parameters: { claim: 'optional claim code; omit for the full proof graph. Returns rests_on, supports and blast_radius' },
      },
      {
        name: 'hermeneutics.graph',
        method: 'GET',
        url: `${base}/hermeneutics`,
        parameters: {
          reject: 'optional claim code (AM-CLAIM-…) or axiom code (AM-AX-…), or several separated by commas; returns affected claims, Covenant/Doctrine map edges and aligned counter-models',
        },
      },
      { name: 'agents.verify', method: 'GET', url: `${base}/agents?am_id={id}`, parameters: { am_id: 'optional AbrahamMoses identity (AM-AG-…)', audit: 'set to any value to read the public agent action audit log' } },
      { name: 'agents.act', method: 'POST', url: `${base}/agent/act`, parameters: { headers: 'x-am-agent and x-am-key, issued by a lead editor', note: 'No agent identities are registered on this deployment.' } },
      { name: 'service.mcp', method: 'POST', url: absoluteUrl('/mcp'), parameters: { body: 'MCP JSON-RPC 2.0 (initialize, tools/list, tools/call, resources/*, prompts/*)' } },
    ],
    connect: `${base}/connect`,
    approved_clients: APPROVED_CLIENTS,
  };
}

function connectionProfile() {
  return {
    object: 'connection_profile',
    name: 'abrahammoses',
    label: `${SITE_NAME} — Structured Theological Intelligence`,
    manifest: absoluteUrl('/api/public/mcp'),
    mcp_endpoint: absoluteUrl('/mcp'),
    transport: 'streamable-http',
    protocol_versions: [...SUPPORTED_PROTOCOL_VERSIONS],
    auth: 'none',
    access: 'public, read-only',
    approved_clients: APPROVED_CLIENTS,
    resources: {
      claims: absoluteUrl('/api/public/claims'),
      claim: absoluteUrl('/api/public/claims/{code}'),
      covenants: absoluteUrl('/api/public/covenants'),
      doctrine: absoluteUrl('/api/public/doctrine'),
      provenance: absoluteUrl('/api/public/provenance?claim={code}'),
    },
    client_config: { abrahammoses: { type: 'http', url: absoluteUrl('/mcp') } },
  };
}

function rejectionImpact(record: R, codes: string[]) {
  const rejectClaims = codes.filter((c) => /^AM-CLAIM-/i.test(c));
  const rejectAxioms = codes.filter((c) => /^AM-AX-/i.test(c));
  const unknown = codes.filter((c) => !/^AM-(CLAIM|AX)-/i.test(c));
  if (unknown.length) throw new ApiError('invalid_parameter', `Not a claim or axiom code: ${unknown.join(', ')}`);
  const sim = runSimulation(record, { reject_claims: rejectClaims.map((c) => c.toUpperCase()), reject_axioms: rejectAxioms.map((c) => c.toUpperCase()) });
  const effect = (s: string) => (s === 'broken' || s === 'rejected' ? 'collapses' : 'weakened');
  return {
    object: 'rejection_impact',
    rejected:
      codes.length === 1
        ? { kind: rejectClaims.length ? 'claim' : 'axiom', code: codes[0].toUpperCase() }
        : { kind: 'set', codes: codes.map((c) => c.toUpperCase()) },
    claims: sim.affected
      .filter((a) => a.status !== 'rejected')
      .map((a) => ({ code: a.code, depth: a.depth, effect: effect(a.status), via: a.via, status: a.status })),
    map_edges: sim.map_edges.map((e) => ({
      map_kind: e.map_kind,
      relationship_code: e.code,
      effect: e.status === 'ungrounded' ? 'collapses' : 'weakened',
      via: e.affected_links[0],
      grounded_by: e.grounded_by,
    })),
    counter_models_vindicated: sim.counter_models
      .filter((m) => m.status === 'aligned')
      .map((m) => ({ code: m.code, title: m.title, aligned_with: m.aligned_with })),
    counter_models_undermined: sim.counter_models
      .filter((m) => m.status === 'undermined')
      .map((m) => ({ code: m.code, title: m.title, undermined_by: m.undermined_by })),
    semantics: 'and-or/v2',
    record_version: sim.record_version,
    notice: SIMULATION_NOTICE,
  };
}

function formalGraph(record: R) {
  return {
    object: 'hermeneutical_graph',
    claims: record.data.claims.map((c) => ({ code: c.code, statement: record.current(c).statement, claim_role: c.role })),
    dependencies: flatDependencies(record),
    derivations: record.data.derivations.map((d) => ({ code: d.code, claim: d.claim, label: d.label, premises: d.premises.map((p) => p.claim), axioms: d.axioms })),
    axioms: record.data.axioms.map((a) => ({ code: a.code, tradition: a.heldBy, label: a.label, statement: a.statement, rationale: a.rationale })),
    claim_axioms: record.data.derivations.flatMap((d) => d.axioms.map((a) => ({ claim: d.claim, axiom: a.axiom, role: a.role, note: a.note, derivation: d.code }))),
    counter_models: record.data.counterModels.map((m) => ({
      code: m.code,
      title: m.title,
      held_by: m.heldBy,
      thesis: m.thesis,
      alternative_reading: m.alternativeReading,
      evidence: m.evidence.map((e) => e.display),
      strength: m.strength,
      claim: m.targets,
      rejects_axiom: m.rejects[0] ?? null,
      relies_on: m.reliesOn,
      rejects: m.rejects,
    })),
    map_links: record.data.mapLinks.map((l) => ({ map_kind: l.mapKind, relationship_code: l.code, link_role: l.role, note: l.note, claim: l.claim })),
    semantics: 'and-or/v2',
    record_version: record.version,
  };
}

export async function dispatchLegacy(request: Request, subpath: string): Promise<Response> {
  const path = subpath.replace(/^\/+|\/+$/g, '');

  // The manifest URL doubles as an MCP endpoint, so clients configured with it work.
  if (path === 'mcp' && request.method === 'POST') return handleMcpPost(request);

  return guarded(request, () => {
    const record = getRecord();
    const url = new URL(request.url);
    const q = url.searchParams;
    const ok = (body: unknown) => jsonResponse(request, body, { recordVersion: record.version });

    if (path === 'agent/act') {
      if (request.method !== 'POST') return errorResponse('method_not_allowed', 'Use POST.', undefined, { Allow: 'POST, OPTIONS' });
      if (!request.headers.get('x-am-agent') || !request.headers.get('x-am-key')) {
        return errorResponse('unauthorized', 'Missing x-am-agent or x-am-key header.');
      }
      return errorResponse('forbidden', 'No agent identities are registered on this deployment, so no action key is valid.');
    }

    if (request.method !== 'GET') {
      return errorResponse('method_not_allowed', `${request.method} is not supported here.`, undefined, { Allow: 'GET, OPTIONS' });
    }

    const claimMatch = path.match(/^claims\/([^/]+)$/);
    if (claimMatch) {
      const claim = record.claim(decodeURIComponent(claimMatch[1]));
      if (!claim) throw new ApiError('not_found', `No published claim has the code ${claimMatch[1]}.`);
      return ok({ object: 'claim', data: { ...legacyClaim(record, claim), provenance: legacySteps(record, claim) } });
    }

    switch (path) {
      case 'claims': {
        const limit = int(q.get('limit'), 50, 1, 200);
        const offset = int(q.get('offset'), 0, 0, 100_000);
        const topic = q.get('topic')?.toLowerCase();
        const type = q.get('claim_type')?.toLowerCase();
        const all = record.data.claims.filter(
          (c) =>
            (!topic || c.topic.toLowerCase() === topic) &&
            (!type || CLASSIFICATION_META[record.current(c).classification].label.toLowerCase() === type),
        );
        return ok({ object: 'claim_list', total: all.length, limit, offset, data: all.slice(offset, offset + limit).map((c) => legacyClaim(record, c)) });
      }
      case 'covenants': {
        const name = q.get('covenant')?.toLowerCase();
        const label = (id: string) => record.data.covenantNodes.find((n) => n.id === id)!.label;
        const data = record.data.covenants
          .filter((e) => !name || e.covenantName.toLowerCase() === name)
          .map((e) => ({
            code: e.code,
            covenant_name: e.covenantName,
            relationship_type: e.relationshipType,
            source_node: label(e.source),
            target_node: label(e.target),
            description: e.description,
            evidence: e.evidence.map((x) => x.display),
            confidence: e.confidence,
            updated_at: e.updatedAt,
            readings: e.readings,
            status: e.status,
          }));
        return ok({ object: 'covenant_list', total: data.length, data });
      }
      case 'doctrine': {
        const topic = q.get('topic')?.toLowerCase();
        const node = q.get('node')?.toLowerCase();
        const label = (id: string) => record.data.doctrineNodes.find((n) => n.id === id)!.label;
        const data = record.data.doctrine
          .filter((e) => !topic || e.topic.toLowerCase() === topic)
          .filter((e) => !node || label(e.source).toLowerCase() === node || label(e.target).toLowerCase() === node)
          .map((e) => ({
            code: e.code,
            source_node: label(e.source),
            target_node: label(e.target),
            relationship_type: e.relationshipType,
            description: e.description,
            evidence: e.evidence.map((x) => x.display),
            classification: e.classification,
            tradition_status: e.traditionStatus,
            confidence: e.confidence,
            topic: e.topic,
            updated_at: e.updatedAt,
            families: e.families,
            status: e.status,
          }));
        return ok({ object: 'doctrine_list', total: data.length, data });
      }
      case 'provenance': {
        const code = q.get('claim');
        if (!code) throw new ApiError('invalid_parameter', 'The claim parameter is required, e.g. ?claim=AM-CLAIM-000184.');
        const claim = record.claim(code);
        if (!claim) throw new ApiError('not_found', `No published claim has the code ${code}.`);
        return ok({
          object: 'provenance_chain',
          claim: { code: claim.code, statement: record.current(claim).statement },
          steps: legacySteps(record, claim),
        });
      }
      case 'dependencies': {
        const code = q.get('claim');
        const edges = flatDependencies(record);
        if (!code) return ok({ object: 'proof_graph', edges, semantics: 'and-or/v2' });
        const claim = record.claim(code);
        if (!claim) throw new ApiError('not_found', `No published claim has the code ${code}.`);
        return ok({
          object: 'claim_dependencies',
          claim: claim.code,
          rests_on: edges.filter((e) => e.claim === claim.code),
          supports: edges.filter((e) => e.depends_on === claim.code),
          blast_radius: downstreamOf(record.graph(), claim.code),
          semantics: 'and-or/v2',
        });
      }
      case 'hermeneutics': {
        const reject = q.get('reject');
        if (!reject) return ok(formalGraph(record));
        return ok(rejectionImpact(record, reject.split(',').map((s) => s.trim()).filter(Boolean)));
      }
      case 'connect':
        return ok(connectionProfile());
      case 'mcp':
        return ok(serviceManifest());
      case 'agents':
        return ok(
          q.has('audit')
            ? { object: 'agent_action_audit', access: 'public, read-only', actions: [] }
            : { object: 'identity_registry', access: 'public, read-only', agents: [] },
        );
      default:
        return errorResponse('not_found', `No endpoint at /api/public/${path}.`, { manifest: absoluteUrl('/api/public/mcp') });
    }
  });
}
