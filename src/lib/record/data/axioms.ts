/**
 * Tradition axioms — the reading principles conclusions rest on.
 *
 * AM-AX-001 to 006 are reproduced from the published hermeneutics record.
 * The per-tradition stance matrix, and axioms 007 to 013, were added in the
 * October 2026 migration and are provisional until an editor verifies them.
 *
 * A stance is an attribution, not a verdict: it says which principle a
 * tradition reads with, so a reader can see what a conclusion depends on.
 */

import type { Axiom } from '../schema';
import type { AxiomStance } from '../taxonomy';
import { refs } from './corpus';
import { IMPORTED_STATUS } from './build';

const PUBLISHED = '2026-10-02';
const MIGRATED = '2026-10-14T12:00:00Z';

type StanceRow = [tradition: string, stance: AxiomStance, note?: string | null, citations?: string[]];

function stances(...rows: StanceRow[]): Axiom['stances'] {
  return rows.map(([tradition, stance, note, citations]) => ({
    tradition,
    stance,
    note: note ?? null,
    references: refs(...(citations ?? [])),
  }));
}

const CHRISTIAN = ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical', 'dispensational'];
const all = (stance: AxiomStance, ids: string[], note?: string): StanceRow[] =>
  ids.map((id) => [id, stance, note ?? null]);

