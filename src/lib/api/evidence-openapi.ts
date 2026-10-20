/**
 * OpenAPI description of the Evidence Intelligence endpoints (/api/evidence/*).
 *
 * These sit outside REST v1: they serve the site's Evidence pages and are not
 * versioned with v1. They are documented here so the published contract matches
 * what the server does, in particular that no submission changes a published
 * assessment. Request bodies mirror src/lib/evidence/write-api.ts (tested in
 * tests/developer-docs.test.ts).
 */

export interface EvidenceEndpoint {
  method: 'GET' | 'POST';
  path: string;
  operationId: string;
  summary: string;
  /** One line for the Developers page. */
  behaviour: string;
  statuses: number[];
}

export const EVIDENCE_ENDPOINTS: EvidenceEndpoint[] = [
  {
    method: 'GET',
    path: '/api/evidence/analyses',
    operationId: 'evidence.analyses.list',
    summary: 'List published evidence assessments',
    behaviour: 'Public read. Every assessment carries its review state.',
    statuses: [200],
  },
  {
    method: 'POST',
    path: '/api/evidence/ask',
    operationId: 'evidence.ask',
    summary: 'Find the assessment for a question',
    behaviour:
      'Read-only lookup used by the Ask box: answers with a link to an existing assessment, a guardrail redirect, or none. Nothing is generated or stored.',
    statuses: [200, 400],
  },
  {
    method: 'POST',
    path: '/api/evidence/analyze',
    operationId: 'evidence.analyze',
    summary: 'Request a provisional analysis',
    behaviour:
      'Saved as a private, unpublished draft (202). Without a database the request is refused with 503 and nothing is kept.',
    statuses: [202, 200, 400, 403, 404, 413, 415, 429, 502, 503],
  },
  {
    method: 'POST',
    path: '/api/evidence/claims/{id}/challenge',
    operationId: 'evidence.challenge',
    summary: 'Challenge an assessment',
    behaviour:
      'Recorded as a proposal for editorial review (202, publishedChanged: false). The published assessment is unchanged. Without a database: 503.',
    statuses: [202, 200, 400, 403, 404, 409, 413, 415, 429, 502, 503],
  },
  {
    method: 'POST',
    path: '/api/evidence/proposals/{id}/decision',
    operationId: 'evidence.proposal.decide',
    summary: 'Approve or reject a proposal (editors only)',
    behaviour:
      'Requires a signed-in research editor or editorial administrator who did not write the proposal. When no identity provider is configured, every caller is anonymous and gets 401.',
    statuses: [200, 400, 401, 403, 404, 409, 413, 415, 429, 503],
  },
];

const STATUS_TEXT: Record<number, string> = {
  200: 'Success (for a challenge: an Idempotency-Key replay of an earlier proposal)',
  202: 'Accepted as an unpublished draft or proposal; nothing published changed',
  400: 'Invalid body (bodies are strict: unknown fields such as "role" are rejected)',
  401: 'Not signed in (no identity provider is configured on this deployment)',
  403: 'Cross-origin request, or role not permitted, or deciding one\u2019s own proposal',
  404: 'No such claim or proposal',
  409: 'Conflict: the assessment changed since the proposal, or it was already decided',
  413: 'Body too large',
  415: 'Body must be application/json',
  429: 'Rate limit or daily quota reached',
  502: 'The reasoning provider returned output that failed validation',
  503: 'No database on this deployment: nothing can be saved, and nothing was',
};

const errorRef = { $ref: '#/components/schemas/EvidenceError' };

const BODIES: Record<string, unknown> = {
  'evidence.ask': {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string', minLength: 1, maxLength: 2000 },
      lenses: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 40 } },
    },
  },
  'evidence.analyze': {
    type: 'object',
    additionalProperties: false,
    required: ['query'],
    properties: {
      query: { type: 'string', minLength: 1, maxLength: 2000 },
      reference: {
        description: 'A passage reference, as returned by the assessments.',
        type: ['object', 'null'],
      },
      passageText: { type: ['string', 'null'], maxLength: 20000 },
      lens: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primarySourcesOnly: { type: 'boolean' },
          beforeYear: { type: 'integer' },
          historicalOnly: { type: 'boolean' },
          scriptureOnly: { type: 'boolean' },
          note: { type: 'string', maxLength: 300 },
        },
      },
    },
  },
  'evidence.challenge': {
    type: 'object',
    additionalProperties: false,
    properties: { note: { type: 'string', maxLength: 2000 } },
  },
  'evidence.proposal.decide': {
    type: 'object',
    additionalProperties: false,
    required: ['decision', 'reason'],
    properties: {
      decision: { type: 'string', enum: ['approve', 'reject'] },
      reason: { type: 'string', minLength: 10, maxLength: 2000 },
    },
  },
};

export function evidenceOpenApi(): {
  paths: Record<string, Record<string, unknown>>;
  schemas: Record<string, unknown>;
} {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of EVIDENCE_ENDPOINTS) {
    const pathParams = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const headerParams =
      e.operationId === 'evidence.challenge'
        ? [
            {
              name: 'Idempotency-Key',
              in: 'header',
              required: false,
              schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
            },
          ]
        : e.operationId === 'evidence.proposal.decide'
          ? [
              {
                name: 'Authorization',
                in: 'header',
                required: true,
                description: 'Bearer access token from the identity provider (not yet available).',
                schema: { type: 'string' },
              },
            ]
          : [];
    paths[e.path] ??= {};
    paths[e.path][e.method.toLowerCase()] = {
      operationId: e.operationId,
      tags: ['evidence'],
      summary: e.summary,
      description: e.behaviour,
      parameters: [...pathParams, ...headerParams],
      ...(BODIES[e.operationId]
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: BODIES[e.operationId] },
              },
            },
          }
        : {}),
      responses: Object.fromEntries(
        e.statuses.map((s) => [
          String(s),
          {
            description: STATUS_TEXT[s],
            content: {
              'application/json': {
                schema: s >= 400 ? errorRef : { type: 'object' },
              },
            },
          },
        ]),
      ),
    };
  }
  return {
    paths,
    schemas: {
      EvidenceError: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          persisted: { type: 'boolean' },
        },
      },
    },
  };
}
