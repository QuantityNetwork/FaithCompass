/**
 * Decision Passports for the public, synthetic Decision Twin.
 *
 * Stateless: the passport ID encodes a canonical snapshot of the inputs and
 * the creation time, so the same ID always rebuilds the same passport with no
 * database. The SHA-256 integrity hash is over the canonical passport content;
 * it shows the passport has not changed since it was generated, not that its
 * content is correct.
 */
import { z } from 'zod';
import { canonicalJson, sha256 } from './canonical';
import { CASE, CASE_VERSION, RULESET_VERSION, sourceInventory } from './case';
import { chamber } from './chamber';
import { contradictionsView } from './contradictions';
import { AssumptionsSchema, DEFAULT_ASSUMPTIONS, PREMISES, evaluate, normalise, traceFromDefaults, type Assumptions } from './engine';

export const PASSPORT_PREFIX = 'DP1-';

const StateSchema = z
  .object({
    v: z.literal(1),
    case: z.literal(CASE.id),
    caseVersion: z.literal(CASE_VERSION),
    a: AssumptionsSchema,
    t: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
  })
  .strict();
export type PassportState = z.infer<typeof StateSchema>;

export class PassportIdError extends Error {}

export function encodePassportId(a: Assumptions, createdAt: Date): string {
  const t = createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const state: PassportState = { v: 1, case: CASE.id, caseVersion: CASE_VERSION, a: normalise(AssumptionsSchema.parse(a) as Assumptions), t };
  return PASSPORT_PREFIX + Buffer.from(canonicalJson(state), 'utf8').toString('base64url');
}

export function decodePassportId(id: string): PassportState {
  if (!id.startsWith(PASSPORT_PREFIX) || id.length > 2000) throw new PassportIdError('Not a Decision Passport ID.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(id.slice(PASSPORT_PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    throw new PassportIdError('The passport ID cannot be decoded.');
  }
  const r = StateSchema.safeParse(parsed);
  if (!r.success) throw new PassportIdError('The passport ID does not describe a valid snapshot of this case version.');
  // Only the canonical encoding is accepted, so one snapshot has exactly one ID.
  const normalised = { ...r.data, a: normalise(r.data.a as Assumptions) };
  const canonical = PASSPORT_PREFIX + Buffer.from(canonicalJson(normalised), 'utf8').toString('base64url');
  if (canonical !== id) throw new PassportIdError('The passport ID is not in canonical form.');
  return r.data;
}

export const REVIEWER_NONE = 'none (simulated decision)';

export function buildPassport(id: string) {
  const state = decodePassportId(id);
  const a = state.a as Assumptions;
  const ev = evaluate(a);
  const nodes = Object.values(ev);
  const trace = traceFromDefaults(a);
  const content = {
    id,
    title: `Decision Passport: ${CASE.title}`,
    label: CASE.label,
    generated_at: state.t,
    case: { id: CASE.id, version: CASE_VERSION, borrower: CASE.borrower, question: CASE.question, facility: CASE.facility },
    status: 'SIMULATED: demonstration only. No credit decision has been made.',
    reviewer: REVIEWER_NONE,
    versions: { ruleset: RULESET_VERSION, model: 'none (deterministic rules; no AI model)', passport_format: 'DP1' },
    sources: sourceInventory(),
    assumptions: { ...a, defaults: DEFAULT_ASSUMPTIONS },
    premises: PREMISES.map((p) => ({ id: p.id, statement: p.statement, sources: p.sources, accepted: !a.rejected.includes(p.id) })),
    calculations: nodes
      .filter((n) => n.kind === 'metric' || n.kind === 'effective')
      .map((n) => ({ id: n.id, label: n.label, value: n.value, display: n.display, formula: n.formula ?? null, inputs: n.deps })),
    scenarios: {
      base: { leverage: ev['m.leverage'].display, coverage: ev['m.coverage'].display },
      stress: { ebitda: ev['m.stressEbitda'].display, leverage: ev['m.stressLeverage'].display, coverage: ev['m.stressCoverage'].display },
    },
    conditions: nodes.filter((n) => n.kind === 'condition').map((n) => ({ id: n.id, label: n.label, status: n.status, note: n.note ?? null })),
    warnings: nodes.filter((n) => n.kind === 'warning' && n.status === 'ACTIVE').map((n) => ({ id: n.id, label: n.label, note: n.note ?? null })),
    conclusion: ev.conclusion.display,
    claims: chamber(ev, a).map((x) => ({ id: x.id, side: x.side, text: x.text, nodes: x.nodes, docs: x.docs })),
    conflicts: contradictionsView().map((c) => ({ id: c.id, class: c.class, conflict: c.conflict, title: c.title, a: c.a, b: c.b, human_action: c.humanAction })),
    open_questions: nodes
      .filter((n) => n.kind === 'condition' && (n.status === 'NEEDS_HUMAN_JUDGMENT' || n.status === 'EVIDENCE_MISSING'))
      .map((n) => `${n.label}: ${n.note}`),
    audit_history: [
      { at: state.t, event: 'passport_generated', detail: `From case ${CASE.id} v${CASE_VERSION} with ruleset ${RULESET_VERSION}.` },
      ...trace.changes.map((c) => ({ at: state.t, event: 'input_changed', detail: `${c.label}: ${c.from} → ${c.to}` })),
      ...(trace.changes.length ? [{ at: state.t, event: 'conclusions_affected', detail: trace.affected.join(', ') || 'none' }] : []),
    ],
    reproducibility:
      'Open this passport ID at /institutional/decision-room/passport/{id} or call GET /api/institutional/decision-room/passport/verify?id={id}&sha256={hash}. The ID encodes every input, so the same passport and hash are rebuilt with no stored state.',
    integrity_note: 'The SHA-256 hash shows this passport has not changed since it was generated. It does not show that the content is correct.',
  };
  return { ...content, integrity: { algorithm: 'SHA-256', canonicalisation: 'JSON, keys sorted, no whitespace, integrity field excluded', sha256: sha256(canonicalJson(content)) } };
}

