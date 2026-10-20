/**
 * AbrahamMoses Decision Twin: product facts shown on the public site.
 *
 * Source: owner product brief (2026-10-20). Everything here is descriptive.
 * Status labels say what this site demonstrates today; nothing below claims a
 * deployed private workspace, a customer, a certification or a regulatory
 * approval.
 */
import { docValue } from './case';
import { CONTROLS, DEFAULT_ASSUMPTIONS, PREMISES, type Assumptions } from './engine';

export const PRODUCT = {
  name: 'AbrahamMoses Decision Twin',
  tagline: 'Evidence Today. Wisdom Tomorrow.',
  principle: 'Evidence informs. Humans decide. The system preserves the reasoning.',
  positioning: 'A structured intelligence system for decisions that must withstand scrutiny. It models a decision, not a person.',
  logo: { src: '/brand/decision-twin/decision-twin-logo-navy.svg', width: 2382, height: 1382 },
} as const;

/**
 * The seller of pilot reservations as shown on the site (owner instruction 2026-10-21): "Sagolik" only. Sagolik must
 * not be described as a company, AB, registered entity or VAT-registered. The seller is not VAT-registered, so no
 * VAT is added. The seller's legal name appears only on Stripe receipts, from the Stripe account settings.
 */
export const SELLER = {
  name: 'Sagolik',
  location: 'Halmstad, Sweden',
  /** Owner-confirmed public contact; ABRAHAMMOSES_CONTACT takes precedence when set. */
  contact: 'markus@sagolik.com',
} as const;
export const SELLER_LINE = `${SELLER.name}, ${SELLER.location}`;
export const VAT_NOTE = 'Prices exclude VAT; the seller is not VAT-registered';
/** The exact public seller text (owner-approved wording, 2026-10-21). */
export function sellerText(contact: string): string {
  return `Seller: ${SELLER_LINE}. Contact: ${contact}. ${VAT_NOTE}.`;
}

/** The configured contact (ABRAHAMMOSES_CONTACT), falling back to the seller's owner-confirmed address. */
export function sellerContact(configured: string | null | undefined): string {
  return configured || SELLER.contact;
}

/**
 * Stripe payment link for a pilot reservation (payment link plink_1USgj0G6rcRJryPyPwPo6y5w): Stripe's hosted
 * checkout, no keys and no server integration. The owner reactivates the link in Stripe together with the
 * production deploy (register item B10); until then Stripe shows the link's inactive message.
 * Card statements read 'SWECANDY* ABRAHAMMOSES' (the link's statement_descriptor_suffix; account prefix unchanged).
 */
export const PILOT_PAYMENT_LINK = 'https://buy.stripe.com/14AeVdabp5FnfMn8NMeEo0d';
/** Pilot reservations are on sale (owner decision 2026-10-21, register item B10). */
export const PILOT_CHECKOUT_ENABLED: boolean = true;
export const PRICING_LABEL = `${VAT_NOTE}. The pilot is a paid reservation that starts once private workspaces are available`;
export const PILOT_ENQUIRY_SUBJECT = 'Decision Twin pilot enquiry';
/** A contact link from the configured contact (email or URL); null when none is configured. Never invents one. */
export function contactHref(contact: string | null, subject?: string): string | null {
  if (!contact) return null;
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  if (contact.startsWith('mailto:')) return contact + query;
  if (/^https?:/.test(contact)) return contact;
  return contact.includes('@') ? `mailto:${contact}${query}` : null;
}

export const SALES_STATUS = 'In force for pilot reservations';
export const TERMS_REVIEW_NOTE = 'These terms have not been reviewed by a lawyer.';

export const STATUS_LINE = 'Public institutional demonstration ready — private client onboarding not authorized';