export const AXIOMS: Axiom[] = [
  {
    code: 'AM-AX-001',
    label: 'Apostolic exegesis is authoritative',
    statement:
      "New Testament authors' readings of the Hebrew Bible are normative interpretations, not merely historical reception.",
    rationale: "Grounds the use of Hebrews' reading of Psalm 110 and Genesis 14 as determinative of their meaning.",
    heldBy: 'Canonical Christian',
    stances: stances(
      ...all('holds', CHRISTIAN),
      [
        'latter-day-saint',
        'qualifies',
        'Holds the Bible to be the word of God “as far as it is translated correctly”.',
        ['Articles of Faith 8'],
      ],
      ['rabbinic-judaism', 'rejects', 'The New Testament is not scripture in Judaism.'],
      [
        'sunni-islam',
        'rejects',
        'The Injīl revealed to ʿĪsā is honoured, but the New Testament writings are not treated as normative revelation.',
      ],
      ['shia-islam', 'rejects', 'As for Sunni Islam.'],
      ['historical-critical', 'brackets', 'Reads New Testament use of earlier texts as reception history.'],
    ),
    stancesStatus: 'provisional',
    firstPublished: PUBLISHED,
    status: IMPORTED_STATUS,
  },
  {
    code: 'AM-AX-002',
    label: 'Figures prefigure fulfilment',
    statement:
      "Persons, institutions and events in earlier scripture can foreshadow later realities beyond their authors' horizon.",
    rationale: 'Licenses reading Melchizedek and the Levitical cult as types of Christ.',
    heldBy: 'Typological (Patristic, Catholic, Orthodox)',
    stances: stances(
      ...all('holds', ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical']),
      [
        'dispensational',
        'qualifies',
        'Accepts types the New Testament identifies, while keeping the plain sense of promises to Israel.',
      ],
      ['latter-day-saint', 'holds', 'The law of Moses is described as “types of things to come”.', ['Mosiah 13:31', 'Alma 13:16']],
      [
        'rabbinic-judaism',
        'qualifies',
        'Figural reading of the patriarchs is part of rabbinic and medieval exegesis; its christological application is rejected.',
      ],
      ['historical-critical', 'brackets', 'Treats typology as a reading practice of later interpreters.'],
    ),
    stancesStatus: 'provisional',
    firstPublished: PUBLISHED,
    status: IMPORTED_STATUS,
  },
  {
    code: 'AM-AX-003',
    label: 'One covenant of grace',
    statement:
      'The biblical covenants are successive administrations of a single covenant of grace; the new covenant fulfils rather than cancels the old.',
    rationale: 'Frames the priesthood change as fulfilment within continuity.',
    heldBy: 'Reformed covenant theology',
    stances: stances(
      ['reformed', 'holds', null, ['Westminster Confession 7.5–6']],
      ['dispensational', 'rejects', 'Distinguishes successive dispensations and keeps the covenants with Israel distinct.'],
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: PUBLISHED,
    status: IMPORTED_STATUS,
  },
  {
    code: 'AM-AX-004',
    label: 'Israel and the church remain distinct',
    statement: 'Promises made to national Israel retain literal force and are not absorbed by the church.',
    rationale: "Qualifies supersession: Jeremiah's new covenant is addressed to Israel and Judah.",
    heldBy: 'Dispensational',
    stances: stances(
      ['dispensational', 'holds'],
      [
        'rabbinic-judaism',
        'qualifies',
        'Holds that God’s covenant with Israel stands permanently; the place of a church is not its own question.',
        ['Jeremiah 31:35–37'],
      ],
      [
        'catholic',
        'qualifies',
        'Teaches that the Jews remain dear to God, whose gifts and call are irrevocable, without adopting a two-peoples system.',
        ['Nostra Aetate 4', 'Romans 11:29'],
      ],
      [
        'reformed',
        'qualifies',
        'Commonly reads the church as Israel’s continuation, while many Reformed interpreters expect a future turning of ethnic Israel.',
        ['Romans 11:25–26'],
      ],
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: PUBLISHED,
    status: IMPORTED_STATUS,
  },
  {
    code: 'AM-AX-005',
    label: 'Torah is eternal and unabrogated',
    statement: 'The Written Torah, read through the Oral Torah, remains binding; no later revelation replaces it.',
    rationale: 'Rejects any change of law and reads Psalm 110 without priestly-messianic transfer.',
    heldBy: 'Rabbinic Judaism',
    stances: stances(
      ['rabbinic-judaism', 'holds', null, ['Deuteronomy 4:2', 'Maimonides, Mishneh Torah Yesodei HaTorah 9:1']],
      ...all(
        'rejects',
        ['catholic', 'eastern-orthodox', 'lutheran', 'evangelical'],
        'Holds the moral law to endure while its ceremonial provisions are fulfilled in Christ.',
      ),
      ['reformed', 'rejects', 'Ceremonial laws are abrogated and judicial laws expired; the moral law binds.', ['Westminster Confession 19.3–4']],
      ['dispensational', 'rejects', 'The Mosaic law is not the rule of life in the church age.'],
      ['latter-day-saint', 'rejects', 'The law of Moses is fulfilled in Christ.', ['3 Nephi 15:4–5']],
      [
        'sunni-islam',
        'rejects',
        'The Torah is honoured as revealed; Muslims follow the law given through Muhammad.',
        ['Q 5:48'],
      ],
      ['shia-islam', 'rejects', 'As for Sunni Islam.', ['Q 5:48']],
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: PUBLISHED,
    status: IMPORTED_STATUS,
  },
  {
    code: 'AM-AX-006',
    label: 'Original context precedes reception',
    statement:
      "A text's meaning is first established in its historical setting; later reuse is reception history, not the text's own sense.",
    rationale: "Separates what Psalm 110 meant in its royal setting from Hebrews' later application.",
    heldBy: 'Historical-critical',
    stances: stances(
      ['historical-critical', 'holds'],
      [
        'catholic',
        'qualifies',
        'Requires attention to literary forms and the sacred writers’ intention, read within the unity of Scripture and Tradition.',
        ['Dei Verbum 12'],
      ],
      [
        'rabbinic-judaism',
        'qualifies',
        '“A verse does not depart from its plain sense” stands beside midrashic reading.',
        ['b. Shabbat 63a'],
      ],
    ),
    stancesStatus: 'provisional',
    firstPublished: PUBLISHED,
    status: IMPORTED_STATUS,
  },
  {
    code: 'AM-AX-007',
    label: 'The Oral Torah is authoritative',
    statement:
      'The Written Torah was given at Sinai together with an oral tradition of interpretation, transmitted through the sages, which determines its meaning and application.',
    rationale:
      'Grounds reading Deuteronomy through the Talmud’s rulings on prophecy, interpretation and the sages’ authority.',
    heldBy: 'Rabbinic Judaism',
    stances: stances(
      ['rabbinic-judaism', 'holds', null, ['m. Avot 1:1', 'b. Shabbat 31a', 'b. Gittin 60b']],
      ...all(
        'rejects',
        [...CHRISTIAN, 'latter-day-saint', 'sunni-islam', 'shia-islam'],
        'Does not receive rabbinic tradition as binding interpretation.',
      ),
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: MIGRATED,
    status: 'provisional',
  },
  {
    code: 'AM-AX-008',
    label: 'The Qurʾān is the final, authoritative revelation',
    statement:
      'The Qurʾān is God’s final revelation, confirming earlier scripture and standing as its guardian (muhaymin); what it teaches about earlier prophets is authoritative.',
    rationale: 'Grounds reading Ibrāhīm through the Qurʾān’s portrait of him rather than through Genesis.',
    heldBy: 'Sunni and Shiʿi Islam',
    stances: stances(
      ['sunni-islam', 'holds', null, ['Q 5:48']],
      ['shia-islam', 'holds', null, ['Q 5:48']],
      ...all('rejects', ['rabbinic-judaism', ...CHRISTIAN, 'latter-day-saint'], 'Does not receive the Qurʾān as scripture.'),
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: MIGRATED,
    status: 'provisional',
  },
  {
    code: 'AM-AX-009',
    label: 'Earlier scriptures as transmitted are not wholly reliable',
    statement:
      'The Torah and the Gospel were revealed by God, but their text or their interpretation, as now held, has been altered (taḥrīf), so they do not override the Qurʾān.',
    rationale: 'Explains why the Qurʾān’s account governs where it differs from Genesis.',
    heldBy: 'Sunni and Shiʿi Islam',
    stances: stances(
      [
        'sunni-islam',
        'holds',
        'Classical views range from distortion of meaning to alteration of the wording.',
        ['Q 2:75', 'Q 4:46', 'Q 5:13'],
      ],
      ['shia-islam', 'holds', 'As for Sunni Islam.', ['Q 5:13']],
      [
        'latter-day-saint',
        'qualifies',
        'Holds that “many plain and precious things” were taken from the Bible and accepts it “as far as it is translated correctly” — a parallel concern, without reference to the Qurʾān.',
        ['1 Nephi 13:28', 'Articles of Faith 8'],
      ],
      ...all('rejects', ['rabbinic-judaism', ...CHRISTIAN], 'Holds its received scriptures to be reliably transmitted.'),
      ['historical-critical', 'brackets', 'Treats the transmission of each text as a question of textual evidence.'],
    ),
    stancesStatus: 'provisional',
    firstPublished: MIGRATED,
    status: 'provisional',
  },
  {
    code: 'AM-AX-010',
    label: 'Genesis as received is an authoritative covenant charter',
    statement: 'The received text of Genesis authoritatively records the terms and the line of God’s covenant with Abraham.',
    rationale: 'Grounds reading the covenant line through Isaac (Genesis 17:19–21).',
    heldBy: 'Jewish and Christian traditions',
    stances: stances(
      ['rabbinic-judaism', 'holds'],
      ...all('holds', CHRISTIAN),
      ['latter-day-saint', 'qualifies', 'Accepts the Bible “as far as it is translated correctly”.', ['Articles of Faith 8']],
      ['sunni-islam', 'rejects', 'See AM-AX-009.'],
      ['shia-islam', 'rejects', 'See AM-AX-009.'],
      ['historical-critical', 'brackets', 'Reads Genesis as a composite work with its own history of composition.'],
    ),
    stancesStatus: 'provisional',
    firstPublished: MIGRATED,
    status: 'provisional',
  },
  {
    code: 'AM-AX-011',
    label: 'Continuing revelation and an open canon',
    statement:
      'God continues to reveal his will through living prophets; the Book of Mormon, the Doctrine and Covenants and the Pearl of Great Price are scripture alongside the Bible.',
    rationale:
      'Grounds the restoration accounts in Doctrine and Covenants 13 and 27, and the priesthood teaching of sections 84 and 107.',
    heldBy: 'Latter-day Saint',
    stances: stances(
      ['latter-day-saint', 'holds', null, ['Articles of Faith 9']],
      ...all(
        'rejects',
        ['rabbinic-judaism', ...CHRISTIAN, 'sunni-islam', 'shia-islam'],
        'Does not receive the Restoration scriptures as revelation.',
      ),
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: MIGRATED,
    status: 'provisional',
  },
  {
    code: 'AM-AX-012',
    label: 'Apostolic succession transmits authority',
    statement:
      'Authority given to the apostles is transmitted through an unbroken succession of bishops ordained by the laying on of hands.',
    rationale: 'Grounds the claim that no general loss of authority occurred after the apostles.',
    heldBy: 'Catholic and Eastern Orthodox',
    stances: stances(
      ['catholic', 'holds', null, ['Lumen Gentium 20']],
      ['eastern-orthodox', 'holds'],
      [
        'lutheran',
        'qualifies',
        'Some Lutheran churches retain episcopal succession, but it is not held necessary for a true church.',
      ],
      ...all('rejects', ['reformed', 'evangelical', 'dispensational']),
      ['latter-day-saint', 'rejects', 'Holds that apostolic authority was lost and later restored.', ['Gospel Topics, “Apostasy”']],
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: MIGRATED,
    status: 'provisional',
  },
  {
    code: 'AM-AX-013',
    label: 'Scripture alone is the final rule',
    statement:
      'Scripture is the only infallible rule of faith; no later tradition or revelation adds to it (sola scriptura).',
    rationale:
      'Grounds reading Christ’s priesthood from Hebrews and 1 Peter without a sacerdotal office transmitted outside Scripture.',
    heldBy: 'Protestant',
    stances: stances(
      ['lutheran', 'holds'],
      ['reformed', 'holds', null, ['Westminster Confession 1.6']],
      ['evangelical', 'holds'],
      ['dispensational', 'holds'],
      ['catholic', 'rejects', 'Scripture and Tradition together form one deposit of the word of God.', ['Dei Verbum 9–10']],
      ['eastern-orthodox', 'rejects', 'Scripture is read within Holy Tradition.'],
      ['latter-day-saint', 'rejects', 'Holds an open canon.', ['Articles of Faith 9']],
      ['historical-critical', 'brackets'],
    ),
    stancesStatus: 'provisional',
    firstPublished: MIGRATED,
    status: 'provisional',
  },
];
