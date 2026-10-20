/**
 * Read-only public API for the synthetic Decision Twin. No writes, no state:
 * every response is computed from the request and the fixed synthetic case.
 */
import { ApiError, guarded, jsonResponse } from '@/lib/api/http';
import { CASE, CASE_VERSION, DOCUMENTS, RULESET_VERSION, documentHash } from './case';
import { CHAMBER_RULES, chamber } from './chamber';
import { CONTRADICTION_CLASSES, contradictionsView } from './contradictions';
import { CONTROLS, DEFAULT_ASSUMPTIONS, PREMISES, evaluate, parseAssumptions, traceFromDefaults } from './engine';
import { PassportIdError, verifyPassport } from './passport';

const LABEL = CASE.label;
const DEMO_PARAMS = new Set([...CONTROLS.map((c) => c.param), 'v', 'vset', 'r']);

export function caseHandler(request: Request): Promise<Response> {
  return guarded(request, () =>
    jsonResponse(request, {
      object: 'decision_case',
      label: LABEL,
      case: CASE,
      ruleset_version: RULESET_VERSION,
      documents: DOCUMENTS.map((d) => ({ ...d, sha256: documentHash(d) })),
      premises: PREMISES,
      controls: CONTROLS,
      defaults: DEFAULT_ASSUMPTIONS,
    }),
  );
}

/** Strict query parsing: an unknown parameter or out-of-range value is a 400, never silently replaced. */
function strictQuery(url: URL): Record<string, string | string[]> {
  const q: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    if (!DEMO_PARAMS.has(key)) throw new ApiError('invalid_parameter', `Unknown parameter "${key}".`, { allowed: [...DEMO_PARAMS] });
    const values = url.searchParams.getAll(key);
    q[key] = values.length === 1 ? values[0] : values;
  }
  for (const c of CONTROLS) {
    const raw = q[c.param];
    if (raw === undefined) continue;
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    if (!Number.isFinite(n) || n < c.min || n > c.max) {
      throw new ApiError('invalid_parameter', `${c.param} (${c.label}) must be a number from ${c.min} to ${c.max}.`);
    }
  }
  const ids = (k: string) => [q[k] ?? []].flat().flatMap((x) => x.split(',')).filter((x) => x && x !== 'none');
  const unknownDocs = ids('v').filter((x) => !DOCUMENTS.some((d) => d.id === x));
  if (unknownDocs.length) throw new ApiError('invalid_parameter', `Unknown document(s): ${unknownDocs.join(', ')}.`);
  const unknownPremises = ids('r').filter((x) => !PREMISES.some((p) => p.id === x));
  if (unknownPremises.length) throw new ApiError('invalid_parameter', `Unknown premise(s): ${unknownPremises.join(', ')}.`);
  return q;
}

export function scenarioHandler(request: Request): Promise<Response> {
  return guarded(request, () => {
    const a = parseAssumptions(strictQuery(new URL(request.url)));
    const ev = evaluate(a);
    return jsonResponse(request, {
      object: 'decision_scenario',
      label: LABEL,
      case: { id: CASE.id, version: CASE_VERSION },
      ruleset_version: RULESET_VERSION,
      assumptions: a,
      conclusion: ev.conclusion.display,
      nodes: Object.values(ev),
      trace: traceFromDefaults(a),
      chamber: { rules: CHAMBER_RULES, arguments: chamber(ev, a), note: 'Deterministic rules, not AI, and not a human review.' },
    });
  });
}

export function contradictionsHandler(request: Request): Promise<Response> {
  return guarded(request, () =>
    jsonResponse(request, {
      object: 'decision_contradictions',
      label: LABEL,
      classes: CONTRADICTION_CLASSES,
      note: 'Only CONFIRMED_CONFLICT and POTENTIAL_CONFLICT are conflicts. DIFFERENT_REPORTING_BASIS is not a contradiction.',
      contradictions: contradictionsView(),
    }),
  );
}

export function verifyHandler(request: Request): Promise<Response> {
  return guarded(request, () => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const hash = url.searchParams.get('sha256');
    if (!id) throw new ApiError('invalid_parameter', 'id is required.');
    if (!hash || !/^[0-9a-fA-F]{64}$/.test(hash)) throw new ApiError('invalid_parameter', 'sha256 must be a 64-character hex digest.');
    let result: { valid: boolean; expected: string };
    try {
      result = verifyPassport(id, hash);
    } catch (err) {
      if (err instanceof PassportIdError) throw new ApiError('not_found', err.message);
      throw err;
    }
    return jsonResponse(request, {
      object: 'passport_verification',
      id,
      sha256: hash.toLowerCase(),
      valid: result.valid,
      expected_sha256: result.expected,
      meaning: result.valid
        ? 'The passport rebuilt from this ID has this hash: it is unchanged since it was generated. This does not show its content is correct.'
        : 'The hash does not match the passport rebuilt from this ID: either the hash or the passport was altered.',
    });
  });
}

export const DEMO_ENDPOINTS = [
  { path: '/api/institutional/decision-room/case', operationId: 'demo.case', summary: 'The synthetic case: documents with hashes, premises, controls and defaults', params: [] as string[] },
  { path: '/api/institutional/decision-room/scenario', operationId: 'demo.scenario', summary: 'Evaluate the case on given inputs: every node, the audit trace and the Adversarial Chamber', params: [...CONTROLS.map((c) => c.param), 'v', 'r'] },
  { path: '/api/institutional/decision-room/contradictions', operationId: 'demo.contradictions', summary: 'The Contradiction Map with side-by-side fields', params: [] },
  { path: '/api/institutional/decision-room/passport/verify', operationId: 'demo.passport.verify', summary: 'Rebuild a passport from its ID and compare its SHA-256', params: ['id', 'sha256'] },
];
