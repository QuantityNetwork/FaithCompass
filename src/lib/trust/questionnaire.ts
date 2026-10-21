/**
 * Short answers to the questions a bank's or insurer's vendor-risk questionnaire usually asks. Answers state what
 * is true today, including what is not in place. Grouped as such questionnaires usually are.
 */
import { FIRESTORE, HOSTING, TLS } from './facts';

export interface QA {
  id: string;
  q: string;
  a: string;
  /** Short status for the summary column. */
  short: string;
}

export const QUESTIONNAIRE: { group: string; items: QA[] }[] = [
  {
    group: 'Company and governance',
    items: [
      { id: 'vendor', q: 'Who is the vendor?', short: 'Sagolik, Halmstad, Sweden', a: 'AbrahamMoses is operated by Sagolik, Halmstad, Sweden, a sole operator. Sagolik is not a limited company and is not VAT-registered.' },
      { id: 'staff', q: 'How many people have access to customer data?', short: 'One operator', a: 'One: the operator. There are no employees or contractors with access. This is also a continuity risk, stated under Business continuity below.' },
      { id: 'certification', q: 'Do you hold ISO/IEC 27001, SOC 2 or similar?', short: 'No', a: 'No. AbrahamMoses holds no certification and no SOC 2 report. The Decision Passport standards page maps controls to ISO/IEC 27001, SOC 2, eIDAS concepts and the EU AI Act; it is a mapping, not a certification. The infrastructure providers (Google Cloud, Vercel, Stripe, OpenAI) hold their own certifications, which do not extend to AbrahamMoses.' },
      { id: 'policies', q: 'Do you have written security and privacy policies?', short: 'Partly', a: 'There is a published Privacy Policy, a Decision Passport Policy, this security description and a DPA template. There is no separate information-security policy document or ISMS.' },
    ],
  },
  {
    group: 'Data location and transfers',
    items: [
      { id: 'location', q: 'Where is customer data stored?', short: 'EU (database, servers); US (sign-in)', a: `Workspace data is stored in Cloud Firestore, location ${FIRESTORE.location} (${FIRESTORE.locationName}). Account records are held by Firebase Authentication, which runs only in the United States. The application’s server functions run in ${HOSTING.functionsRegionName}, Vercel region ${HOSTING.functionsRegion}, and process data in transit without storing it. The optional AI layer sends document text to OpenAI, which processes it in the United States.` },
      { id: 'transfers', q: 'Is data transferred outside the EEA?', short: 'Yes, under SCCs / DPF', a: 'Yes: to the United States, through Firebase Authentication (account records) and, only when the Deep Analysis AI layer is used, OpenAI. The server functions run in Stockholm; Vercel Inc. is a US company, and its processing is covered by its data processing addendum. Each transfer rests on the provider’s data processing terms with the EU standard contractual clauses or on the EU-U.S. Data Privacy Framework.' },
      { id: 'ai', q: 'Is customer data used to train AI models?', short: 'No', a: 'No. The AI layer is optional and per run. Requests go to OpenAI’s API with storage turned off; under OpenAI’s API terms, API data is not used for training and may be kept in abuse-monitoring logs for up to 30 days. AbrahamMoses trains no models.' },
    ],
  },
  {
    group: 'Security controls',
    items: [
      { id: 'encryption', q: 'Is data encrypted in transit and at rest?', short: 'Yes', a: `In transit: ${TLS} HSTS for two years. At rest: Cloud Firestore and Firebase Authentication encrypt data at rest by default (Google-managed keys). Customer-managed keys are not used.` },
      { id: 'access', q: 'How is access controlled?', short: 'Rules-enforced, deny-by-default', a: 'Users sign in with Google or a verified email address. Workspace membership and roles are assigned only by the operator. Every database write is checked by Firestore security rules (deny-by-default, tenant-isolated, two-person review for approvals). The servers hold no database administrator key. The operator’s administrative access is through Google and Vercel accounts.' },
      { id: 'mfa', q: 'Is multi-factor authentication enforced?', short: 'Not for end users', a: 'Not for end users of AbrahamMoses: sign-in is by Google account (which applies the user’s own Google security settings) or email and password with a verified address. Multi-factor sign-in for workspace members is not offered yet.' },
      { id: 'pentest', q: 'Has the service been penetration-tested?', short: 'No external test', a: 'No external penetration test has been carried out. Automated tests run on every change: security regression tests over HTTP, database-rule tests in the Firestore emulator, browser tests with accessibility checks, and a dependency audit for high-severity vulnerabilities. The customer may commission its own test by agreement.' },
      { id: 'vulns', q: 'How are vulnerabilities managed?', short: 'CI audit; no SLA', a: 'Dependencies are audited in CI (npm audit, high and above) and updated by the operator. There is no formal patch SLA or bug-bounty programme.' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'logging', q: 'What is logged, and for how long?', short: 'Security events; audit trail', a: 'Each write attempt produces a structured security event (time, outcome, role, a one-way hash of the IP address; never the text sent), kept in the hosting provider’s runtime logs for its log period. Workspace changes carry an append-only audit trail in the database, kept for the life of the workspace.' },
      { id: 'retention', q: 'How long is customer data retained?', short: 'Term + 30 days', a: 'For the term of the agreement. At the end, the data is returned on request and deleted within the period agreed in the DPA (template: 30 days). Deep Analysis outside a workspace stores neither the document nor the report.' },
      { id: 'backup', q: 'Are there backups and a recovery plan?', short: 'No backups; delete protection on', a: 'No backups. Scheduled database backups and point-in-time recovery are not enabled: Google requires a billing account on the project for backups, and the project has none today. Delete protection is enabled, so the database cannot be deleted without first turning it off. There is no tested recovery plan. Google replicates the database across European regions, which protects against hardware failure but is not a backup.' },
      { id: 'incident', q: 'How and when are incidents notified?', short: 'Without undue delay; 48 h', a: 'A personal data breach affecting a customer is notified to the customer without undue delay, and under the DPA template within 48 hours of the operator becoming aware, by email to the customer’s named contact. There is no 24/7 monitoring or on-call rota.' },
      { id: 'continuity', q: 'What happens if the operator is unavailable?', short: 'Single point of failure', a: 'AbrahamMoses has a single operator, so availability and support depend on one person. The service runs on managed infrastructure without servers to maintain, and customers can export their records and verify every issued passport offline without AbrahamMoses.' },
      { id: 'subprocessors', q: 'Which sub-processors do you use?', short: 'Vercel, Google Firebase, OpenAI, Stripe', a: 'Vercel (hosting), Google Firebase (sign-in and database), OpenAI (optional AI layer) and Stripe (payment). Purposes, data and locations are on the sub-processors page; changes are notified at least 30 days ahead under the DPA template.' },
    ],
  },
];
