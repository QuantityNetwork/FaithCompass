/**
 * Islamic studies flagship: Ibrāhīm, prophetic lineage and revelation.
 *
 * Asked in the Qurʾān's own categories — millat Ibrāhīm, ḥanīf, nubuwwa,
 * taṣdīq and muhaymin, taḥrīf — rather than as a question about Genesis. The
 * Jewish and Christian answers are recorded beside it, and where the traditions
 * disagree about which text governs rather than about what a text means, the
 * record says so.
 *
 * New in the October 2026 migration; every revision is provisional.
 */

import type { Claim } from '../schema';
import { REPORT_CONFIDENCE, accept, attributed, conf, newClaim, scholarship } from './build';

const CASE = 'ibrahim-heirs-and-revelation';
const CHRISTIAN = ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical', 'dispensational'];

export const IBRAHIM_CLAIMS: Claim[] = [
  newClaim('AM-CLAIM-000230', 'thesis', 'Abraham', [CASE], {
    statement:
      'The Qurʾān says Ibrāhīm was neither a Jew nor a Christian, but a ḥanīf, a muslim (one who submits), and not one of the polytheists.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the Qurʾān states',
    divergence:
      'Whether muslim here names the later community or the act of submission is discussed in tafsīr; Jewish and Christian traditions do not accept the claim’s content.',
    witnesses: ['Q 3:67'],
    evidence: [['Q 3:65', 'Why argue about Ibrāhīm, when the Torah and the Gospel were revealed after him?']],
    confidence: REPORT_CONFIDENCE([5], [4, 'ḥanīf is a recognised but debated term; muslim is ambiguous between a name and a description.']),
  }),
  newClaim('AM-CLAIM-000231', 'thesis', 'Abraham', [CASE], {
    statement:
      'The Qurʾān presents Ibrāhīm and Ismāʿīl raising the foundations of the House and praying that a messenger be sent from among their descendants.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the Qurʾān states',
    divergence: 'Islamic tradition identifies the House with the Kaʿba in Mecca and the prayed-for messenger with Muhammad; Genesis has no parallel.',
    witnesses: ['Q 2:127–129'],
    evidence: [
      ['Q 2:125', 'The House made a place of return and safety; the station of Ibrāhīm.'],
      ['Q 3:96–97', 'The first House established for people, at Bakka.'],
    ],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000232', 'thesis', 'Abraham', [CASE], {
    statement: 'The Qurʾān instructs the Prophet to follow the religion (milla) of Ibrāhīm, the ḥanīf, who was not of the polytheists.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the Qurʾān states',
    divergence: 'Basis for the Islamic self-understanding as the restoration of Ibrāhīm’s religion.',
    witnesses: ['Q 16:123', 'Q 2:135'],
    evidence: [
      ['Q 4:125', 'Who is better in religion than one who follows the milla of Ibrāhīm?'],
      ['Q 16:120', 'Ibrāhīm was a community (umma) in himself, devoutly obedient, a ḥanīf.'],
    ],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000233', 'thesis', 'Abraham', [CASE], {
    statement:
      'The Qurʾān says the people with the best claim to Ibrāhīm are those who followed him, this Prophet, and those who believe.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the Qurʾān states',
    divergence: 'Defines Ibrāhīm’s heirs by following rather than by descent; compare Galatians 3:7 (AM-CLAIM-000244).',
    witnesses: ['Q 3:68'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000234', 'thesis', 'Covenant', [CASE], {
    statement:
      'The Qurʾān says God made Ibrāhīm a leader (imām) for humankind and, when he asked about his descendants, answered that the covenant does not extend to wrongdoers.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the Qurʾān states',
    divergence:
      'Shiʿi exegesis reads the verse as establishing the imamate as a divinely appointed rank that no wrongdoer can hold; Sunni exegesis reads imām more generally as an exemplary leader.',
    witnesses: ['Q 2:124'],
    evidence: [['Ṭabāṭabāʾī, al-Mīzān on Q 2:124', 'The Shiʿi reading of the verse as grounding the imamate.']],
    quotations: [{ text: 'My covenant does not include the wrongdoers', reference: 'Q 2:124', translation: 'editorial-literal' }],
    confidence: REPORT_CONFIDENCE(),
    acceptance: accept(
      ['sunni-islam', 'affirms', 'Reads imām as an exemplary leader.'],
      ['shia-islam', 'affirms', 'Reads the verse as grounding the imamate.', ['Ṭabāṭabāʾī, al-Mīzān on Q 2:124']],
    ),
  }),
  newClaim('AM-CLAIM-000235', 'thesis', 'Revelation', [CASE], {
    statement:
      'The Qurʾān places the revelation to Muhammad in one line with revelation to Nūḥ, Ibrāhīm, Ismāʿīl, Isḥāq, Yaʿqūb, the Tribes, ʿĪsā and others, and says believers make no distinction between any of them.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No',
    divergence: 'The continuity is read in Islamic tradition as one religion revealed repeatedly.',
    witnesses: ['Q 4:163', 'Q 2:136'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000236', 'thesis', 'Revelation', [CASE], {
    statement:
      'The Qurʾān describes itself as confirming the scripture before it and as muhaymin over it.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding the wording',
    divergence: 'What muhaymin implies for the authority of earlier scripture is the philological question in AM-CLAIM-000237.',
    witnesses: ['Q 5:48'],
    evidence: [['Q 3:3', 'Sent down the Book confirming what was before it, as he sent down the Torah and the Gospel.']],
    confidence: REPORT_CONFIDENCE([5], [3, 'The sense of muhaymin is debated; see AM-CLAIM-000237.']),
  }),
  newClaim('AM-CLAIM-000237', 'lemma', 'Revelation', [CASE], {
    statement:
      'Classical exegetes gloss muhaymin variously as “witness”, “trustee” and “guardian” over earlier scripture; the stronger sense of an authority that judges it is the basis of the Qurʾān’s precedence in Islamic teaching.',
    classification: 'philological_claim',
    headline: 'Moderate',
    disputed: 'Partly',
    divergence: 'The weaker glosses describe confirmation; the stronger make the Qurʾān the criterion by which earlier scripture is read.',
    witnesses: ['Q 5:48'],
    evidence: [
      ['al-Ṭabarī, Jāmiʿ al-bayān on Q 5:48', 'Collects the early glosses.'],
      ['Lane, Arabic-English Lexicon s.v. هيمن', 'Classical Arabic lexicography.'],
    ],
    confidence: conf({
      textual: [5],
      philological: [3, 'Several early glosses are recorded; none is the sole reading.'],
      historical: [null],
      inferential: [4],
    }),
    attribution: scholarship(),
  }),
  newClaim('AM-CLAIM-000238', 'thesis', 'Prophethood', [CASE], {
    statement: 'The Qurʾān calls Muhammad “the Messenger of God and the seal of the prophets” (khātam al-nabiyyīn).',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding the wording',
    divergence:
      'Sunni and Shiʿi scholarship reads “seal” as the last of the prophets; the Ahmadiyya Muslim Community reads it as the seal that attests prophets (AM-CM-012).',
    witnesses: ['Q 33:40'],
    confidence: REPORT_CONFIDENCE([5], [4, 'khātam is “seal”; whether a seal closes or authenticates is the divergence.']),
  }),
  newClaim('AM-CLAIM-000239', 'thesis', 'Scripture', [CASE], {
    statement: 'The Qurʾān speaks of some among the People of the Book distorting words from their places (yuḥarrifūna al-kalim).',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding the wording',
    divergence: 'Whether this means distorting the meaning or altering the text is the question recorded in AM-CLAIM-000240.',
    witnesses: ['Q 4:46', 'Q 5:13', 'Q 2:75'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000240', 'thesis', 'Scripture', [CASE], {
    statement:
      'Muslim scholars distinguish distortion of meaning (taḥrīf al-maʿnā) from alteration of the wording (taḥrīf al-lafẓ); Ibn Ḥazm (d. 1064) is the best-known classical proponent of extensive textual alteration of the Torah and the Gospels.',
    classification: 'historical_claim',
    headline: 'High',
    disputed: 'No — regarding the history of the debate',
    divergence: 'Which view prevails varies by period and author; both have long histories in Islamic thought.',
    witnesses: ['Ibn Ḥazm, al-Fiṣal'],
    evidence: [
      ['Adang, Muslim Writers on Judaism', 'Survey of Muslim engagement with the Hebrew Bible to Ibn Ḥazm.'],
      ['Nickel, Narratives of Tampering', 'The earliest commentaries on the taḥrīf verses.'],
    ],
    confidence: conf({
      textual: [null],
      philological: [4],
      historical: [4, 'Documented in the primary works and in independent modern studies.'],
      inferential: [4],
    }),
    attribution: scholarship(),
  }),
  newClaim('AM-CLAIM-000241', 'thesis', 'Abraham', [CASE], {
    statement:
      'The Qurʾān’s account of Ibrāhīm’s sacrifice does not name the son; Isḥāq’s birth is announced after it. Early authorities were divided on whether the son was Ismāʿīl or Isḥāq — al-Ṭabarī favoured Isḥāq — and later Sunni exegesis, notably Ibn Kathīr, settled on Ismāʿīl.',
    classification: 'historical_claim',
    headline: 'High',
    disputed: 'Partly',
    divergence: 'Genesis names Isaac (AM-CLAIM-000243). Within Islam the identification is a matter of exegesis, not of the Qurʾān’s wording.',
    witnesses: ['Q 37:100–113'],
    evidence: [
      ['al-Ṭabarī, Jāmiʿ al-bayān on Q 37:102', 'Reports both identifications and argues for Isḥāq.'],
      ['Ibn Kathīr, Tafsīr on Q 37:112', 'Argues for Ismāʿīl.'],
      ['Firestone, Journeys in Holy Lands', 'The development of the traditions.'],
    ],
    confidence: conf({
      textual: [5, 'The Qurʾānic wording is secure; it names no son in the sacrifice narrative.'],
      philological: [5],
      historical: [4, 'The division of early opinion is documented in the tafsīr and in modern study.'],
      inferential: [4],
    }),
    attribution: scholarship(),
  }),
  newClaim('AM-CLAIM-000242', 'thesis', 'Covenant', [CASE, 'torah-permanence'], {
    statement:
      'Genesis says God will establish his covenant with Isaac, while Ishmael is blessed and will become a great nation.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Genesis states',
    divergence: 'Islamic tradition does not treat the Genesis account as governing (AM-AX-009).',
    witnesses: ['Genesis 17:19–21', 'Genesis 21:12'],
    evidence: [['Genesis 21:13', 'The son of the slave woman will also be made a nation.']],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000243', 'thesis', 'Abraham', [CASE], {
    statement: 'In Genesis, God tells Abraham to offer “your son, your only son, whom you love, Isaac”.',
    classification: 'quotation',
    headline: 'Very high',
    disputed: 'No',
    divergence: '“Only son” while Ishmael lives is itself discussed in Jewish and Christian exegesis; Islamic exegesis divides on the son’s identity (AM-CLAIM-000241).',
    witnesses: ['Genesis 22:2'],
    quotations: [{ text: 'your son, your only son, whom you love, Isaac', reference: 'Genesis 22:2', translation: 'world-english-bible' }],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000244', 'thesis', 'Abraham', [CASE], {
    statement: 'Paul writes that those who are of faith are the children of Abraham, and that those who belong to Christ are Abraham’s offspring.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Paul writes',
    divergence: 'Defines Abraham’s heirs by faith; compare Q 3:68 (AM-CLAIM-000233).',
    witnesses: ['Galatians 3:7', 'Galatians 3:29', 'Romans 4:16'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000245', 'thesis', 'Abraham', [CASE], {
    statement:
      'Rabbinic law allows a convert to call Abraham “our father”, since Abraham is “the father of a multitude of nations”; Maimonides rules the same in his letter to Obadiah the Proselyte.',
    classification: 'textual_proposition',
    headline: 'High',
    disputed: 'No — regarding the rulings',
    divergence: 'The Mishnah records an earlier, contrary ruling for the first-fruits declaration; the Jerusalem Talmud’s view became the accepted law.',
    witnesses: ['y. Bikkurim 1:4', 'Maimonides, Letter to Obadiah the Proselyte'],
    evidence: [['Genesis 17:5', 'The verse the ruling reads.']],
    confidence: REPORT_CONFIDENCE([4, 'Both texts are well attested; wording varies between editions of the letter.']),
  }),
  newClaim('AM-CLAIM-000246', 'position', 'Abraham', [CASE], {
    statement:
      'The heirs of Ibrāhīm are those who follow his religion, and the message given to Muhammad restores the religion of Ibrāhīm (millat Ibrāhīm), confirming and safeguarding earlier revelation.',
    classification: 'doctrinal_interpretation',
    headline: 'High',
    disputed: 'Yes — between traditions',
    divergence:
      'Islamic answer, framed in Islamic categories. It disagrees with the Jewish position less about what Genesis means than about which text governs (AM-AX-009).',
    witnesses: ['Q 3:67', 'Q 3:68', 'Q 16:123', 'Q 2:124'],
    confidence: conf({
      textual: [5],
      philological: [4],
      historical: [null],
      inferential: [
        3,
        'Two independent derivations — from the Qurʾān’s portrait of Ibrāhīm, and from its conditioning of the covenant on righteousness. Both require AM-AX-008.',
      ],
    }),
    attribution: attributed(['sunni-islam', 'shia-islam']),
    acceptance: accept(
      ['sunni-islam', 'affirms', null],
      ['shia-islam', 'affirms', 'Additionally reads Q 2:124 as grounding the imamate in Ibrāhīm’s line.'],
      ['rabbinic-judaism', 'rejects', null],
      ...CHRISTIAN.map((t) => [t, 'rejects', null] as [string, 'rejects', null]),
      ['latter-day-saint', 'rejects', null],
    ),
  }),
  newClaim('AM-CLAIM-000247', 'position', 'Abraham', [CASE], {
    statement:
      'God’s covenant with Abraham passes through Isaac and Jacob to Israel; those who join Israel become children of Abraham, but the covenant line itself is not defined by belief alone.',
    classification: 'doctrinal_interpretation',
    headline: 'High',
    disputed: 'Yes — between traditions',
    divergence: 'Rabbinic answer. Disagrees with the Islamic position about which text governs, and with the Pauline position about how heirs are reckoned.',
    witnesses: ['Genesis 17:19–21', 'Genesis 21:12', 'y. Bikkurim 1:4'],
    confidence: conf({
      textual: [5],
      philological: [5],
      historical: [null],
      inferential: [3, 'Follows if Genesis as received is authoritative (AM-AX-010).'],
    }),
    attribution: attributed(['rabbinic-judaism']),
    acceptance: accept(
      ['rabbinic-judaism', 'affirms', null],
      ['sunni-islam', 'rejects', null],
      ['shia-islam', 'rejects', null],
      ...CHRISTIAN.map((t) => [t, 'qualifies', 'Accepts the Isaac line in Genesis; reckons Abraham’s heirs by faith (AM-CLAIM-000248).'] as [string, 'qualifies', string]),
    ),
  }),
  newClaim('AM-CLAIM-000248', 'position', 'Abraham', [CASE], {
    statement: 'Abraham’s heirs are those who share his faith, whatever their descent; the promise is fulfilled in Christ.',
    classification: 'doctrinal_interpretation',
    headline: 'High',
    disputed: 'Yes — between traditions',
    divergence: 'Christian answer, grounded in Paul. Structurally close to the Qurʾānic definition by following (Q 3:68), on a different authority.',
    witnesses: ['Galatians 3:7', 'Galatians 3:29', 'Romans 4:16'],
    confidence: conf({
      textual: [5],
      philological: [5],
      historical: [null],
      inferential: [3, 'Follows if apostolic exegesis is authoritative (AM-AX-001).'],
    }),
    attribution: attributed(CHRISTIAN),
    acceptance: accept(
      ...CHRISTIAN.map((t) => [t, 'affirms', null] as [string, 'affirms', null]),
      [
        'latter-day-saint',
        'qualifies',
        'Those who receive the gospel are counted as Abraham’s seed, through covenant and ordinance.',
        ['Abraham 2:10'],
      ],
      ['rabbinic-judaism', 'rejects', null],
      ['sunni-islam', 'rejects', 'Reckons heirs by following Ibrāhīm’s religion as restored in the Qurʾān.'],
      ['shia-islam', 'rejects', 'As for Sunni Islam.'],
    ),
  }),
  newClaim('AM-CLAIM-000249', 'position', 'Prophethood', [CASE], {
    statement: 'Muhammad is the last of the prophets: prophethood ends with him, and no revelation after the Qurʾān is binding.',
    classification: 'doctrinal_interpretation',
    headline: 'High',
    disputed: 'Yes — within and between traditions',
    divergence: 'Held by Sunni and Shiʿi Islam; read differently by the Ahmadiyya Muslim Community (AM-CM-012).',
    witnesses: ['Q 33:40'],
    confidence: conf({
      textual: [5],
      philological: [4, 'Rests on reading khātam as “last” (AM-CLAIM-000238).'],
      historical: [null],
      inferential: [3, 'Follows if the Qurʾān is the final, authoritative revelation (AM-AX-008).'],
    }),
    attribution: attributed(['sunni-islam', 'shia-islam']),
    acceptance: accept(
      ['sunni-islam', 'affirms', null],
      ['shia-islam', 'affirms', 'Prophethood ends with Muhammad; the imamate continues as a distinct office.'],
      ['latter-day-saint', 'rejects', 'Holds that prophets continue to be called.', ['Articles of Faith 9']],
      ['rabbinic-judaism', 'not_addressed', 'Does not receive Muhammad as a prophet; the question of his finality is not its own.'],
    ),
  }),
];
