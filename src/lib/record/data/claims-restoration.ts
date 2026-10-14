/**
 * Latter-day Saint studies flagship: Restoration and priesthood authority.
 *
 * Asked in Latter-day Saint categories — Restoration, priesthood keys, the
 * Aaronic and Melchizedek priesthoods, Apostasy — and compared with the
 * Catholic, Orthodox and Protestant accounts of authority, which answer a
 * related question on different premises. The documentary history of the
 * restoration accounts is recorded as historical claims, separately from what
 * the texts say and from what the traditions believe.
 *
 * New in the October 2026 migration; every revision is provisional.
 */

import type { Claim } from '../schema';
import { REPORT_CONFIDENCE, accept, attributed, conf, newClaim, scholarship } from './build';

const CASE = 'restoration-priesthood-authority';
const PROTESTANT = ['lutheran', 'reformed', 'evangelical', 'dispensational'];

export const RESTORATION_CLAIMS: Claim[] = [
  newClaim('AM-CLAIM-000260', 'thesis', 'Priesthood', [CASE], {
    statement:
      'Doctrine and Covenants 13 presents John the Baptist conferring the Priesthood of Aaron on Joseph Smith and Oliver Cowdery.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the text states',
    divergence: 'Whether the event occurred is a historical and theological question; see AM-CLAIM-000263 for the documentary record.',
    witnesses: ['D&C 13:1'],
    evidence: [['Joseph Smith—History 1:68–72', 'The canonised narrative of the same event, dated 15 May 1829.']],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000261', 'thesis', 'Priesthood', [CASE], {
    statement:
      'Doctrine and Covenants 27 says Peter, James and John ordained Joseph Smith and Oliver Cowdery apostles; section 128 recalls their voice declaring the keys of the kingdom.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the current text states',
    divergence: 'The passage in section 27 is absent from the 1833 printing (AM-CLAIM-000262).',
    witnesses: ['D&C 27:12', 'D&C 128:20'],
    variants: [
      {
        reference: 'Book of Commandments (1833) ch. 28',
        description:
          'The 1833 printing of this revelation contains only its opening verses; the passage naming Peter, James and John first appears in the 1835 Doctrine and Covenants.',
        bearing: 'material',
      },
    ],
    confidence: REPORT_CONFIDENCE([
      3,
      'Secure in the canonised text. The passage is an addition between the 1833 and 1835 printings, which bears on its date but not on what the current text states.',
    ]),
  }),
  newClaim('AM-CLAIM-000262', 'thesis', 'Priesthood', [CASE], {
    statement:
      'The passage of Doctrine and Covenants 27 that names Peter, James and John is absent from the revelation as printed in the 1833 Book of Commandments and first appears in the 1835 Doctrine and Covenants.',
    classification: 'historical_claim',
    headline: 'Very high',
    disputed: 'No — regarding the printed texts',
    divergence:
      'Latter-day Saint historians read the addition as later recording of an earlier event; critical historians read it as evidence that the account developed after 1830.',
    witnesses: ['Book of Commandments (1833) ch. 28', 'Doctrine and Covenants (1835) sec. 50'],
    evidence: [['Prince, Power from On High', 'The development of the priesthood accounts.']],
    confidence: conf({
      textual: [5, 'Both printings survive and can be compared directly.'],
      philological: [null],
      historical: [5, 'Documentary: the two editions are extant.'],
      inferential: [5, 'A comparison of two documents; no inference.'],
    }),
    attribution: scholarship('What the addition means is the divergence; that it is an addition is documentary.'),
  }),
  newClaim('AM-CLAIM-000263', 'thesis', 'Priesthood', [CASE], {
    statement:
      'The earliest narrative accounts of priesthood restoration date from the 1830s: Joseph Smith’s history of about 1832 refers to the ministering of angels and the reception of the high priesthood, and Oliver Cowdery’s 1834 letter describes the angel’s ordination in detail.',
    classification: 'historical_claim',
    headline: 'High',
    disputed: 'Partly',
    divergence: 'Whether the gap between 1829 and the first accounts is significant is disputed between Latter-day Saint and critical historians.',
    witnesses: ['Joseph Smith, History (c. 1832)', 'Messenger and Advocate 1, no. 1 (October 1834)'],
    evidence: [['Prince, Power from On High', 'Places the accounts in their documentary sequence.']],
    confidence: conf({
      textual: [5],
      philological: [null],
      historical: [
        4,
        'The documents are extant and published; that no account earlier than 1832 is known is a finding of the documentary record and could be overturned by a new find.',
      ],
      inferential: [4],
    }),
    attribution: scholarship(),
  }),
  newClaim('AM-CLAIM-000264', 'thesis', 'Priesthood', [CASE], {
    statement:
      'Doctrine and Covenants 107 names two priesthoods, the Melchizedek and the Aaronic, and explains that the higher is called after Melchizedek to avoid too frequent repetition of the name of the Supreme Being.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the text states',
    divergence: 'Contrasts with Hebrews 7:23–24, read in Protestant tradition as limiting the Melchizedek order to Christ (AM-CLAIM-000193).',
    witnesses: ['D&C 107:1–4'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000265', 'thesis', 'Priesthood', [CASE], {
    statement: 'Doctrine and Covenants 84 traces a priesthood lineage in which Abraham received the priesthood from Melchizedek.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the text states',
    divergence: 'Genesis 14 records a blessing and a tithe, not an ordination; the lineage is particular to Restoration scripture.',
    witnesses: ['D&C 84:6–17'],
    evidence: [['Genesis 14:18–20', 'The only biblical narrative of Melchizedek and Abraham.']],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000266', 'thesis', 'Priesthood', [CASE], {
    statement:
      'The Book of Mormon presents Melchizedek as a high priest and king of Salem, and speaks of high priests ordained “after the order of his Son”.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the text states',
    divergence: 'Expands the biblical figure; read in Latter-day Saint teaching as describing an order men are ordained into.',
    witnesses: ['Alma 13:14–19', 'Alma 13:16'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000267', 'thesis', 'Covenant', [CASE, 'ibrahim-heirs-and-revelation'], {
    statement:
      'The Book of Abraham promises that Abraham’s seed will bear the priesthood and the gospel to all nations, and that all who receive the gospel will be counted as his seed.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the text states',
    divergence: 'Joins lineage and adoption: heirs by descent and by reception of the gospel.',
    witnesses: ['Abraham 2:9–11'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000268', 'thesis', 'Authority', [CASE], {
    statement:
      'Latter-day Saint scripture records Joseph Smith being told that the churches of his day were all wrong, and declares that people had strayed from God’s ordinances and broken his everlasting covenant.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the texts state',
    divergence: 'Read in Latter-day Saint teaching as describing a general apostasy (AM-CLAIM-000269).',
    witnesses: ['Joseph Smith—History 1:19', 'D&C 1:15'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000269', 'lemma', 'Authority', [CASE], {
    statement:
      'After the deaths of the apostles, priesthood authority was lost from the earth (the Great Apostasy), so that it had to be restored.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence:
      'Foundational in Latter-day Saint teaching; denied by Catholic and Orthodox churches, which hold that authority continued in apostolic succession.',
    witnesses: ['Joseph Smith—History 1:19', 'D&C 1:15'],
    evidence: [['Gospel Topics, “Apostasy”', 'The Church’s own summary of the teaching.']],
    confidence: conf({
      textual: [5],
      philological: [4],
      historical: [
        2,
        'A claim about the post-apostolic church that rests on the tradition’s own revelation; external sources show diversity and development, which is read differently by each side.',
      ],
      inferential: [3, 'Follows if Restoration scripture is revelation (AM-AX-011).'],
    }),
    attribution: attributed(['latter-day-saint']),
    acceptance: accept(
      ['latter-day-saint', 'affirms', null, ['Gospel Topics, “Apostasy”']],
      ['catholic', 'rejects', 'Holds that apostolic authority continues in the episcopate.', ['Lumen Gentium 20']],
      ['eastern-orthodox', 'rejects', null],
      ...PROTESTANT.map(
        (t) => [t, 'qualifies', 'Speaks of corruption of doctrine in the medieval church, not of a loss of priesthood authority, which it does not locate in an office.'] as [string, 'qualifies', string],
      ),
    ),
  }),
  newClaim('AM-CLAIM-000270', 'position', 'Authority', [CASE], {
    statement:
      'Priesthood authority was restored by angelic conferral — the Aaronic by John the Baptist, the Melchizedek by Peter, James and John — and is transmitted by ordination from that restoration.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence:
      'The Latter-day Saint answer. Disagrees with Catholic and Orthodox teaching about whether authority was ever lost, and with Protestant teaching about whether it resides in an office.',
    witnesses: ['D&C 13:1', 'D&C 27:12', 'D&C 107:1–4'],
    confidence: conf({
      textual: [3, 'One of the two necessary witnesses (D&C 27:12) is an addition of 1835 (AM-CLAIM-000262).'],
      philological: [5],
      historical: [2, 'Attested by the participants’ later accounts only (AM-CLAIM-000263).'],
      inferential: [3, 'Follows if Restoration scripture is revelation (AM-AX-011) and the Apostasy lemma holds.'],
    }),
    attribution: attributed(['latter-day-saint']),
    acceptance: accept(
      ['latter-day-saint', 'affirms', null],
      ['catholic', 'rejects', null],
      ['eastern-orthodox', 'rejects', null],
      ...PROTESTANT.map((t) => [t, 'rejects', null] as [string, 'rejects', null]),
      ['rabbinic-judaism', 'not_addressed', null],
      ['sunni-islam', 'not_addressed', null],
    ),
  }),
  newClaim('AM-CLAIM-000271', 'thesis', 'Authority', [CASE], {
    statement: 'In Matthew, Jesus says he will build his church on “this rock” and that the gates of Hades will not prevail against it.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the text states',
    divergence: 'Whether the rock is Peter, his confession or Christ, and whether the promise implies unbroken institutional continuity, divides the traditions.',
    witnesses: ['Matthew 16:18'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000272', 'thesis', 'Authority', [CASE], {
    statement:
      '1 Clement says the apostles appointed bishops and deacons and gave instructions that, when these died, other approved men should succeed to their ministry.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the letter states',
    divergence: 'Whether this describes a single bishop in succession or a college of presbyter-bishops is debated by historians.',
    witnesses: ['1 Clement 42–44'],
    confidence: conf({
      textual: [5],
      philological: [4, 'ἐπίσκοπος and πρεσβύτερος overlap in this period; the office described is debated.'],
      historical: [null],
      inferential: [5],
    }),
  }),
  newClaim('AM-CLAIM-000273', 'thesis', 'Authority', [CASE], {
    statement:
      'Irenaeus appeals to the succession of bishops in the churches founded by apostles, listing the bishops of Rome, as the guarantee of apostolic teaching.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Irenaeus argues',
    divergence: 'Historians debate how far Irenaeus’ list reflects the structure of the Roman church before the mid-second century.',
    witnesses: ['Irenaeus, Against Heresies 3.3.1–3'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000274', 'position', 'Authority', [CASE], {
    statement:
      'Apostolic authority has continued without interruption through the succession of bishops; no general loss of authority occurred, so none needed restoring.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence: 'The Catholic and Orthodox answer. Disagrees with the Latter-day Saint position about whether authority was lost.',
    witnesses: ['1 Clement 42–44', 'Irenaeus, Against Heresies 3.3.1–3', 'Lumen Gentium 20'],
    confidence: conf({
      textual: [5],
      philological: [4],
      historical: [3, 'Early witnesses to succession exist; how early a single-bishop succession is attested is debated.'],
      inferential: [3, 'Follows if apostolic succession transmits authority (AM-AX-012).'],
    }),
    attribution: attributed(['catholic', 'eastern-orthodox']),
    acceptance: accept(
      ['catholic', 'affirms', null, ['Lumen Gentium 20']],
      ['eastern-orthodox', 'affirms', null],
      ['lutheran', 'qualifies', 'Values continuity of teaching; does not make episcopal succession necessary.'],
      ['reformed', 'rejects', 'Locates continuity in the apostolic teaching, not in a succession of bishops.'],
      ['evangelical', 'rejects', null],
      ['dispensational', 'rejects', null],
      ['latter-day-saint', 'rejects', null, ['Gospel Topics, “Apostasy”']],
    ),
  }),
];
