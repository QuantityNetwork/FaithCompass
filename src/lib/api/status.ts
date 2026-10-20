/**
 * Service status: live self-tests rather than a static "all systems normal".
 *
 * Each check exercises the real code path in-process — the REST dispatcher,
 * the MCP JSON-RPC handler, the legacy endpoints, the integrity checks and the
 * revision lock — and reports what it found. Editorial work still outstanding
 * is reported too, because a reader deciding how far to trust the record
 * should be able to see it.
 */

import { z } from 'zod/v4';
import { checkRecord } from '@/lib/record/integrity';
import { RAW_RECORD, getRecord, revisionHash } from '@/lib/record/record';
import lock from '@/lib/record/revisions.lock.json';
import { handleMessage, SUPPORTED_PROTOCOL_VERSIONS } from '@/lib/mcp/server';
import { API_VERSION, canonicalOrigin, canonicalOriginSource, legacyOrigins, legalContact } from '@/lib/site/config';
import { providerStatus } from '@/lib/evidence/providers/registry';
import { dispatchLegacy } from './legacy';

export const StatusV1 = z.object({
  object: z.literal('status'),
  status: z.enum(['ok', 'degraded']),
  generated_at: z.string(),
  record_version: z.string(),
  api_version: z.string(),
  mcp_protocol_versions: z.array(z.string()),
  canonical_origin: z.string(),
  canonical_origin_source: z.string(),
  request_origin: z.string(),
  checks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      result: z.enum(['pass', 'warn', 'fail']),
      detail: z.string(),
      duration_ms: z.number(),
    }),
  ),
  record: z.object({
    claims: z.number().int(),
    revisions: z.number().int(),
    published_revisions: z.number().int(),
    provisional_revisions: z.number().int(),
    cases: z.number().int(),
    axioms: z.number().int(),
    works: z.number().int(),
  }),
  outstanding_editorial_work: z.record(z.string(), z.number().int()),
});

type Check = z.infer<typeof StatusV1>['checks'][number];

async function timed(id: string, label: string, run: () => Promise<Omit<Check, 'id' | 'label' | 'duration_ms'>> | Omit<Check, 'id' | 'label' | 'duration_ms'>): Promise<Check> {
  const start = performance.now();
  try {
    const r = await run();
    return { id, label, ...r, duration_ms: Math.round((performance.now() - start) * 10) / 10 };
  } catch (err) {
    return {
      id,
      label,
      result: 'fail',
      detail: err instanceof Error ? err.message : String(err),
      duration_ms: Math.round((performance.now() - start) * 10) / 10,
    };
  }
}

