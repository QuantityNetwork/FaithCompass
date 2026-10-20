/**
 * REST API v1 — the endpoint registry.
 *
 * One table defines every endpoint: method, path, parameters, response schema
 * and handler. The dispatcher, the OpenAPI document and the developer
 * documentation are all generated from it, so an endpoint cannot exist
 * without being documented, or be documented without existing.
 */

import { evidenceOpenApi } from './evidence-openapi';
import { demoOpenApi } from '@/lib/decision/openapi';
import { z } from 'zod/v4';
import { getRecord, type AbrahamMosesRecord } from '@/lib/record/record';
import { RecordSchema } from '@/lib/record/schema';
import { API_VERSION, SITE_DESCRIPTION, SITE_NAME, absoluteUrl, canonicalOrigin, legacyOrigins } from '@/lib/site/config';
import { ApiError, ERROR_CODES, errorResponse, guarded, jsonResponse, readJsonBody } from './http';
import {
  CaseSummaryV1,
  ChangelogEntryV1,
  ClaimFilters,
  CompareV1,
  CorpusV1,
  DependenciesV1,
  NodeFilters,
  RevisionV1,
  SearchParams,
  SimulationParams,
  changelog,
  compareTraditions,
  corpus,
  getCase,
  getCitation,
  getClaim,
  getDependencies,
  getProvenance,
  listCases,
  listClaims,
  listRevisions,
  matchesNode,
  runSimulation,
  searchRecord,
} from './operations';
import { StatusV1, statusReport } from './status';
import { MAX_PATHS, graphSummary, impactOf } from '@/lib/evidence-graph/api';
import {
  AxiomV1,
  CaseV1,
  CitationV1,
  ClaimSummaryV1,
  ClaimV1,
  CounterModelV1,
  CovenantV1,
  DoctrineV1,
  ErrorV1,
  ProvenanceV1,
  SearchV1,
  SimulationV1,
  TraditionV1,
  axiomView,
  counterModelView,
  covenantView,
  doctrineView,
  listOf,
  traditionView,
} from './views';

export interface Ctx {
  record: AbrahamMosesRecord;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  request: Request;
}

export interface Endpoint {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  description?: string;
  query?: z.ZodObject;
  body?: z.ZodObject;
  response: { name: string; schema: z.ZodType };
  /** An example request path, used in the documentation and in the smoke test. */
  example: string;
  cache?: 'public' | 'none';
  run(ctx: Ctx): unknown | Promise<unknown>;
}

const RevQuery = z.object({ rev: z.coerce.number().int().positive().optional().describe('Revision number; defaults to current') });
const LimitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function list<T>(ctx: Ctx, items: T[], limit = 200, offset = 0) {
  return {
    object: 'list' as const,
    data: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
    record_version: ctx.record.version,
  };
}

const SCHEMAS: Record<string, z.ZodType> = {
  Claim: ClaimV1,
  ClaimSummary: ClaimSummaryV1,
  ClaimRevision: RevisionV1,
  ProvenanceChain: ProvenanceV1,
  ClaimDependencies: DependenciesV1,
  Citation: CitationV1,
  Axiom: AxiomV1,
  CounterModel: CounterModelV1,
  CovenantRelationship: CovenantV1,
  DoctrineConnection: DoctrineV1,
  Tradition: TraditionV1,
  ResearchCase: CaseV1,
  ResearchCaseSummary: CaseSummaryV1,
  TraditionComparison: CompareV1,
  Simulation: SimulationV1,
  SearchResults: SearchV1,
  Corpus: CorpusV1,
  RecordChange: ChangelogEntryV1,
  Status: StatusV1,
  Record: RecordSchema,
  Error: ErrorV1,
};

export const SCHEMA_NAMES = Object.keys(SCHEMAS);

const DOCTRINE_LABEL = (record: AbrahamMosesRecord, id: string) => record.data.doctrineNodes.find((n) => n.id === id)!.label;
const COVENANT_LABEL = (record: AbrahamMosesRecord, id: string) => record.data.covenantNodes.find((n) => n.id === id)!.label;