export const PLANS = [
  {
    id: 'pilot',
    name: 'Pilot',
    price: '€9,500',
    period: 'one-off reservation, 90-day pilot',
    includes: ['One private workspace', 'Up to 10 users', 'Onboarding'],
    action: 'pilot' as const,
    cta: 'Request a pilot',
    note: 'Reservation: the 90-day pilot starts only when private institutional workspaces exist; the start date is agreed with you in writing.',
  },
  {
    id: 'institutional',
    name: 'Institutional',
    price: '€2,900',
    period: 'per month, billed annually',
    includes: ['Unlimited Decision Twins', '25 users', 'Exports and API access'],
    action: 'contact' as const,
    cta: 'Talk to us',
    note: null,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'by agreement',
    includes: ['Choice of data region', 'Single sign-on (SSO)', 'Service-level agreement', 'Contract terms for banks, including DORA requirements'],
    action: 'contact' as const,
    cta: 'Talk to us',
    note: null,
  },
];

export type LayerStatus = 'DEMONSTRATED' | 'PARTIAL' | 'PLANNED';

export const LAYERS: { n: number; name: string; does: string; status: LayerStatus; now: string }[] = [
  {
    n: 1,
    name: 'Data ingestion',
    does: 'Authorized PDFs, contracts, financial statements, papers, APIs and datasets.',
    status: 'PLANNED',
    now: 'No upload or connector exists. The Decision Room uses 10 fixed synthetic documents written into the code.',
  },
  {
    n: 2,
    name: 'Evidence engine',
    does: 'Atomic claims, passages, citation checks and provenance.',
    status: 'PARTIAL',
    now: 'Operational for the public AbrahamMoses research record (claims, sources, revisions). In the Decision Room each synthetic document has a stable ID and SHA-256 hash.',
  },
  {
    n: 3,
    name: 'Decision Twin graph',
    does: 'Links the decision to claims, assumptions, calculations, counterarguments and alternatives.',
    status: 'DEMONSTRATED',
    now: 'Dependency graph for one synthetic case; changing an input recalculates only its dependents.',
  },
  {
    n: 4,
    name: 'Analysis and simulation',
    does: 'Deterministic calculations plus controlled AI: scenarios, challenges and contradictions.',
    status: 'PARTIAL',
    now: 'Deterministic calculations, scenarios, rule-based Adversarial Chamber and Contradiction Map are demonstrated. No AI is used in the Decision Room.',
  },
  {
    n: 5,
    name: 'Governance and approval',
    does: 'Routes to authorized humans, keeps version history, records approvals and objections.',
    status: 'PLANNED',
    now: 'No accounts, roles or approvals exist. The demonstration shows where human judgment is needed and never records an approval.',
  },
  {
    n: 6,
    name: 'Decision Passport',
    does: 'Reproducible record of sources, assumptions, calculations, review history and integrity metadata.',
    status: 'DEMONSTRATED',
    now: 'Stateless, synthetic passports with a SHA-256 hash and JSON, Markdown and print exports. Reviewer: none (simulated decision).',
  },
];

/** Admin defaults for a private workspace, from the product brief. Planned: no private workspace exists yet. */
export const DEFAULT_WORKSPACE_SETTINGS: { setting: string; value: string }[] = [
  { setting: 'Workspace visibility', value: 'Private' },
  { setting: 'Access control', value: 'Role-based, least privilege' },
  { setting: 'Tenant separation', value: 'Strict' },
  { setting: 'AI providers', value: 'Approved providers only' },
  { setting: 'Data region', value: 'Customer-selected supported region' },
  { setting: 'Source permissions', value: 'Per document and per user' },
  { setting: 'Automated decisions', value: 'Disabled' },
  { setting: 'Consequential actions', value: 'Human approval required' },
  { setting: 'High-risk decisions', value: 'Two-person review' },
  { setting: 'Audit log', value: 'Tamper-evident, on' },
  { setting: 'Retention', value: 'Customer-configurable' },
  { setting: 'Training on customer content', value: 'No, unless explicitly authorized' },
  { setting: 'Evidence monitoring', value: 'Opt-in, scoped to named sources' },
  { setting: 'Export', value: 'Role-restricted' },
  { setting: 'External integrations', value: 'Off until authorized' },
];