export type Passport = ReturnType<typeof buildPassport>;

export function verifyPassport(id: string, hash: string): { valid: boolean; expected: string } {
  const p = buildPassport(id);
  return { valid: p.integrity.sha256 === hash.toLowerCase(), expected: p.integrity.sha256 };
}

export function passportMarkdown(p: Passport): string {
  const lines = [
    `# ${p.title}`,
    '',
    `> ${p.label}`,
    '',
    `- **Passport ID:** \`${p.id}\``,
    `- **Generated:** ${p.generated_at}`,
    `- **Case:** ${p.case.id} v${p.case.version} (${p.case.borrower})`,
    `- **Question:** ${p.case.question}`,
    `- **Status:** ${p.status}`,
    `- **Reviewer:** ${p.reviewer}`,
    `- **Ruleset:** ${p.versions.ruleset}; model: ${p.versions.model}`,
    `- **SHA-256:** \`${p.integrity.sha256}\``,
    `- ${p.integrity_note}`,
    '',
    '## Conclusion',
    '',
    p.conclusion,
    '',
    '## Conditions',
    '',
    '| Condition | Status | Note |',
    '|---|---|---|',
    ...p.conditions.map((c) => `| ${c.label} | ${c.status} | ${c.note ?? ''} |`),
    '',
    '## Calculations',
    '',
    '| Measure | Value | Formula |',
    '|---|---|---|',
    ...p.calculations.map((c) => `| ${c.label} | ${c.display} | ${c.formula ?? ''} |`),
    '',
    '## Premises',
    '',
    ...p.premises.map((x) => `- ${x.id} (${x.accepted ? 'accepted' : 'rejected'}): ${x.statement} [${x.sources.join(', ')}]`),
    '',
    '## Warnings',
    '',
    ...(p.warnings.length ? p.warnings.map((w) => `- ${w.label}: ${w.note}`) : ['- None active.']),
    '',
    '## Conflicts and evidence gaps',
    '',
    ...p.conflicts.map((c) => `- ${c.id} ${c.class}${c.conflict ? '' : ' (not a conflict)'}: ${c.title}. ${c.human_action}`),
    '',
    '## Open questions for human judgment',
    '',
    ...p.open_questions.map((q) => `- ${q}`),
    '',
    '## Sources',
    '',
    '| ID | Title | Date | Verification | SHA-256 |',
    '|---|---|---|---|---|',
    ...p.sources.map((s) => `| ${s.id} | ${s.title} | ${s.date} | ${s.verification} | \`${s.sha256.slice(0, 16)}…\` |`),
    '',
    '## Audit history',
    '',
    ...p.audit_history.map((h) => `- ${h.at} ${h.event}: ${h.detail}`),
    '',
    '## Reproducibility',
    '',
    p.reproducibility,
    '',
  ];
  return lines.join('\n');
}
