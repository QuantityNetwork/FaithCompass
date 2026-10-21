/**
 * Sub-processors: every third party that processes personal data or customer content for AbrahamMoses, as found in
 * the code and the production configuration (2026-10-21). tests/trust.test.ts fails if the code starts calling a
 * provider that is not on this list.
 */
import { FIREBASE_AUTH, FIRESTORE, HOSTING } from './facts';

export interface SubProcessor {
  id: string;
  name: string;
  entity: string;
  purpose: string;
  data: string;
  location: string;
  when: string;
  safeguard: string;
  links: { label: string; href: string }[];
  /** Hosts in the code that belong to this provider (checked by the test). */
  hosts: string[];
}

export const SUBPROCESSORS: SubProcessor[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    entity: 'Vercel Inc., United States',
    purpose: 'Hosting: serves every page and runs the server functions (API routes, Deep Analysis, passport issuing).',
    data: 'Every request: IP address, browser details, the address requested and the request body in transit (including document text sent to Deep Analysis). Runtime logs with security events (time, outcome, a one-way hash of the IP address; never request text).',
    location: `Server functions: ${HOSTING.functionsRegionName}, Vercel region ${HOSTING.functionsRegion}. Static pages: ${HOSTING.staticDelivery}.`,
    when: 'Always.',
    safeguard: 'Vercel Data Processing Addendum, with the EU standard contractual clauses.',
    links: [
      { label: 'Vercel DPA', href: 'https://vercel.com/legal/dpa' },
      { label: 'Vercel privacy policy', href: 'https://vercel.com/legal/privacy-policy' },
      { label: 'Vercel security', href: 'https://security.vercel.com' },
    ],
    hosts: ['vercel.live'],
  },
  {
    id: 'firebase',
    name: 'Google Firebase',
    entity: 'Google LLC (Firebase Authentication) and Google Cloud (Cloud Firestore)',
    purpose: 'Accounts and sign-in (Firebase Authentication), including verification and password-reset emails; the database for private workspaces, Decision Passport drafts and registry, audit events and Deep Analysis profiles (Cloud Firestore).',
    data: 'Accounts: email address, account ID, sign-in method, verification state and, for Google sign-in, name and picture. Database: workspace documents and their passages, decisions, passport drafts and issued-passport entries, audit events, and the optional organisation and role a user gives.',
    location: `Firebase Authentication: ${FIREBASE_AUTH.location}. Cloud Firestore: ${FIRESTORE.location}, ${FIRESTORE.locationName}.`,
    when: 'Accounts: when a user signs in. Database: workspaces, passports and profiles.',
    safeguard: 'Firebase Data Processing and Security Terms and the Google Cloud Data Processing Addendum, with the EU standard contractual clauses and the EU-U.S. Data Privacy Framework.',
    links: [
      { label: 'Firebase Data Processing and Security Terms', href: 'https://firebase.google.com/terms/data-processing-terms' },
      { label: 'Google Cloud Data Processing Addendum', href: 'https://cloud.google.com/terms/data-processing-addendum' },
      { label: 'Privacy and security in Firebase', href: 'https://firebase.google.com/support/privacy' },
    ],
    hosts: ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'securetoken.google.com', 'firestore.googleapis.com', 'www.googleapis.com', 'apis.google.com'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    entity: 'OpenAI Ireland Ltd. (the contracting party for customers in the EEA), processing with its US affiliates',
    purpose: 'The optional AI layer of Deep Analysis: produces AI findings, each of which must quote the document verbatim or is discarded.',
    data: 'The text of the submitted document (up to about 300,000 characters) and the analysis instructions. Requests are sent with storage turned off (store: false). Under OpenAI’s API terms, API data is not used to train models and may be kept in abuse-monitoring logs for up to 30 days.',
    location: 'United States.',
    when: 'Only when a signed-in user runs Deep Analysis with the AI layer switched on. Without it, the text does not leave AbrahamMoses.',
    safeguard: 'OpenAI Data Processing Addendum, with the EU standard contractual clauses.',
    links: [
      { label: 'OpenAI DPA', href: 'https://openai.com/policies/data-processing-addendum/' },
      { label: 'OpenAI: your data on the API platform', href: 'https://platform.openai.com/docs/guides/your-data' },
      { label: 'OpenAI sub-processor list', href: 'https://openai.com/policies/sub-processor-list/' },
    ],
    hosts: ['api.openai.com'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    entity: 'Stripe Payments Europe, Limited, Ireland',
    purpose: 'Payment of pilot reservations on Stripe’s own checkout page; invoices and receipts.',
    data: 'The buyer’s name, email address, billing address and payment details. Card details are entered on Stripe’s page and never reach AbrahamMoses. For fraud prevention and its legal duties Stripe acts as an independent controller.',
    location: 'European Union and United States (Stripe’s infrastructure).',
    when: 'Only when an organisation pays for a pilot reservation. Stripe receives no workspace content.',
    safeguard: 'Stripe Data Processing Agreement, with the EU standard contractual clauses and the EU-U.S. Data Privacy Framework.',
    links: [
      { label: 'Stripe DPA', href: 'https://stripe.com/legal/dpa' },
      { label: 'Stripe privacy policy', href: 'https://stripe.com/privacy' },
      { label: 'Stripe service providers', href: 'https://stripe.com/legal/service-providers' },
    ],
    hosts: ['buy.stripe.com'],
  },
];

/** Providers that appear in the code or the toolchain but do not process customer data today. */
export const NOT_SUBPROCESSORS: { name: string; why: string; hosts: string[] }[] = [
  { name: 'Anthropic', why: 'An optional provider for the Evidence Intelligence features exists in the code but is switched off in production (the curated offline provider is used). It would be added to this list, with notice, before it is switched on.', hosts: ['api.anthropic.com'] },
  { name: 'Supabase', why: 'A superseded database adapter remains in the code; it is not configured in production and holds no data.', hosts: [] },
  { name: 'GitHub', why: 'Hosts the source code and runs the CI tests. It receives no customer data.', hosts: ['github.com'] },
];

/** Hosts in the code that are not third-party processors (schema vocabularies, the site's own former hostnames). */
export const NON_PROCESSOR_HOSTS = ['schema.org', 'am.sagolik.com', 'abraham.sagolik.com'];