export const CONFIG_VERSION = 'dr-config-1.0.0';

const fmt = (v: number, unit: string) => (unit === '$M' ? `$${v}M` : `${v}${unit}`);

export type AssumptionState = 'FIXED' | 'ADJUSTABLE' | 'DISPUTED';

const FIXED: { label: string; source: string; value: number; unit: string }[] = [
  { label: 'Revenue FY2025', source: 'DOC-01', value: docValue('DOC-01', 'revenue_fy2025'), unit: '$M' },
  { label: 'Reported EBITDA margin FY2025', source: 'DOC-01', value: docValue('DOC-01', 'ebitda_margin_fy2025'), unit: '%' },
  { label: 'Cash at close', source: 'DOC-03', value: docValue('DOC-03', 'cash_at_close'), unit: '$M' },
  { label: 'Undrawn RCF', source: 'DOC-03', value: docValue('DOC-03', 'rcf_undrawn'), unit: '$M' },
  { label: 'Minimum interest cover', source: 'DOC-05', value: docValue('DOC-05', 'min_interest_cover'), unit: 'x' },
  { label: 'Customer concentration policy limit', source: 'DOC-04', value: docValue('DOC-04', 'concentration_policy'), unit: '%' },
  { label: 'Stress EBITDA decline', source: 'DOC-04', value: docValue('DOC-04', 'stress_ebitda_decline'), unit: '%' },
];

/**
 * The per-decision configuration. It is fixed for this case version except the
 * assumption values, which come from the snapshot, so it is saved into every
 * passport and covered by its hash.
 */
export function decisionConfiguration(a: Assumptions = DEFAULT_ASSUMPTIONS) {
  return {
    version: CONFIG_VERSION,
    objective: 'Decide whether the synthetic $120M facility can go to a (simulated) credit committee, and on which conditions.',
    evidence_standard:
      'Every figure used in a calculation must trace to a named source document. Unverified documents may inform the analysis but cannot by themselves satisfy a condition; the verification condition stays unmet until they are verified by a human.',
    assumptions: [
      ...FIXED.map((f) => ({ state: 'FIXED' as AssumptionState, label: f.label, value: fmt(f.value, f.unit), source: f.source, note: 'Taken from the source document; not adjustable in this case.' })),
      ...CONTROLS.map((c) => {
        const v = a[c.key];
        return { state: 'ADJUSTABLE' as AssumptionState, label: c.label, value: fmt(v, c.unit), source: c.source, note: v === c.default ? 'Source value.' : `Adjusted from the source value ${fmt(c.default, c.unit)}.` };
      }),
      ...PREMISES.map((p) => ({
        state: 'DISPUTED' as AssumptionState,
        label: `${p.id}: ${p.statement}`,
        value: a.rejected.includes(p.id) ? 'rejected' : 'accepted',
        source: p.sources.join(', '),
        note: `If rejected: ${p.ifRejected}`,
      })),
    ],
    approval_policy: {
      actions: ['propose', 'review', 'reject', 'approve'],
      rule: 'The system may only propose. Review, rejection and approval are human actions by authorized people. In this public demonstration no human action is recorded and nothing is approved.',
    },
    escalation_rules: [
      'A condition with missing evidence (EVIDENCE_MISSING) is escalated to a human before any recommendation.',
      'A confirmed contradiction between sources is escalated until a human resolves which source governs.',
      'An unresolved interpretation of a contract term is escalated to legal review.',
      'A different reporting basis is shown side by side and is not escalated as a conflict.',
    ],
    monitoring_triggers: [
      'A new or revised source document for this case (planned; no monitoring runs in the demonstration).',
      'Top customer renewal outcome in Q1 2027 (DOC-07).',
      'Collateral appraisal received (DOC-08).',
      'Covenant headroom below the configured threshold in a new compliance certificate.',
    ],
  };
}

export type DecisionConfiguration = ReturnType<typeof decisionConfiguration>;
