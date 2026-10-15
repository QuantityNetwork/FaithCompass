/**
 * Derivations — how each claim is arrived at.
 *
 * The published record stored dependencies as flat edges. Here every edge
 * belongs to a derivation, so that a claim with two independent arguments is
 * not lost when one of them fails. Rationales for edges carried over from the
 * published record are reproduced verbatim.
 *
 * Claims grounded in a witness or in evidence (textual propositions, lemmas
 * that report an argument, philological and historical claims) also have an
 * implicit witness derivation: the text still says what it says, whatever
 * happens to the argument built on it. See engine.ts.
 */

import type { Derivation } from '../schema';
import { derivation } from './build';

const PUBLISHED = '2026-10-02';

export const DERIVATIONS: Derivation[] = [
  /* ---------- Carried over from the published hermeneutics record ---------- */
  derivation({
    code: 'AM-DRV-0001',
    claim: 'AM-CLAIM-000184',
    label: 'Hebrews’ priestly argument (Hebrews 5–8)',
    summary:
      'The argument Hebrews gives for the identification: the Melchizedekian title from Psalm 110, defined against the Levitical order, with Jeremiah’s new covenant and the Melchizedek likeness in support.',
    premises: [
      ['AM-CLAIM-000186', 'necessary', 'premise', 'report', 'Hebrews 5:6 and 7:17 quote Psalm 110:4 directly; the Melchizedekian title rests on the psalm.'],
      ['AM-CLAIM-000188', 'necessary', 'contrast', 'report', 'Hebrews 7:11–16 argues by contrast with the hereditary Levitical order.'],
      ['AM-CLAIM-000185', 'supporting', 'premise', 'report', 'Hebrews 8:8–12 cites Jeremiah 31 to ground a change of covenant alongside the change of priesthood.'],
      ['AM-CLAIM-000189', 'supporting', 'lemma', 'report', 'The likeness of Melchizedek to "the Son of God" (7:3) is the bridge Hebrews uses to apply the order to Jesus.'],
    ],
    axioms: [
      ['AM-AX-001', 'strengthened_by', "Descriptive claim about Hebrews; holds as a report of the text, but its theological force relies on apostolic authority."],
    ],
    since: PUBLISHED,
  }),
  derivation({
    code: 'AM-DRV-0002',
    claim: 'AM-CLAIM-000185',
    label: 'Defined against Sinai',
    summary: 'Jeremiah defines the new covenant by contrast with the covenant made at Sinai.',
    premises: [
      ['AM-CLAIM-000188', 'necessary', 'contrast', 'report', 'Jeremiah 31:32 defines the new covenant against the covenant made at Sinai.'],
    ],
    since: PUBLISHED,
  }),
  derivation({
    code: 'AM-DRV-0003',
    claim: 'AM-CLAIM-000186',
    label: 'Psalm 110 read against Genesis 14',
    summary: 'The psalm draws on the Melchizedek of Genesis 14; reading the psalm in its own royal setting strengthens the identification of the figure.',
    premises: [
      ['AM-CLAIM-000187', 'supporting', 'interpretive_step', 'report', 'Psalm 110 draws on Genesis 14, where Melchizedek blesses Abraham; reading the link as typology is interpretive.'],
    ],
    axioms: [['AM-AX-006', 'strengthened_by', "The psalm's royal-priestly figure is identified first in its Davidic setting."]],
    since: PUBLISHED,
  }),
  derivation({
    code: 'AM-DRV-0004',
    claim: 'AM-CLAIM-000189',
    label: 'Typological warrant for the reading',
    summary:
      'What makes Hebrews’ reading of Genesis’ silence a valid reading, rather than only a report of one. The report itself stands on Hebrews 7:3.',
    axioms: [['AM-AX-002', 'requires', "Treating Genesis' silence as meaningful is a typological move."]],
    since: PUBLISHED,
  }),
  derivation({
    code: 'AM-DRV-0005',
    claim: 'AM-CLAIM-000190',
    label: 'Priesthood bound to law',
    summary: 'The lemma presupposes the Sinai bond between law and Levitical priesthood.',
    premises: [
      ['AM-CLAIM-000188', 'necessary', 'contrast', 'report', 'The lemma presupposes that the Mosaic law is bound to the Levitical priesthood (7:11).'],
    ],
    since: PUBLISHED,
  }),
  derivation({
    code: 'AM-DRV-0006',
    claim: 'AM-CLAIM-000191',
    label: 'Priesthood argument (Hebrews 7)',
    summary:
      'A new priesthood after Melchizedek’s order, with the priesthood-law linkage, displaces the Levitical order. Requires both apostolic authority and typology.',
    premises: [
      ['AM-CLAIM-000184', 'necessary', 'premise', 'warrant', 'The supersession thesis requires that Jesus actually holds the Melchizedekian priesthood.'],
      ['AM-CLAIM-000190', 'necessary', 'lemma', 'warrant', 'Without the priesthood-law linkage, a new priesthood would not displace the Levitical order.'],
      ['AM-CLAIM-000185', 'supporting', 'premise', 'report', 'Jeremiah\'s "not like the covenant" (31:32) supplies the covenantal frame Hebrews 8 builds on.'],
    ],
    axioms: [
      ['AM-AX-001', 'requires', "The inference treats Hebrews' argument as normative."],
      ['AM-AX-002', 'requires', 'Supersession reads the Levitical order as a shadow (Hebrews 8:5, 10:1).'],
      ['AM-AX-003', 'strengthened_by', 'Covenant theology frames supersession as fulfilment within one covenant of grace.'],
    ],
    since: PUBLISHED,
  }),

  /* ---------- New in the October 2026 migration ---------- */
  derivation({
    code: 'AM-DRV-0007',
    claim: 'AM-CLAIM-000191',
    label: 'Covenant argument (Hebrews 8)',
    summary:
      'An independent route to the same conclusion: Jeremiah’s word “new” makes the first covenant old (Hebrews 8:13), and its priestly order with it. Needs apostolic authority, but not typology.',
    premises: [
      ['AM-CLAIM-000185', 'necessary', 'premise', 'report', 'Hebrews 8:8–12 quotes Jeremiah’s announcement in full.'],
      ['AM-CLAIM-000192', 'necessary', 'premise', 'report', 'Hebrews 8:13 draws the conclusion that the first covenant is growing old.'],
    ],
    axioms: [['AM-AX-001', 'requires', 'The inference treats Hebrews’ reading of Jeremiah as normative.']],
  }),
  derivation({
    code: 'AM-DRV-0008',
    claim: 'AM-CLAIM-000197',
    label: 'The Torah’s priestly order is perpetual',
    summary: 'The Aaronide and Phinehan priesthood is granted in perpetuity within an unabrogated Torah.',
    premises: [
      ['AM-CLAIM-000188', 'necessary', 'premise', 'report', 'The Levitical priesthood is instituted at Sinai.'],
      ['AM-CLAIM-000196', 'necessary', 'premise', 'report', 'Phinehas is granted a covenant of perpetual priesthood.'],
      ['AM-CLAIM-000210', 'necessary', 'premise', 'report', 'Nothing may be added to or taken from the commandments.'],
      ['AM-CLAIM-000211', 'supporting', 'evidence', 'report', 'The priesthood is among the statutes designated “forever”.'],
    ],
    axioms: [
      ['AM-AX-005', 'requires', 'The Torah’s order cannot be replaced by a later revelation.'],
      ['AM-AX-007', 'strengthened_by', 'Rabbinic tradition reads the loss of the Temple as suspension of the cult.'],
    ],
  }),
  derivation({
    code: 'AM-DRV-0009',
    claim: 'AM-CLAIM-000197',
    label: 'The prophetic promise of continued Levitical service',
    summary:
      'An independent route: the prophets promise that the Levitical priests will not lack a successor. Does not depend on Torah permanence, but on reading promises to Israel in their plain sense.',
    premises: [
      ['AM-CLAIM-000195', 'necessary', 'premise', 'report', 'Jeremiah 33:17–18 promises a continuing Levitical priesthood (Masoretic Text).'],
      ['AM-CLAIM-000188', 'supporting', 'premise', 'report', 'The priesthood promised is the one instituted at Sinai.'],
    ],
    axioms: [['AM-AX-004', 'requires', 'Promises made to Israel keep their plain sense.']],
  }),
  derivation({
    code: 'AM-DRV-0010',
    claim: 'AM-CLAIM-000199',
    label: 'Participation in Christ’s one priesthood',
    summary: 'Christ is high priest; the church’s ordained ministry shares that priesthood by sacramental ordination in apostolic succession.',
    premises: [
      ['AM-CLAIM-000184', 'necessary', 'premise', 'warrant', 'Christ is the high priest in whose priesthood the ministry shares.'],
      ['AM-CLAIM-000198', 'necessary', 'premise', 'report', 'Lumen Gentium distinguishes the two priesthoods in essence.'],
      ['AM-CLAIM-000203', 'necessary', 'premise', 'report', 'Trent teaches a visible priesthood conferred in the sacrament of order.'],
      ['AM-CLAIM-000200', 'supporting', 'premise', 'report', 'The common priesthood of the faithful, alongside which the ministerial is defined.'],
    ],
    axioms: [
      ['AM-AX-001', 'requires', 'Reads Hebrews as normative for Christ’s priesthood.'],
      ['AM-AX-012', 'requires', 'Ordination in apostolic succession transmits the ministerial priesthood.'],
    ],
  }),
  derivation({
    code: 'AM-DRV-0011',
    claim: 'AM-CLAIM-000202',
    label: 'Christ’s unique priesthood and the priesthood of believers',
    summary: 'Christ holds his priesthood permanently; Scripture gives the community a common priesthood and no other.',
    premises: [
      ['AM-CLAIM-000184', 'necessary', 'premise', 'warrant', 'Christ is the Melchizedekian high priest.'],
      ['AM-CLAIM-000193', 'necessary', 'premise', 'report', 'He holds the priesthood permanently, unlike the Levitical succession.'],
      ['AM-CLAIM-000200', 'necessary', 'premise', 'report', 'Scripture calls the whole community a priesthood.'],
      ['AM-CLAIM-000194', 'supporting', 'lemma', 'warrant', 'The exclusive reading of ἀπαράβατος supports “no successor”.'],
      ['AM-CLAIM-000201', 'supporting', 'evidence', 'report', 'Luther’s classic statement of the common priesthood.'],
    ],
    axioms: [
      ['AM-AX-001', 'requires', 'Reads Hebrews and 1 Peter as normative.'],
      ['AM-AX-013', 'requires', 'No sacerdotal office is given outside Scripture.'],
    ],
  }),
  derivation({
    code: 'AM-DRV-0012',
    claim: 'AM-CLAIM-000219',
    label: 'Through rabbinic interpretation',
    summary:
      'Deuteronomy forbids adding or subtracting; the Talmud reads Leviticus 27:34 as closing prophecy’s power to innovate; Maimonides codifies the rule. Interpretive authority rests with the sages, not with heaven.',
    premises: [
      ['AM-CLAIM-000210', 'necessary', 'premise', 'report', 'The Deuteronomic prohibition.'],
      ['AM-CLAIM-000214', 'necessary', 'lemma', 'report', 'No prophet may introduce anything new.'],
      ['AM-CLAIM-000215', 'necessary', 'premise', 'report', 'The codified rule that a prophet who abrogates is false.'],
      ['AM-CLAIM-000213', 'supporting', 'interpretive_step', 'report', '“It is not in heaven”: interpretation rests with the sages.'],
      ['AM-CLAIM-000216', 'supporting', 'evidence', 'report', 'Only temporary suspension is allowed, which presupposes permanence.'],
    ],
    axioms: [['AM-AX-007', 'requires', 'The derivation reads Deuteronomy through the Talmud and the codes.']],
  }),
  derivation({
    code: 'AM-DRV-0013',
    claim: 'AM-CLAIM-000219',
    label: 'From the plain sense of Deuteronomy and the perpetual statutes',
    summary:
      'An independent route that needs no reading principle: the commandments may not be altered, and several are given “forever”. It does need the perpetual sense of ʿôlām.',
    premises: [
      ['AM-CLAIM-000210', 'necessary', 'premise', 'report', 'The Deuteronomic prohibition.'],
      ['AM-CLAIM-000211', 'necessary', 'evidence', 'report', 'The statutes designated “forever”.'],
      ['AM-CLAIM-000218', 'necessary', 'lemma', 'warrant', '“Forever” must mean perpetual for the statutes to bind permanently.'],
      ['AM-CLAIM-000212', 'supporting', 'premise', 'report', 'The commandment is near and doable, not awaiting further revelation.'],
    ],
  }),
  derivation({
    code: 'AM-DRV-0014',
    claim: 'AM-CLAIM-000221',
    label: 'Covenant fulfilment in Christ',
    summary: 'The new covenant makes the first old (Hebrews 8:13) and the law was a guardian until Christ (Galatians 3:24–25).',
    premises: [
      ['AM-CLAIM-000192', 'necessary', 'premise', 'report', 'Hebrews 8:13 on the first covenant growing old.'],
      ['AM-CLAIM-000220', 'necessary', 'premise', 'report', 'The law as guardian until Christ.'],
      ['AM-CLAIM-000228', 'supporting', 'lemma', 'warrant', 'Christ as the τέλος of the law, on either reading.'],
      ['AM-CLAIM-000190', 'supporting', 'lemma', 'report', 'Hebrews links a change of priesthood to a change of law.'],
    ],
    axioms: [['AM-AX-001', 'requires', 'Treats the New Testament reading of the law as normative.']],
  }),
  derivation({
    code: 'AM-DRV-0015',
    claim: 'AM-CLAIM-000225',
    label: 'A law and a way for each community',
    summary: 'The Qurʾān gives each community its law, and records ʿĪsā and the Prophet modifying earlier precepts.',
    premises: [
      ['AM-CLAIM-000224', 'necessary', 'premise', 'report', 'To each community a law and a way.'],
      ['AM-CLAIM-000222', 'necessary', 'premise', 'report', 'ʿĪsā makes lawful some of what was forbidden.'],
      ['AM-CLAIM-000223', 'supporting', 'premise', 'report', 'The Prophet lifts earlier burdens.'],
    ],
    axioms: [['AM-AX-008', 'requires', 'Reads earlier law through the Qurʾān.']],
  }),
  derivation({
    code: 'AM-DRV-0016',
    claim: 'AM-CLAIM-000227',
    label: 'The law fulfilled in the risen Christ',
    summary: 'The risen Jesus declares the law of Moses fulfilled (3 Nephi 15).',
    premises: [
      ['AM-CLAIM-000226', 'necessary', 'premise', 'report', 'The declaration in 3 Nephi 15:4–5.'],
      ['AM-CLAIM-000220', 'supporting', 'premise', 'report', 'The Pauline parallel.'],
    ],
    axioms: [['AM-AX-011', 'requires', 'Treats the Book of Mormon as scripture.']],
  }),
  derivation({
    code: 'AM-DRV-0017',
    claim: 'AM-CLAIM-000246',
    label: 'Ibrāhīm the ḥanīf, whom the Prophet follows',
    summary: 'Ibrāhīm was neither Jew nor Christian; the Prophet is told to follow his religion; those who follow him have the best claim to him.',
    premises: [
      ['AM-CLAIM-000230', 'necessary', 'premise', 'report', 'Ibrāhīm a ḥanīf, neither Jew nor Christian.'],
      ['AM-CLAIM-000232', 'necessary', 'premise', 'report', 'Follow the milla of Ibrāhīm.'],
      ['AM-CLAIM-000233', 'necessary', 'premise', 'report', 'Those who follow him have the best claim.'],
      ['AM-CLAIM-000231', 'supporting', 'premise', 'report', 'Ibrāhīm and Ismāʿīl pray for a messenger.'],
    ],
    axioms: [
      ['AM-AX-008', 'requires', 'Reads Ibrāhīm through the Qurʾān.'],
      ['AM-AX-009', 'strengthened_by', 'Explains why the Qurʾān’s portrait governs where it differs from Genesis.'],
    ],
  }),
  derivation({
    code: 'AM-DRV-0018',
    claim: 'AM-CLAIM-000246',
    label: 'A covenant conditioned on righteousness, not lineage',
    summary:
      'An independent route: God’s covenant does not extend to wrongdoers among Ibrāhīm’s descendants, so descent alone does not make an heir; revelation is one line from Ibrāhīm to Muhammad.',
    premises: [
      ['AM-CLAIM-000234', 'necessary', 'premise', 'report', 'The covenant excludes wrongdoers (Q 2:124).'],
      ['AM-CLAIM-000233', 'necessary', 'premise', 'report', 'Heirs are those who follow him.'],
      ['AM-CLAIM-000235', 'supporting', 'premise', 'report', 'One line of revelation, without distinction.'],
    ],
    axioms: [['AM-AX-008', 'requires', 'Reads the covenant through the Qurʾān.']],
  }),
  derivation({
    code: 'AM-DRV-0019',
    claim: 'AM-CLAIM-000247',
    label: 'The covenant line through Isaac',
    summary: 'Genesis establishes the covenant with Isaac; converts join it and call Abraham father.',
    premises: [
      ['AM-CLAIM-000242', 'necessary', 'premise', 'report', 'Genesis 17:19–21 and 21:12.'],
      ['AM-CLAIM-000243', 'supporting', 'premise', 'report', 'The son of the binding is Isaac.'],
      ['AM-CLAIM-000245', 'supporting', 'evidence', 'report', 'Converts call Abraham “our father”.'],
    ],
    axioms: [
      ['AM-AX-010', 'requires', 'Genesis as received governs the terms of the covenant.'],
      ['AM-AX-007', 'strengthened_by', 'The rulings on converts are rabbinic.'],
    ],
  }),
  derivation({
    code: 'AM-DRV-0020',
    claim: 'AM-CLAIM-000248',
    label: 'Heirs by faith',
    summary: 'Paul reckons Abraham’s children by faith, and the promised offspring as Christ’s.',
    premises: [
      ['AM-CLAIM-000244', 'necessary', 'premise', 'report', 'Galatians 3:7, 29; Romans 4:16.'],
      ['AM-CLAIM-000242', 'supporting', 'premise', 'report', 'The promise first given in Genesis.'],
    ],
    axioms: [['AM-AX-001', 'requires', 'Treats Paul’s reading of Genesis as normative.']],
  }),
  derivation({
    code: 'AM-DRV-0021',
    claim: 'AM-CLAIM-000249',
    label: 'The seal of the prophets',
    summary: 'Q 33:40 names Muhammad the seal of the prophets; the Qurʾān stands guardian over earlier revelation.',
    premises: [
      ['AM-CLAIM-000238', 'necessary', 'premise', 'report', 'khātam al-nabiyyīn.'],
      ['AM-CLAIM-000236', 'supporting', 'premise', 'report', 'Confirming and muhaymin.'],
      ['AM-CLAIM-000237', 'supporting', 'lemma', 'warrant', 'The stronger sense of muhaymin.'],
    ],
    axioms: [['AM-AX-008', 'requires', 'Reads khātam as finality on the Qurʾān’s authority.']],
  }),
  derivation({
    code: 'AM-DRV-0022',
    claim: 'AM-CLAIM-000269',
    label: 'From the Restoration scriptures',
    summary: 'The churches had departed from the ordinances and broken the everlasting covenant.',
    premises: [
      ['AM-CLAIM-000268', 'necessary', 'premise', 'report', 'Joseph Smith—History 1:19 and D&C 1:15.'],
    ],
    axioms: [['AM-AX-011', 'requires', 'Treats Restoration scripture as revelation.']],
  }),
  derivation({
    code: 'AM-DRV-0023',
    claim: 'AM-CLAIM-000270',
    label: 'Restoration by angelic conferral',
    summary:
      'Authority lost in the Apostasy was restored by messengers who held it: John the Baptist for the Aaronic priesthood, Peter, James and John for the Melchizedek.',
    premises: [
      ['AM-CLAIM-000260', 'necessary', 'premise', 'report', 'D&C 13: the Aaronic priesthood conferred.'],
      ['AM-CLAIM-000261', 'necessary', 'premise', 'report', 'D&C 27:12: apostles ordained by Peter, James and John.'],
      ['AM-CLAIM-000269', 'necessary', 'lemma', 'warrant', 'Restoration presupposes that authority was lost.'],
      ['AM-CLAIM-000264', 'supporting', 'premise', 'report', 'The two priesthoods named in D&C 107.'],
      ['AM-CLAIM-000265', 'supporting', 'premise', 'report', 'The Melchizedek lineage of D&C 84.'],
      ['AM-CLAIM-000266', 'supporting', 'premise', 'report', 'The Book of Mormon’s order of the Son.'],
    ],
    axioms: [['AM-AX-011', 'requires', 'Treats Restoration scripture as revelation.']],
  }),
  derivation({
    code: 'AM-DRV-0024',
    claim: 'AM-CLAIM-000274',
    label: 'Unbroken episcopal succession',
    summary: 'The apostles provided for successors; the second-century church appealed to succession as the guarantee of apostolic teaching.',
    premises: [
      ['AM-CLAIM-000272', 'necessary', 'evidence', 'report', '1 Clement 42–44.'],
      ['AM-CLAIM-000273', 'necessary', 'evidence', 'report', 'Irenaeus, Against Heresies 3.3.'],
      ['AM-CLAIM-000271', 'supporting', 'premise', 'report', 'The promise that the gates of Hades will not prevail.'],
    ],
    axioms: [['AM-AX-012', 'requires', 'Succession transmits apostolic authority.']],
  }),
];
