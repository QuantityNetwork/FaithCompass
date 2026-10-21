/**
 * Standards MAPPING for Decision Passports: which control or concept of a framework each passport mechanism relates
 * to. A mapping, not a certification: no audit, assessment, conformity assessment or approval has taken place, and
 * nothing here claims compliance with, or legal effect under, any of these instruments.
 */
export const MAPPING_NOTICE =
  'Mapping, not certification. This table relates passport mechanisms to concepts and controls of the frameworks named. No audit, assessment or certification against any of them has taken place, and no compliance, legal effect or regulatory approval is claimed.';

export interface MappingRow {
  framework: string;
  reference: string;
  concept: string;
  mechanism: string;
  gap: string;
}

export const MAPPING: MappingRow[] = [
  { framework: 'eIDAS (Reg. (EU) No 910/2014, as amended)', reference: 'Art. 3 definitions; Arts. 25–26, 35–36', concept: 'Electronic signature / seal; advanced signature requirements (linked to signatory, detects changes)', mechanism: 'Ed25519 signature over the passport hash, key id and issue time; any change breaks hash and signature', gap: 'Not a qualified signature or seal; no qualified certificate, no QSCD, no trust service provider; the operator is not supervised. Art. 25(1) only prevents denial of legal effect solely because a signature is electronic; no further effect is claimed.' },
  { framework: 'eIDAS', reference: 'Art. 3(33)–(34), Art. 41–42', concept: 'Electronic time stamp', mechanism: 'Issue time recorded in the signed message and in the registry', gap: 'Not a qualified time stamp; the time is the operator’s server clock.' },
  { framework: 'eIDAS', reference: 'Art. 3 (validation), Arts. 32–33', concept: 'Validation of signatures', mechanism: 'Two independent verifiers (TypeScript, Go) with pinned keys and published conformance fixtures', gap: 'Not a qualified validation service.' },
  { framework: 'ISO/IEC 27001:2022 Annex A', reference: 'A.8.24 Use of cryptography', concept: 'Rules for the effective use of cryptography, including key management', mechanism: 'Ed25519 signing; key ids derived from public keys; Policy §7 key management (rotation, retirement, compromise)', gap: 'Key held as a deployment environment secret, not in an HSM.' },
  { framework: 'ISO/IEC 27001:2022 Annex A', reference: 'A.8.15 Logging; A.5.28 Collection of evidence', concept: 'Logs that record activities; preserving evidence', mechanism: 'Append-only workspace audit (rules forbid update/delete), written atomically with each step; audit included in the signed passport', gap: 'Logs live in the same database project as the data; no external log sealing.' },
  { framework: 'ISO/IEC 27001:2022 Annex A', reference: 'A.5.3 Segregation of duties; A.5.15 Access control; A.8.3 Information access restriction', concept: 'Conflicting duties separated; access by role', mechanism: 'Two-person rule (proposer ≠ reviewer, reviewer must be an editor), enforced by server and database rules; tenant isolation', gap: 'Roles are assigned by the project owner; no periodic access review process is documented yet.' },
  { framework: 'ISO/IEC 27001:2022 Annex A', reference: 'A.5.24–A.5.27 Incident management', concept: 'Planning, assessing, responding to and learning from incidents', mechanism: 'Policy §8 incident process; revocation with reason key-compromise', gap: 'Not exercised; no incident has occurred.' },
  { framework: 'ISO/IEC 27001:2022 Annex A', reference: 'A.8.32 Change management; A.8.25 Secure development', concept: 'Controlled changes to systems', mechanism: 'Frozen, hash-pinned engines; CI runs both verifiers and the rules emulator on every change', gap: '—' },
  { framework: 'EU AI Act (Reg. (EU) 2024/1689)', reference: 'Art. 12 Record-keeping', concept: 'Automatic logging of events over a system’s lifetime (obligation for high-risk systems)', mechanism: 'Every passport records engine version, AI provider, model and prompt version, and the audit trail of the review', gap: 'Deep Analysis is not assessed as a high-risk system; the mapping shows a comparable practice, not that Art. 12 applies or is met.' },
  { framework: 'EU AI Act', reference: 'Art. 13 Transparency and provision of information to deployers', concept: 'Information on capabilities, limitations and output interpretation', mechanism: 'Each finding labelled deterministic or AI; attests / does-not-attest and limits written into each passport', gap: 'As for Art. 12.' },
  { framework: 'EU AI Act', reference: 'Art. 14 Human oversight', concept: 'Natural persons can oversee, interpret and override output', mechanism: 'No passport without a human proposer and a different human reviewer; reviewer note recorded', gap: 'As for Art. 12.' },
  { framework: 'EU AI Act', reference: 'Art. 50 Transparency obligations', concept: 'Disclosure that content is AI-generated', mechanism: 'AI-layer findings marked as such in the report and the passport, with the model named', gap: 'Mapping only; no assessment of which Art. 50 obligations apply.' },
  { framework: 'SOC 2 (AICPA Trust Services Criteria 2017, rev. 2022)', reference: 'CC6.1–CC6.3', concept: 'Logical access: restricted, role-based, authorised', mechanism: 'Signed-in, verified accounts; workspace roles; database rules deny by default', gap: 'No SOC 2 examination has been performed.' },
  { framework: 'SOC 2', reference: 'CC7.2–CC7.4', concept: 'Monitoring, evaluating and responding to security events', mechanism: 'Structured security events for every write; incident process; revocation', gap: 'As above.' },
  { framework: 'SOC 2', reference: 'CC8.1', concept: 'Change management', mechanism: 'Frozen engines, pinned hashes, CI gates', gap: 'As above.' },
  { framework: 'SOC 2', reference: 'PI1.1–PI1.5 Processing integrity', concept: 'Complete, valid, accurate, timely and authorised processing', mechanism: 'Re-verification of the report seal and every span at drafting; deterministic rebuild of the passport from the stored record; hash and signature checks', gap: 'As above.' },
];

export const MAPPING_BEGIN = '<!-- passport-mapping:begin (generated from src/lib/passport/standards.ts) -->';
export const MAPPING_END = '<!-- passport-mapping:end -->';

const cell = (s: string) => s.replace(/\|/g, '\\|');

export function mappingMarkdown(): string {
  return [
    MAPPING_BEGIN,
    '## Decision Passport: framework mapping (mapping, not certification)',
    '',
    `> ${MAPPING_NOTICE}`,
    '',
    '| Framework | Reference | Concept | Passport mechanism | Gap / limit |',
    '|---|---|---|---|---|',
    ...MAPPING.map((m) => `| ${cell(m.framework)} | ${cell(m.reference)} | ${cell(m.concept)} | ${cell(m.mechanism)} | ${cell(m.gap)} |`),
    MAPPING_END,
  ].join('\n');
}
