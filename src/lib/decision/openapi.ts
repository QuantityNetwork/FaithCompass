/** OpenAPI paths for the read-only Decision Twin demonstration API (tag institutional-demo). */
import { DEMO_ENDPOINTS } from './api';
import { CONTROLS } from './engine';

export function demoOpenApi(): Record<string, Record<string, unknown>> {
  const control = new Map<string, (typeof CONTROLS)[number]>(CONTROLS.map((c) => [c.param, c]));
  const describe = (p: string) => {
    const c = control.get(p);
    if (c) return { description: `${c.label} (${c.unit}); default ${c.default}`, schema: { type: 'number', minimum: c.min, maximum: c.max } };
    if (p === 'v') return { description: 'Comma-separated document IDs treated as verified ("none" for none)', schema: { type: 'string' } };
    if (p === 'r') return { description: 'Comma-separated premise IDs to reject (P1, P2, P3)', schema: { type: 'string' } };
    if (p === 'id') return { description: 'Decision Passport ID (DP1-…)', schema: { type: 'string' } };
    return { description: 'SHA-256 hex digest from the passport', schema: { type: 'string', pattern: '^[0-9a-fA-F]{64}$' } };
  };
  return Object.fromEntries(
    DEMO_ENDPOINTS.map((e) => [
      e.path,
      {
        get: {
          operationId: e.operationId,
          tags: ['institutional-demo'],
          summary: e.summary,
          description: 'Synthetic demonstration data. Read-only and stateless.',
          parameters: e.params.map((p) => ({ name: p, in: 'query', required: e.path.endsWith('/verify'), ...describe(p) })),
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
            '400': { description: 'Unknown parameter or value out of range', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            ...(e.path.endsWith('/verify')
              ? { '404': { description: 'Not a valid passport ID for this case version', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } }
              : {}),
            '429': { description: 'Rate limited', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    ]),
  );
}