export const ENDPOINTS_V1: Endpoint[] = [
  {
    name: 'index',
    method: 'GET',
    path: '/',
    summary: 'API index',
    description: 'Lists every endpoint with its method, path and documentation link.',
    response: { name: 'ApiIndex', schema: z.object({ object: z.literal('api_index') }).loose() },
    example: '/',
    run: (ctx) => ({
      object: 'api_index',
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      api_version: API_VERSION,
      record_version: ctx.record.version,
      base_url: absoluteUrl('/api/v1'),
      mcp_endpoint: absoluteUrl('/mcp'),
      openapi: absoluteUrl('/api/v1/openapi.json'),
      documentation: absoluteUrl('/developers'),
      endpoints: ENDPOINTS_V1.map((e) => ({ name: e.name, method: e.method, path: `/api/v1${e.path === '/' ? '' : e.path}`, summary: e.summary })),
    }),
  },
  {
    name: 'claims.list',
    method: 'GET',
    path: '/claims',
    summary: 'List claims',
    description: 'Published and provisional claims, filterable by topic, classification, role, case, tradition and status.',
    query: ClaimFilters,
    response: { name: 'ClaimList', schema: listOf(ClaimSummaryV1) },
    example: '/claims?topic=Priesthood&limit=5',
    run: (ctx) => {
      const r = listClaims(ctx.record, ClaimFilters.parse(ctx.query));
      return { object: 'list', ...r, record_version: ctx.record.version };
    },
  },
  {
    name: 'claims.get',
    method: 'GET',
    path: '/claims/{code}',
    summary: 'Get a claim',
    description: 'The full record for a claim: witnesses and editions, evidence, variants, confidence axes, acceptance, derivations, counter-models, revisions, editorial and machine-involvement disclosure, citation.',
    query: RevQuery,
    response: { name: 'Claim', schema: ClaimV1 },
    example: '/claims/AM-CLAIM-000184',
    run: (ctx) => getClaim(ctx.record, ctx.params.code, RevQuery.parse(ctx.query).rev),
  },
  {
    name: 'claims.revisions',
    method: 'GET',
    path: '/claims/{code}/revisions',
    summary: 'List a claim’s revisions',
    description: 'Every public revision, oldest first, with its content hash. Public revisions are immutable; the one status correction (2026-10-20) is listed on /changelog.',
    response: { name: 'ClaimRevisionList', schema: listOf(RevisionV1) },
    example: '/claims/AM-CLAIM-000191/revisions',
    run: (ctx) => list(ctx, listRevisions(ctx.record, ctx.params.code)),
  },
  {
    name: 'claims.provenance',
    method: 'GET',
    path: '/claims/{code}/provenance',
    summary: 'Get a provenance chain',
    query: RevQuery,
    response: { name: 'ProvenanceChain', schema: ProvenanceV1 },
    example: '/claims/AM-CLAIM-000191/provenance',
    run: (ctx) => getProvenance(ctx.record, ctx.params.code, RevQuery.parse(ctx.query).rev),
  },
  {
    name: 'claims.dependencies',
    method: 'GET',
    path: '/claims/{code}/dependencies',
    summary: 'Get what a claim rests on and supports',
    response: { name: 'ClaimDependencies', schema: DependenciesV1 },
    example: '/claims/AM-CLAIM-000191/dependencies',
    run: (ctx) => getDependencies(ctx.record, ctx.params.code),
  },
  {
    name: 'claims.citation',
    method: 'GET',
    path: '/claims/{code}/citation',
    summary: 'Cite a claim revision',
    description: 'Text, BibTeX and CSL-JSON citations pointing at an immutable revision.',
    query: RevQuery,
    response: { name: 'Citation', schema: CitationV1 },
    example: '/claims/AM-CLAIM-000184/citation?rev=1',
    run: (ctx) => getCitation(ctx.record, ctx.params.code, RevQuery.parse(ctx.query).rev),
  },
  {
    name: 'axioms.list',
    method: 'GET',
    path: '/axioms',
    summary: 'List reading principles (axioms)',
    response: { name: 'AxiomList', schema: listOf(AxiomV1) },
    example: '/axioms',
    run: (ctx) => list(ctx, ctx.record.data.axioms.map((a) => axiomView(ctx.record, a.code))),
  },
  {
    name: 'axioms.get',
    method: 'GET',
    path: '/axioms/{code}',
    summary: 'Get a reading principle',
    response: { name: 'Axiom', schema: AxiomV1 },
    example: '/axioms/AM-AX-002',
    run: (ctx) => {
      if (!ctx.record.axiom(ctx.params.code)) throw new ApiError('not_found', `No axiom ${ctx.params.code.toUpperCase()}.`);
      return axiomView(ctx.record, ctx.params.code);
    },
  },
  {
    name: 'counter_models.list',
    method: 'GET',
    path: '/counter-models',
    summary: 'List counter-models',
    query: z.object({ targets: z.string().optional().describe('Only counter-models contesting this claim') }),
    response: { name: 'CounterModelList', schema: listOf(CounterModelV1) },
    example: '/counter-models?targets=AM-CLAIM-000191',
    run: (ctx) => {
      const { targets } = z.object({ targets: z.string().optional() }).parse(ctx.query);
      return list(
        ctx,
        ctx.record.data.counterModels
          .filter((m) => !targets || m.targets === targets.toUpperCase())
          .map((m) => counterModelView(ctx.record, m.code)),
      );
    },
  },
  {
    name: 'counter_models.get',
    method: 'GET',
    path: '/counter-models/{code}',
    summary: 'Get a counter-model',
    response: { name: 'CounterModel', schema: CounterModelV1 },
    example: '/counter-models/AM-CM-001',
    run: (ctx) => {
      if (!ctx.record.counterModel(ctx.params.code)) throw new ApiError('not_found', `No counter-model ${ctx.params.code.toUpperCase()}.`);
      return counterModelView(ctx.record, ctx.params.code);
    },
  },
  {
    name: 'covenants.list',
    method: 'GET',
    path: '/covenants',
    summary: 'List Covenant Map relationships',
    query: NodeFilters,
    response: { name: 'CovenantList', schema: listOf(CovenantV1) },
    example: '/covenants?family=islamic',
    run: (ctx) => {
      const f = NodeFilters.parse(ctx.query);
      return list(
        ctx,
        ctx.record.data.covenants
          .filter((e) => !f.family || e.readings.includes(f.family))
          .filter(
            (e) =>
              !f.node ||
              matchesNode(e.source, COVENANT_LABEL(ctx.record, e.source), f.node) ||
              matchesNode(e.target, COVENANT_LABEL(ctx.record, e.target), f.node),
          )
          .map((e) => covenantView(ctx.record, e.code)),
      );
    },
  },
  {
    name: 'doctrine.list',
    method: 'GET',
    path: '/doctrine',
    summary: 'List Doctrine Graph connections',
    query: NodeFilters,
    response: { name: 'DoctrineList', schema: listOf(DoctrineV1) },
    example: '/doctrine?node=abraham',
    run: (ctx) => {
      const f = NodeFilters.parse(ctx.query);
      return list(
        ctx,
        ctx.record.data.doctrine
          .filter((e) => !f.family || e.families.includes(f.family))
          .filter((e) => !f.topic || e.topic.toLowerCase() === f.topic.toLowerCase())
          .filter(
            (e) =>
              !f.node ||
              matchesNode(e.source, DOCTRINE_LABEL(ctx.record, e.source), f.node) ||
              matchesNode(e.target, DOCTRINE_LABEL(ctx.record, e.target), f.node),
          )
          .map((e) => doctrineView(ctx.record, e.code)),
      );
    },
  },
  {
    name: 'traditions.list',
    method: 'GET',
    path: '/traditions',
    summary: 'List traditions',
    response: { name: 'TraditionList', schema: listOf(TraditionV1) },
    example: '/traditions',
    run: (ctx) => list(ctx, ctx.record.data.traditions.map((t) => traditionView(ctx.record, t.id))),
  },
  {
    name: 'traditions.get',
    method: 'GET',
    path: '/traditions/{id}',
    summary: 'Get a tradition and its stances',
    response: { name: 'Tradition', schema: TraditionV1 },
    example: '/traditions/rabbinic-judaism',
    run: (ctx) => {
      if (!ctx.record.tradition(ctx.params.id)) throw new ApiError('not_found', `No tradition “${ctx.params.id}”.`);
      return traditionView(ctx.record, ctx.params.id);
    },
  },
  {
    name: 'cases.list',
    method: 'GET',
    path: '/cases',
    summary: 'List research cases',
    response: { name: 'ResearchCaseList', schema: listOf(CaseSummaryV1) },
    example: '/cases',
    run: (ctx) => list(ctx, listCases(ctx.record)),
  },
  {
    name: 'cases.get',
    method: 'GET',
    path: '/cases/{slug}',
    summary: 'Get a research case',
    response: { name: 'ResearchCase', schema: CaseV1 },
    example: '/cases/torah-permanence',
    run: (ctx) => getCase(ctx.record, ctx.params.slug),
  },
  {
    name: 'cases.compare',
    method: 'GET',
    path: '/cases/{slug}/compare',
    summary: 'Compare traditions on a research case',
    description: 'Each tradition’s response, the axioms its lens removes, and which positions stand under it.',
    response: { name: 'TraditionComparison', schema: CompareV1 },
    example: '/cases/ibrahim-heirs-and-revelation/compare',
    run: (ctx) => compareTraditions(ctx.record, ctx.params.slug),
  },
  {
    name: 'simulate.get',
    method: 'GET',
    path: '/simulate',
    summary: 'Simulate a rejection',
    description:
      'Reject claims or axioms (comma-separated), or apply a tradition lens, and see what still holds. Cacheable form of POST /simulate. The record is never changed.',
    query: SimulationParams,
    response: { name: 'Simulation', schema: SimulationV1 },
    example: '/simulate?reject_axioms=AM-AX-002',
    run: (ctx) => runSimulation(ctx.record, SimulationParams.parse(ctx.query)),
  },
  {
    name: 'simulate.post',
    method: 'POST',
    path: '/simulate',
    summary: 'Simulate a rejection (JSON body)',
    body: SimulationParams,
    response: { name: 'Simulation', schema: SimulationV1 },
    example: '/simulate',
    cache: 'none',
    run: (ctx) => runSimulation(ctx.record, SimulationParams.parse(ctx.body)),
  },
  {
    name: 'search',
    method: 'GET',
    path: '/search',
    summary: 'Search the record',
    description: 'Retrieval over published records. No text is generated.',
    query: SearchParams,
    response: { name: 'SearchResults', schema: SearchV1 },
    example: '/search?q=Who%20are%20the%20heirs%20of%20Ibrahim',
    run: (ctx) => searchRecord(ctx.record, SearchParams.parse(ctx.query)),
  },
  {
    name: 'corpus',
    method: 'GET',
    path: '/corpus',
    summary: 'Corpus coverage',
    description: 'Every work the record cites, the edition used, and how often it is cited.',
    response: { name: 'Corpus', schema: CorpusV1 },
    example: '/corpus',
    run: (ctx) => corpus(ctx.record),
  },
  {
    name: 'changelog',
    method: 'GET',
    path: '/changelog',
    summary: 'Record update history',
    query: LimitQuery,
    response: { name: 'RecordChangeList', schema: listOf(ChangelogEntryV1) },
    example: '/changelog?limit=10',
    run: (ctx) => {
      const q = LimitQuery.parse(ctx.query);
      return list(ctx, changelog(ctx.record), q.limit, q.offset);
    },
  },
  {
    name: 'export',
    method: 'GET',
    path: '/export',
    summary: 'Export the full public record',
    description: 'The complete public record as one JSON document, validated by the Record schema.',
    response: { name: 'Record', schema: RecordSchema },
    example: '/export',
    run: (ctx) => ctx.record.data,
  },
  {
    name: 'schema.list',
    method: 'GET',
    path: '/schema',
    summary: 'List JSON Schemas',
    response: { name: 'SchemaIndex', schema: z.object({ object: z.literal('schema_index') }).loose() },
    example: '/schema',
    run: () => ({
      object: 'schema_index',
      schemas: SCHEMA_NAMES.map((name) => ({ name, url: absoluteUrl(`/api/v1/schema/${name}`) })),
    }),
  },
  {
    name: 'schema.get',
    method: 'GET',
    path: '/schema/{name}',
    summary: 'Get a JSON Schema (draft 2020-12)',
    response: { name: 'JsonSchema', schema: z.object({}).loose() },
    example: '/schema/Claim',
    run: (ctx) => jsonSchema(ctx.params.name),
  },
  {
    name: 'openapi',
    method: 'GET',
    path: '/openapi.json',
    summary: 'OpenAPI 3.1 document',
    response: { name: 'OpenApi', schema: z.object({ openapi: z.string() }).loose() },
    example: '/openapi.json',
    run: () => openApiDocument(),
  },
  {
    name: 'status',
    method: 'GET',
    path: '/status',
    summary: 'Service status and self-tests',
    description: 'Record integrity, the revision lock, and live self-tests of the REST API and MCP server.',
    response: { name: 'Status', schema: StatusV1 },
    example: '/status',
    cache: 'none',
    run: (ctx) => statusReport(ctx.request, probeRest),
  },
  {
    name: 'evidence_graph.get',
    method: 'GET',
    path: '/evidence-graph',
    summary: 'Decision evidence graph (SDEP)',
    description: 'The synthetic Decision Twin case as an SDEP 0.1 document, with its integrity report and the list of passages. Deterministic; no AI.',
    response: { name: 'EvidenceGraph', schema: z.object({ object: z.literal('evidence_graph') }).loose() },
    example: '/evidence-graph',
    run: () => graphSummary(),
  },
  {
    name: 'evidence_graph.impact',
    method: 'GET',
    path: '/evidence-graph/impact',
    summary: 'Every conclusion depending on a passage',
    description: 'Every conclusion and decision condition built, directly or transitively, on the given passage (or any node), with the dependency paths, shortest first, and the total number of paths.',
    query: z.object({
      passage: z.string().min(1).max(200).describe('Node id, e.g. span:DOC-03#total_debt (encode # as %23)'),
      paths: z.coerce.number().int().min(1).max(MAX_PATHS).default(5).describe('Paths returned per conclusion or condition'),
    }),
    response: { name: 'EvidenceImpact', schema: z.object({ object: z.literal('evidence_impact') }).loose() },
    example: '/evidence-graph/impact?passage=span%3ADOC-03%23total_debt',
    run: (ctx) => {
      const q = z.object({ passage: z.string().min(1).max(200), paths: z.coerce.number().int().min(1).max(MAX_PATHS).default(5) }).parse(ctx.query);
      return impactOf(q.passage, q.paths);
    },
  },
];