export async function statusReport(
  request: Request,
  probeRest: (path: string) => Promise<{ status: number; body: unknown }>,
): Promise<z.infer<typeof StatusV1>> {
  const record = getRecord();
  const findings = checkRecord(record.data, record.graph());
  const requestOrigin = new URL(request.url).origin;
  const forwardedHost = request.headers.get('x-forwarded-host');
  const servedFrom = forwardedHost ? `${request.headers.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}` : requestOrigin;

  const checks: Check[] = await Promise.all([
    timed('record_integrity', 'Record integrity', () => {
      const errors = findings.filter((f) => f.level === 'error');
      return errors.length === 0
        ? { result: 'pass', detail: `${record.data.claims.length} claims, ${record.data.derivations.length} derivations, every claim established at baseline.` }
        : { result: 'fail', detail: `${errors.length} integrity error(s): ${errors.slice(0, 3).map((e) => `${e.subject}: ${e.message}`).join(' · ')}` };
    }),
    timed('revision_lock', 'Public revisions match the lock', () => {
      const pinned = lock as Record<string, string>;
      const bad: string[] = [];
      let count = 0;
      for (const c of RAW_RECORD.claims) {
        for (const r of c.revisions) {
          if (r.status === 'draft') continue;
          count += 1;
          if (pinned[`${c.code}@${r.rev}`] !== revisionHash(c.code, r)) bad.push(`${c.code}@${r.rev}`);
        }
      }
      return bad.length === 0
        ? { result: 'pass', detail: `All ${count} public revisions match their pinned content hashes.` }
        : { result: 'fail', detail: `Changed or unpinned: ${bad.join(', ')}` };
    }),
    timed('rest_api', 'REST API self-test', async () => {
      const r = await probeRest('/claims/AM-CLAIM-000184');
      const ok = r.status === 200 && (r.body as { code?: string })?.code === 'AM-CLAIM-000184';
      return ok
        ? { result: 'pass', detail: 'GET /api/v1/claims/AM-CLAIM-000184 returned the claim.' }
        : { result: 'fail', detail: `GET /api/v1/claims/AM-CLAIM-000184 returned HTTP ${r.status}.` };
    }),
    timed('mcp_server', 'MCP server self-test', () => {
      const init = handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'status', version: '1' } } }) as {
        result?: { protocolVersion: string };
      };
      const tools = handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) as { result?: { tools: unknown[] } };
      const call = handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_claim', arguments: { code: 'AM-CLAIM-000184' } } }) as {
        result?: { isError: boolean };
      };
      const ok = init.result?.protocolVersion === '2025-06-18' && (tools.result?.tools.length ?? 0) > 0 && call.result?.isError === false;
      return ok
        ? { result: 'pass', detail: `initialize, tools/list (${tools.result!.tools.length} tools) and tools/call get_claim succeeded.` }
        : { result: 'fail', detail: 'The JSON-RPC exchange did not complete as expected.' };
    }),
    timed('legacy_api', 'Legacy /api/public endpoints', async () => {
      const req = new Request(`${canonicalOrigin()}/api/public/claims?limit=1`, { headers: { 'x-forwarded-for': 'status-self-test' } });
      const res = await dispatchLegacy(req, 'claims');
      const body = (await res.json()) as { object?: string };
      return res.status === 200 && body.object === 'claim_list'
        ? { result: 'pass', detail: 'GET /api/public/claims returns the published shape.' }
        : { result: 'fail', detail: `GET /api/public/claims returned HTTP ${res.status}.` };
    }),
    timed('canonical_origin', 'Canonical origin', () => {
      const origin = canonicalOrigin();
      const source = canonicalOriginSource();
      if (source === 'fallback') {
        return { result: 'warn', detail: `ABRAHAMMOSES_PUBLIC_ORIGIN is not set; documentation falls back to ${origin}.` };
      }
      if (servedFrom !== origin && legacyOrigins().includes(servedFrom)) {
        return { result: 'pass', detail: `Documented origin is ${origin}; this request arrived at ${servedFrom}, a previous host that is kept serving.` };
      }
      if (servedFrom !== origin) {
        return { result: 'warn', detail: `Documented origin is ${origin}, but this request arrived at ${servedFrom}.` };
      }
      return { result: 'pass', detail: `Documentation, API and MCP all name ${origin}, which is serving this request.` };
    }),
    timed('ai_provider', 'Evidence reasoning provider', () => {
      const p = providerStatus();
      if (p.degraded) return { result: 'warn', detail: `${p.reason} Active provider: ${p.active}.` };
      return p.active === 'corpus'
        ? { result: 'pass', detail: 'Curated, offline provider (configured). No text is sent to an AI service; only curated analyses are available.' }
        : { result: 'pass', detail: `Provider ${p.active} is configured and has credentials (models: ${p.models?.fast}, ${p.models?.deep}). Reachability is not probed here.` };
    }),
    timed('legal_contact', 'Privacy contact published', () => {
      const contact = legalContact();
      return contact.privacy
        ? { result: 'pass', detail: 'A privacy contact is published in the Privacy Policy.' }
        : { result: 'warn', detail: 'ABRAHAMMOSES_PRIVACY_CONTACT is not set; the Privacy Policy cannot name a contact address.' };
    }),
  ]);

  const outstanding: Record<string, number> = {};
  for (const f of findings.filter((x) => x.level === 'warning')) outstanding[f.code] = (outstanding[f.code] ?? 0) + 1;
  const revisions = record.data.claims.flatMap((c) => c.revisions);

  return {
    object: 'status',
    status: checks.some((c) => c.result === 'fail') ? 'degraded' : 'ok',
    generated_at: new Date().toISOString(),
    record_version: record.version,
    api_version: API_VERSION,
    mcp_protocol_versions: [...SUPPORTED_PROTOCOL_VERSIONS],
    canonical_origin: canonicalOrigin(),
    canonical_origin_source: canonicalOriginSource(),
    request_origin: servedFrom,
    checks,
    record: {
      claims: record.data.claims.length,
      revisions: revisions.length,
      published_revisions: revisions.filter((r) => r.status === 'published' || r.status === 'externally_reviewed').length,
      provisional_revisions: revisions.filter((r) => r.status === 'provisional').length,
      cases: record.data.cases.length,
      axioms: record.data.axioms.length,
      works: record.data.works.length,
    },
    outstanding_editorial_work: outstanding,
  };
}
