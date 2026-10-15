/**
 * The four flagship research cases.
 *
 * Each is developed to the same depth: a question asked in its own
 * tradition's terms, at least two opposing positions with recorded
 * derivations, the reading principles each rests on, counter-models, and a
 * response from every family in the record — including, where it is the
 * honest answer, that a tradition asks a different question.
 *
 * Listed in the historical order of the traditions whose questions they are.
 */

import type { ResearchCase } from '../schema';
import { refs } from './corpus';

const MIGRATED = '2026-10-14T12:00:00Z';

export const CASES: ResearchCase[] = [
  {
    slug: 'torah-permanence',
    field: 'jewish-studies',
    title: 'The permanence of the Torah',
    question: 'Can the commandments given at Sinai be changed or annulled?',
    summary:
      'Deuteronomy forbids adding to or subtracting from the commandments, and calls several of them statutes “forever”. Rabbinic tradition reads this as closing prophecy’s power to legislate, while giving the sages authority to interpret and safeguard the law. Christianity, Islam and the Latter-day Saints each answer a different question about the same law.',
    framing:
      'Asked in the terms of Jewish legal and exegetical tradition: the permanence of the mitzvot, the authority of prophecy, and the authority of the sages. The other traditions are not asked to answer a Jewish legal question; their recorded positions concern how the Sinai law relates to their own covenant or revelation, and are marked as such.',
    aliases: [
      'torah permanence',
      'can the law change',
      'can the commandments change',
      'abrogation of the torah',
      'mosaic law',
      'law of moses',
      'sinai law',
      'mitzvot',
      'statute forever',
      'not in heaven',
      'oral torah',
      'naskh',
    ],
    positions: [
      { claim: 'AM-CLAIM-000219', label: 'The commandments are permanent', heldBy: ['rabbinic-judaism'] },
      { claim: 'AM-CLAIM-000221', label: 'Fulfilled in Christ', heldBy: ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical', 'dispensational'] },
      { claim: 'AM-CLAIM-000225', label: 'A law for each community', heldBy: ['sunni-islam', 'shia-islam'] },
      { claim: 'AM-CLAIM-000227', label: 'Fulfilled, by Restoration scripture', heldBy: ['latter-day-saint'] },
    ],
    featured: ['AM-CLAIM-000219', 'AM-CLAIM-000221'],
    suggestedRejection: 'AM-AX-007',
    responses: [
      {
        tradition: 'rabbinic-judaism',
        response: 'addresses',
        summary:
          'The commandments stand forever. A prophet may suspend one for the need of the hour but cannot abrogate it; interpretation and protective legislation belong to the sages.',
        categories: ['mitzvot', 'horāʾat shāʿāh', 'Torah she-beʿal peh', 'takkanot and gezerot'],
        position: 'AM-CLAIM-000219',
        references: refs('Deuteronomy 4:2', 'b. Shabbat 104a', 'Maimonides, Mishneh Torah Yesodei HaTorah 9:1'),
      },
      {
        tradition: 'catholic',
        response: 'reframes',
        summary:
          'Asks how the Old Law relates to the New: its moral precepts endure, its ceremonial and judicial precepts are fulfilled in Christ. The question is about covenant fulfilment, not about whether a prophet may legislate within Israel.',
        categories: ['moral, ceremonial and judicial precepts', 'fulfilment', 'new covenant'],
        position: 'AM-CLAIM-000221',
        references: refs('Hebrews 8:13', 'Galatians 3:24–25'),
      },
      {
        tradition: 'reformed',
        response: 'reframes',
        summary:
          'Divides the law into moral, ceremonial and judicial: the ceremonial is abrogated, the judicial expired, the moral binding — all within one covenant of grace.',
        categories: ['threefold division of the law', 'covenant of grace'],
        position: 'AM-CLAIM-000221',
        references: refs('Westminster Confession 19.3–4'),
      },
      {
        tradition: 'sunni-islam',
        response: 'reframes',
        summary:
          'Asks how successive revelations relate: each community is given a law and a way, and later revelation may lift earlier precepts. The Sinai law is honoured as revealed for its community, not binding on Muslims.',
        categories: ['sharīʿa', 'naskh', 'shirʿa wa-minhāj'],
        position: 'AM-CLAIM-000225',
        references: refs('Q 5:48', 'Q 3:50'),
      },
      {
        tradition: 'shia-islam',
        response: 'reframes',
        summary: 'As for Sunni Islam; Shiʿi jurisprudence develops the same principle through its own legal tradition.',
        categories: ['sharīʿa', 'naskh'],
        position: 'AM-CLAIM-000225',
        references: refs('Q 5:48'),
      },
      {
        tradition: 'latter-day-saint',
        response: 'reframes',
        summary:
          'The law of Moses was fulfilled in Christ, on the authority of the Book of Mormon, while the covenant with Israel continues through the restored gospel.',
        categories: ['law of Moses', 'covenant Israel', 'Restoration'],
        position: 'AM-CLAIM-000227',
        references: refs('3 Nephi 15:4–5'),
      },
      {
        tradition: 'historical-critical',
        response: 'not_comparable',
        summary:
          'Describes how the Deuteronomic and Priestly formulas function in their settings and how each tradition received them; it does not answer whether the commandments can be changed.',
        categories: ['Deuteronomic and Priestly sources', 'reception history'],
        position: null,
        references: refs('HALOT s.v. עוֹלָם'),
      },
    ],
    limitations: [
      'The case does not cover Karaite Judaism, which rejects the Oral Torah and so the first derivation of the rabbinic position.',
      'Modern Jewish movements differ on the binding force of halakhah; the position recorded is that of classical rabbinic law.',
      'Abrogation within the Qurʾān (naskh between verses) is a separate debate and is not assessed here.',
    ],
    status: 'provisional',
    firstPublished: MIGRATED,
  },
  {
    slug: 'priesthood-new-covenant',
    field: 'christian-studies',
    title: 'Priesthood under the New Covenant',
    question: 'What changed concerning priesthood under the New Covenant?',
    summary:
      'Hebrews explicitly identifies Jesus as high priest after the order of Melchizedek and argues that a change of priesthood entails a change of law. That much is a report of the text. Whether the Levitical priesthood is thereby superseded, and what follows for priesthood in the church, are interpretations — and that is where Christian traditions divide among themselves, and where Rabbinic Judaism dissents.',
    framing:
      'Asked in the terms of Christian theology — Melchizedek, Christology, covenant — because those are the terms of Hebrews. The Rabbinic answer is recorded as a position about the Levitical order, not about Christ, and the Islamic traditions are recorded as not addressing priesthood at all.',
    aliases: [
      'priesthood',
      'new covenant',
      'melchizedek',
      'hebrews',
      'levitical priesthood',
      'high priest',
      'supersession',
      'priesthood of all believers',
      'ministerial priesthood',
      'psalm 110',
    ],
    positions: [
      { claim: 'AM-CLAIM-000191', label: 'The Levitical order is superseded', heldBy: ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical'] },
      { claim: 'AM-CLAIM-000197', label: 'Suspended, not superseded', heldBy: ['rabbinic-judaism'] },
      { claim: 'AM-CLAIM-000199', label: 'A ministerial priesthood shares Christ’s', heldBy: ['catholic', 'eastern-orthodox'] },
      { claim: 'AM-CLAIM-000202', label: 'Christ alone; all believers priests', heldBy: ['lutheran', 'reformed', 'evangelical', 'dispensational'] },
    ],
    featured: ['AM-CLAIM-000191', 'AM-CLAIM-000197'],
    suggestedRejection: 'AM-AX-002',
    responses: [
      {
        tradition: 'catholic',
        response: 'addresses',
        summary:
          'Christ’s priesthood fulfils the Levitical; the ordained ministry participates in it and differs in essence from the common priesthood of the faithful.',
        categories: ['ministerial and common priesthood', 'sacrament of order', 'typology'],
        position: 'AM-CLAIM-000199',
        references: refs('Lumen Gentium 10', 'Council of Trent Session 23'),
      },
      {
        tradition: 'eastern-orthodox',
        response: 'addresses',
        summary: 'As for Catholic teaching on the priesthood and its succession, within Orthodox sacramental theology.',
        categories: ['mystery of ordination', 'apostolic succession'],
        position: 'AM-CLAIM-000199',
        references: [],
      },
      {
        tradition: 'lutheran',
        response: 'addresses',
        summary: 'Christ is the one high priest; all the baptized are priests; the ordained ministry is an office of word and sacrament.',
        categories: ['priesthood of all the baptized', 'office of the ministry'],
        position: 'AM-CLAIM-000202',
        references: refs('Luther, To the Christian Nobility'),
      },
      {
        tradition: 'reformed',
        response: 'addresses',
        summary: 'As for Lutheran teaching, with the change framed as fulfilment within one covenant of grace.',
        categories: ['covenant of grace', 'priesthood of believers'],
        position: 'AM-CLAIM-000202',
        references: refs('Westminster Confession 7.5–6'),
      },
      {
        tradition: 'rabbinic-judaism',
        response: 'addresses',
        summary:
          'Answers about the Levitical priesthood, not about Christ: the priestly order is perpetual and suspended by the Temple’s loss, awaiting restoration.',
        categories: ['kehunnah', 'avodah', 'the Third Temple'],
        position: 'AM-CLAIM-000197',
        references: refs('Numbers 25:13', 'Maimonides, Mishneh Torah Kings and Wars 11:1'),
      },
      {
        tradition: 'latter-day-saint',
        response: 'reframes',
        summary:
          'Holds the Melchizedek priesthood to be an office conferred on ordained men by restored authority — a question about authority taken up in its own case.',
        categories: ['Melchizedek and Aaronic priesthood', 'priesthood keys'],
        position: 'AM-CLAIM-000270',
        references: refs('D&C 107:1–4'),
      },
      {
        tradition: 'sunni-islam',
        response: 'not_comparable',
        summary:
          'Priesthood is not a category of Islamic theology: there is no priestly mediation and no sacrificial cult to supersede. The nearest question — how prophetic authority and law succeed one another — is recorded in the Torah permanence case.',
        categories: ['nubuwwa', 'sharīʿa'],
        position: null,
        references: [],
      },
    ],
    limitations: [
      'Within Christian traditions, only the main lines on ministerial versus common priesthood are recorded; Anglican and Methodist positions are not yet entered.',
      'The dispensational and post-supersessionist reading is recorded as a counter-model (AM-CM-002), not yet as a full position with derivations.',
    ],
    status: 'provisional',
    firstPublished: MIGRATED,
  },
  {
    slug: 'ibrahim-heirs-and-revelation',
    field: 'islamic-studies',
    title: 'Ibrāhīm, prophetic lineage and revelation',
    question: 'Who are the heirs of Ibrāhīm, and how does the Qurʾān present its relation to earlier revelation?',
    summary:
      'The Qurʾān presents Ibrāhīm as a ḥanīf, neither Jew nor Christian, whose religion the Prophet restores; it defines his heirs by following rather than by descent and conditions God’s covenant on righteousness. It describes itself as confirming earlier scripture and standing guardian over it. Jewish and Christian traditions answer from Genesis and Paul — so the deepest disagreement is about which text governs, not about what one text means.',
    framing:
      'Asked in the Qurʾān’s own categories — millat Ibrāhīm, ḥanīf, nubuwwa, taṣdīq and muhaymin, taḥrīf — rather than as a question about Genesis. Where traditions disagree about which scripture is authoritative, the comparison says so instead of treating the dispute as one about interpretation.',
    aliases: [
      'ibrahim',
      'abraham',
      'heirs of abraham',
      'children of abraham',
      'millat ibrahim',
      'religion of abraham',
      'hanif',
      'ishmael',
      'ismail',
      'isaac',
      'kaaba',
      'seal of the prophets',
      'khatam',
      'tahrif',
      'muhaymin',
      'abrahamic',
    ],
    positions: [
      { claim: 'AM-CLAIM-000246', label: 'Heirs by following; millat Ibrāhīm restored', heldBy: ['sunni-islam', 'shia-islam'] },
      { claim: 'AM-CLAIM-000247', label: 'The covenant line through Isaac', heldBy: ['rabbinic-judaism'] },
      { claim: 'AM-CLAIM-000248', label: 'Heirs by faith', heldBy: ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical', 'dispensational'] },
      { claim: 'AM-CLAIM-000249', label: 'The seal of the prophets', heldBy: ['sunni-islam', 'shia-islam'] },
    ],
    featured: ['AM-CLAIM-000246', 'AM-CLAIM-000247'],
    suggestedRejection: 'AM-AX-010',
    responses: [
      {
        tradition: 'sunni-islam',
        response: 'addresses',
        summary:
          'Ibrāhīm’s heirs are those who follow his religion, which the Qurʾān restores; the Qurʾān confirms earlier revelation and stands guardian over it; Muhammad is the seal of the prophets.',
        categories: ['millat Ibrāhīm', 'ḥanīf', 'taṣdīq', 'muhaymin', 'khātam al-nabiyyīn'],
        position: 'AM-CLAIM-000246',
        references: refs('Q 3:67', 'Q 3:68', 'Q 5:48', 'Q 33:40'),
      },
      {
        tradition: 'shia-islam',
        response: 'addresses',
        summary:
          'As for Sunni Islam, with Q 2:124 read as establishing the imamate in Ibrāhīm’s line as a rank no wrongdoer can hold.',
        categories: ['imāma', 'ʿiṣma', 'millat Ibrāhīm'],
        position: 'AM-CLAIM-000246',
        references: refs('Q 2:124', 'Ṭabāṭabāʾī, al-Mīzān on Q 2:124'),
      },
      {
        tradition: 'rabbinic-judaism',
        response: 'addresses',
        summary:
          'The covenant passes through Isaac and Jacob to Israel; converts join it and call Abraham father. Genesis governs; the Qurʾān is not scripture.',
        categories: ['brit', 'Avraham avinu', 'ger tzedek'],
        position: 'AM-CLAIM-000247',
        references: refs('Genesis 17:19–21', 'y. Bikkurim 1:4'),
      },
      {
        tradition: 'catholic',
        response: 'reframes',
        summary:
          'Asks who shares Abraham’s faith, not who restores his religion: heirs are reckoned by faith and the promise fulfilled in Christ. The Qurʾān’s relation to earlier scripture is not its question.',
        categories: ['faith of Abraham', 'promise and fulfilment'],
        position: 'AM-CLAIM-000248',
        references: refs('Galatians 3:7', 'Romans 4:16'),
      },
      {
        tradition: 'latter-day-saint',
        response: 'reframes',
        summary:
          'Joins lineage and adoption: Abraham’s seed bears the priesthood, and all who receive the gospel are counted as his seed.',
        categories: ['Abrahamic covenant', 'adoption into Israel'],
        position: null,
        references: refs('Abraham 2:9–11', 'D&C 110:12'),
      },
      {
        tradition: 'historical-critical',
        response: 'reframes',
        summary:
          'Reads each portrait of Abraham in its own setting and treats “Abrahamic religions” as a modern category that can hide how differently Abraham is used.',
        categories: ['reception history', 'polemical context'],
        position: null,
        references: refs('Hughes, Abrahamic Religions', 'Firestone, Journeys in Holy Lands'),
      },
    ],
    limitations: [
      'Ḥadīth and sīra traditions about Ibrāhīm and Ismāʿīl in Mecca are not yet entered as claims.',
      'Positions within Sunni and Shiʿi exegesis are summarised; individual commentators are cited only where a claim turns on them.',
      'The Ahmadiyya reading of khātam al-nabiyyīn is recorded as a counter-model. Whether the community is Muslim is disputed by many Muslims; the record attributes the reading without ruling on that question.',
    ],
    status: 'provisional',
    firstPublished: MIGRATED,
  },
  {
    slug: 'restoration-priesthood-authority',
    field: 'latter-day-saint-studies',
    title: 'Restoration and priesthood authority',
    question:
      'How do Latter-day Saint scriptures ground priesthood authority, and how does that account compare with other accounts of authority?',
    summary:
      'Latter-day Saint scripture records the Aaronic priesthood conferred by John the Baptist and the Melchizedek by Peter, James and John, restoring authority lost after the apostles. Catholic and Orthodox teaching holds that authority never lapsed; Protestant teaching locates priesthood in Christ and the whole community. The documentary history of the restoration accounts is recorded separately, as historical claims.',
    framing:
      'Asked in Latter-day Saint categories — Restoration, priesthood keys, the two priesthoods, Apostasy. The Catholic, Orthodox and Protestant answers concern a related but different question — where authority resides in the church — and are recorded on their own premises.',
    aliases: [
      'restoration',
      'priesthood authority',
      'aaronic priesthood',
      'melchizedek priesthood',
      'apostasy',
      'great apostasy',
      'apostolic succession',
      'latter-day saint',
      'lds',
      'mormon',
      'joseph smith',
      'doctrine and covenants',
      'priesthood keys',
    ],
    positions: [
      { claim: 'AM-CLAIM-000270', label: 'Restored by angelic conferral', heldBy: ['latter-day-saint'] },
      { claim: 'AM-CLAIM-000274', label: 'Continued in apostolic succession', heldBy: ['catholic', 'eastern-orthodox'] },
      { claim: 'AM-CLAIM-000202', label: 'Christ alone; all believers priests', heldBy: ['lutheran', 'reformed', 'evangelical', 'dispensational'] },
    ],
    featured: ['AM-CLAIM-000270', 'AM-CLAIM-000274'],
    suggestedRejection: 'AM-AX-011',
    responses: [
      {
        tradition: 'latter-day-saint',
        response: 'addresses',
        summary:
          'Authority was lost after the apostles and restored by heavenly messengers; it is transmitted by ordination and governed by priesthood keys.',
        categories: ['Restoration', 'priesthood keys', 'Aaronic and Melchizedek priesthood', 'Apostasy'],
        position: 'AM-CLAIM-000270',
        references: refs('D&C 13:1', 'D&C 27:12', 'D&C 107:1–4'),
      },
      {
        tradition: 'catholic',
        response: 'reframes',
        summary:
          'Asks how authority is transmitted, not how it was restored: apostolic authority continues in the episcopate without interruption.',
        categories: ['apostolic succession', 'episcopate', 'sacrament of order'],
        position: 'AM-CLAIM-000274',
        references: refs('Lumen Gentium 20', '1 Clement 42–44'),
      },
      {
        tradition: 'eastern-orthodox',
        response: 'reframes',
        summary: 'As for Catholic teaching: authority continues in the succession of bishops within Holy Tradition.',
        categories: ['apostolic succession', 'Holy Tradition'],
        position: 'AM-CLAIM-000274',
        references: refs('Irenaeus, Against Heresies 3.3.1–3'),
      },
      {
        tradition: 'lutheran',
        response: 'reframes',
        summary:
          'Locates priesthood in Christ and the whole baptized community; authority to minister is a call to an office, not a transmitted priesthood.',
        categories: ['priesthood of all the baptized', 'call to the ministry'],
        position: 'AM-CLAIM-000202',
        references: refs('1 Peter 2:9', 'Luther, To the Christian Nobility'),
      },
      {
        tradition: 'rabbinic-judaism',
        response: 'not_comparable',
        summary:
          'Priestly status is hereditary in the line of Aaron and is not conferred by ordination; rabbinic authority (semikhah) is a different institution. The question of restored Christian priesthood is not its own.',
        categories: ['kohanim', 'semikhah'],
        position: null,
        references: refs('Exodus 28:1'),
      },
      {
        tradition: 'sunni-islam',
        response: 'not_comparable',
        summary: 'Islam has no priesthood or ordination; religious authority rests on knowledge (ʿilm) and, for Shiʿi Islam, on the Imams.',
        categories: ['ʿulamāʾ', 'ʿilm'],
        position: null,
        references: [],
      },
      {
        tradition: 'historical-critical',
        response: 'reframes',
        summary:
          'Asks when and how the restoration accounts were recorded: the narratives appear in documents of 1832–1835, and one key passage was added between the 1833 and 1835 printings.',
        categories: ['documentary history', 'textual development'],
        position: null,
        references: refs('Prince, Power from On High'),
      },
    ],
    limitations: [
      'Community of Christ and other Restoration churches, which hold different positions on priesthood, are not yet entered.',
      'Priesthood keys and the 1836 Kirtland Temple visions (D&C 110) are cited but not yet developed as claims.',
      'The historical claims rest on published documentary editions; no claim is made here about whether the events occurred.',
    ],
    status: 'provisional',
    firstPublished: MIGRATED,
  },
];