export function jsonSchema(name: string) {
  const schema = SCHEMAS[name];
  if (!schema) throw new ApiError('not_found', `No schema “${name}”.`, { known: SCHEMA_NAMES });
  return {
    $id: absoluteUrl(`/api/v1/schema/${name}`),
    ...(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' }) as Record<string, unknown>),
  };
}

/* ------------------------------------------------------------------ *
 * Dispatch
 * ------------------------------------------------------------------ */

function match(path: string, pattern: string): Record<string, string> | null {
  const a = path.split('/').filter(Boolean);
  const b = pattern.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < b.length; i++) {
    const seg = b[i];
    if (seg.startsWith('{') && seg.endsWith('}')) params[seg.slice(1, -1)] = decodeURIComponent(a[i]);
    else if (seg !== a[i]) return null;
  }
  return params;
}

function queryObject(url: URL): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    out[key] = all.length > 1 ? all.join(',') : all[0];
  }
  return out;
}

export async function dispatchV1(request: Request, subpath: string): Promise<Response> {
  return guarded(request, async () => {
    const path = `/${subpath.replace(/^\/+|\/+$/g, '')}`;
    const candidates = ENDPOINTS_V1.map((e) => ({ e, params: match(path, e.path) })).filter((x) => x.params !== null);
    if (candidates.length === 0) {
      return errorResponse('not_found', `No endpoint at /api/v1${path === '/' ? '' : path}.`, {
        index: absoluteUrl('/api/v1'),
      });
    }
    const hit = candidates.find((x) => x.e.method === request.method);
    if (!hit) {
      const allowed = [...new Set(candidates.map((x) => x.e.method)), 'OPTIONS'].join(', ');
      return errorResponse('method_not_allowed', `${request.method} is not supported here. Allowed: ${allowed}.`, undefined, { Allow: allowed });
    }
    const record = getRecord();
    const url = new URL(request.url);
    const body = hit.e.method === 'POST' ? ((await readJsonBody(request)) as Record<string, unknown>) : {};
    if (hit.e.method === 'POST' && (typeof body !== 'object' || body === null || Array.isArray(body))) {
      throw new ApiError('invalid_parameter', 'The request body must be a JSON object.');
    }
    try {
      const result = await hit.e.run({ record, params: hit.params!, query: queryObject(url), body, request });
      return jsonResponse(request, result, { recordVersion: record.version, cache: hit.e.cache });
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ApiError(
          'invalid_parameter',
          err.issues.map((i) => `${i.path.join('.') || 'request'}: ${i.message}`).join('; '),
          err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        );
      }
      throw err;
    }
  });
}

