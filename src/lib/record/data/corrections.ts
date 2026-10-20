/**
 * Recorded corrections to the status of public revisions.
 *
 * A public revision's content never changes; corrections append new revisions. This file records
 * the one exception so far, made openly: on 2026-10-20 the status of revision 1 of the eight claims
 * imported from the earlier Claim Ledger was corrected from "published" to "provisional", because
 * the ledger never recorded who verified them, or when. Statement, witnesses, wording and every
 * other field are unchanged. Because the status is part of each revision's content hash, the pinned
 * hash changed; both hashes are kept here, shown on /changelog, and checked by tests/record.test.ts and tests/trust-labels.test.ts.
 */

export interface StatusCorrection {
  code: string;
  rev: number;
  previousHash: string;
  hash: string;
}

export const STATUS_CORRECTION_2026_10_20 = {
  date: '2026-10-20',
  from: 'published',
  to: 'provisional',
  reason:
    'Imported from the earlier Claim Ledger, where these revisions were shown as published, but no reviewer, review date or verification was ever recorded for them. Without one, "published" (editor-verified) cannot be evidenced, so they are provisional: public and citable, awaiting editorial review. Only the status changed. Approved by the record owner.',
  revisions: [
  { code: 'AM-CLAIM-000184', rev: 1, previousHash: '6f93a7fc3a701a9ddcca2bb16e29521c317b6ad06a1f1c3534bc8859cfd775e6', hash: '15968067ae57936242c108e062030c44b4902ed5474582196bf986ed587830cb' },
  { code: 'AM-CLAIM-000185', rev: 1, previousHash: 'ce3f19f1c37b46a2e60e48693959f550e443f7371f9adc91d0a9de5df5b729cc', hash: '38847a8cb9f06864fa0e9a002611284b1452736cf90626c507bb163705f9bf2c' },
  { code: 'AM-CLAIM-000186', rev: 1, previousHash: '787d0aae73742df6a1ffd1a15a9932e93cbbd5f681410d9b962c571059d1f07f', hash: 'f870621c647f6d1a9941a738732b7361cadb963db96438cae04b18d267ee324f' },
  { code: 'AM-CLAIM-000187', rev: 1, previousHash: 'd4013123d8359346775138e76f6f6e14ce07855ecd01bd1e80831be16a2b81d3', hash: '5eee35bbb0cdb41dea26209de933cb41afe592d4054dfb078b6e0c7a79b6a454' },
  { code: 'AM-CLAIM-000188', rev: 1, previousHash: '97e845d6771327e213b5d84c77b05e980c83211bdfd7a2175fc078c1bbeccd6f', hash: '30668776e1362e04c1c6254e0b64d43fd78548cca4df8b4ac46e5aafba106f24' },
  { code: 'AM-CLAIM-000189', rev: 1, previousHash: '79522e20cc2b2084acd96bd3a42fb28055a042076ef4d37cab4af23f41f32451', hash: '24f16302d32cb8aa5cfadf79c66750cfb83a89e0006592b6afdec8f215a42124' },
  { code: 'AM-CLAIM-000190', rev: 1, previousHash: 'f78c6d671c433a06f15761e34a7603807afc292eab832952adc0a3181fd85f95', hash: '39a18906748b2c068dda2143a1f7ef87059ad95e2881a8da7c2b0c38bda0fd0a' },
  { code: 'AM-CLAIM-000191', rev: 1, previousHash: '50aaa56aa47b74dd63dda8f2fef7a73ea08883e2ba44b5281543014bc8b511f4', hash: 'ee89ae131163646929a712cf61724be8145afda1337eee504db21cd3583b4ede' },
  ] satisfies StatusCorrection[],
} as const;
