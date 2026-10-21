/**
 * The Trust pack's facts, in one place. Every statement here was checked against the code, the configuration or the
 * provider's own records on the date below; tests/trust.test.ts pins the ones that the code itself can confirm
 * (security headers, the OpenAI `store: false` flag, the two-person rules), so a change in the code that makes a
 * statement untrue fails the build.
 *
 * Nothing here is a certification, an audit or an external test. Where a control does not exist yet, it is listed
 * as a gap, not described as planned-and-done.
 */

export const TRUST_VERSION = '1.0';
/** The day the facts below were last checked against the live configuration. */
export const TRUST_CHECKED = '21 October 2026';

/** Where things run (checked 2026-10-21: `vercel.json` regions and the Vercel deployment record, `firebase firestore:databases:get`, Firebase docs). */
export const HOSTING = {
  provider: 'Vercel Inc.',
  functionsRegion: 'arn1',
  functionsRegionName: 'Stockholm, Sweden (EU)',
  staticDelivery: 'Vercel’s global edge network',
  regionsDocs: 'https://vercel.com/docs/regions',
};

export const FIRESTORE = {
  project: 'abrahammoses-a0a26',
  database: '(default)',
  edition: 'Standard',
  location: 'eur3',
  locationName: 'multi-region Europe: Belgium (europe-west1) and the Netherlands (europe-west4), witness in Finland (europe-north1)',
  locationsDocs: 'https://firebase.google.com/docs/firestore/locations',
  encryptionDocs: 'https://cloud.google.com/firestore/docs/server-side-encryption',
  pointInTimeRecovery: false,
  /** A daily schedule was attempted on 2026-10-21; Google refused it because the project has no billing account (Spark plan). */
  scheduledBackups: false,
  /** Enabled 2026-10-21 (`firebase firestore:databases:update "(default)" --delete-protection ENABLED`). */
  deleteProtection: true,
};

export const FIREBASE_AUTH = {
  location: 'United States',
  note: 'Google states that Firebase Authentication runs only from US data centers.',
  docs: 'https://firebase.google.com/support/privacy',
};

/** Response headers on every page (next.config.mjs); tests/trust.test.ts checks each against the config. */
export const SECURITY_HEADERS: [string, string][] = [
  ['Strict-Transport-Security', 'max-age=63072000 (two years), this host only'],
  ['Content-Security-Policy', 'Scripts, styles, fonts and images from this origin only; connections only to this origin and Firebase’s Auth and Firestore endpoints; no plugins; no framing by other sites'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'Camera, microphone, geolocation, payment, USB and topics disabled'],
  ['Cross-Origin-Opener-Policy', 'same-origin (same-origin-allow-popups on the sign-in pages, for Google sign-in)'],
];

/** TLS as served (checked 2026-10-21 with `openssl s_client` against abrahammoses.com). */
export const TLS = 'TLS 1.2 and TLS 1.3 only (TLS 1.0 and 1.1 are refused); certificates issued and renewed by Vercel.';

export type GapStatus = 'not in place' | 'owner decision';

/** Controls a bank's vendor review will ask about that are not in place today. Stated plainly. */
export const GAPS: { control: string; status: GapStatus; note: string }[] = [
  { control: 'ISO/IEC 27001 certification', status: 'not in place', note: 'No certification is held. The Decision Passport standards page is a mapping, not a certification.' },
  { control: 'SOC 2 report', status: 'not in place', note: 'No SOC 2 Type I or Type II report exists.' },
  { control: 'External penetration test', status: 'not in place', note: 'No external penetration test has been carried out. Automated security regression tests run in CI on every change.' },
  { control: 'Point-in-time recovery and scheduled backups of Firestore', status: 'not in place', note: 'Neither is enabled. Scheduled backups require a billing account on the Google Cloud project, which it does not have today. Delete protection on the database is enabled.' },
  { control: 'Dedicated security and privacy contact', status: 'owner decision', note: 'Security and privacy questions go to the operator’s general contact address.' },
  { control: 'Business continuity', status: 'not in place', note: 'AbrahamMoses is run by a single operator; there is no second person on call.' },
];