/** In-process REST probe used by the status self-test. */
async function probeRest(path: string): Promise<{ status: number; body: unknown }> {
  const request = new Request(`${canonicalOrigin()}/api/v1${path}`, { headers: { 'x-forwarded-for': 'status-self-test' } });
  const response = await dispatchV1(request, path);
  return { status: response.status, body: response.status === 200 ? await response.json() : null };
}

/* ------------------------------------------------------------------ *
 * OpenAPI
 * ------------------------------------------------------------------ */

function parameterSchemas(schema: z.ZodObject | undefined, location: 'query') {
  if (!schema) return [];
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, s]) => {
    const { description, ...rest } = s;
    return { name, in: location, required: json.required?.includes(name) ?? false, description, schema: rest };
  });
}

export function openApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  const components: Record<string, unknown> = {};
  for (const e of ENDPOINTS_V1) {
    const path = `/api/v1${e.path === '/' ? '' : e.path}`;
    const pathParams = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    components[e.response.name] ??= z.toJSONSchema(e.response.schema, { io: 'output', unrepresentable: 'any', target: 'draft-2020-12' });
    paths[path] ??= {};
    paths[path][e.method.toLowerCase()] = {
      operationId: e.name,
      summary: e.summary,
      description: e.description,
      parameters: [...pathParams, ...parameterSchemas(e.query, 'query')],
      ...(e.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: z.toJSONSchema(e.body, { io: 'input', unrepresentable: 'any' }) } },
            },
          }
        : {}),
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${e.response.name}` } } },
        },
        ...Object.fromEntries(
          (['invalid_parameter', 'not_found', 'rate_limited'] as const).map((code) => [
            String(ERROR_CODES[code].status),
            { description: ERROR_CODES[code].description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ]),
        ),
      },
    };
  }
  components.Error = z.toJSONSchema(ErrorV1);
  const evidence = evidenceOpenApi();
  Object.assign(paths, evidence.paths);
  Object.assign(components, evidence.schemas);
  Object.assign(paths, demoOpenApi());
  return {
    openapi: '3.1.0',
    info: {
      title: `${SITE_NAME} API`,
      version: API_VERSION,
      description: `${SITE_DESCRIPTION} The record API (/api/v1) is public and read-only: no key is required. The Evidence Intelligence endpoints (tag \`evidence\`) accept submissions only as unpublished drafts and proposals, never as changes to a published assessment, and answer 503 on a deployment without a database. Responses carry X-Record-Version; published revisions are immutable. Changes in 1.1 (2026-10-20, additive): simulation and comparison outcomes carry \`epistemic_status\` (supported, partially_supported, support_weakened, not_established, insufficient_evidence, disputed_interpretation) and display labels in that vocabulary, alongside the unchanged legacy \`status\` values; \`headline_confidence\` is deprecated and will be removed in v2; revision 1 of AM-CLAIM-000184 to 000191 now reports status \`provisional\` (no editorial verification was ever recorded for it).`,
    },
    servers: [
      { url: canonicalOrigin() },
      ...legacyOrigins().map((url) => ({ url, description: 'Previous host; still serves the same API.' })),
    ],
    tags: [
      { name: 'evidence', description: 'Evidence Intelligence endpoints, outside v1 versioning.' },
      { name: 'institutional-demo', description: 'Sagolik Institutional Decision Room demonstration: synthetic data, read-only, outside v1 versioning.' },
    ],
    paths,
    components: { schemas: components },
    externalDocs: { url: absoluteUrl('/developers'), description: 'Developer documentation' },
  };
}

