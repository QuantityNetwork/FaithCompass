/**
 * Jewish studies flagship: can the commandments given at Sinai be changed?
 *
 * The question is asked in the terms of Jewish legal and exegetical
 * tradition — the permanence of the mitzvot, the authority of prophecy and of
 * the sages — and the other traditions' answers are recorded as answers to
 * their own, different questions rather than as rebuttals.
 *
 * New in the October 2026 migration; every revision is provisional.
 */

import type { Claim } from '../schema';
import { REPORT_CONFIDENCE, accept, attributed, conf, newClaim, scholarship } from './build';

const CASE = 'torah-permanence';
const CHRISTIAN = ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical', 'dispensational'];

export const TORAH_CLAIMS: Claim[] = [
  newClaim('AM-CLAIM-000210', 'thesis', 'Torah', [CASE], {
    statement: 'Deuteronomy commands that nothing be added to, or taken away from, the commandments it gives.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Deuteronomy states',
    divergence:
      'Whether the command binds later prophets and revelation, or only forbids the people altering the law, is where readings divide.',
    witnesses: ['Deuteronomy 4:2', 'Deuteronomy 13:1'],
    evidence: [['Deuteronomy 13:1', 'Numbered 12:32 in English Bibles that follow the Vulgate versification.']],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000211', 'thesis', 'Torah', [CASE, 'priesthood-new-covenant'], {
    statement:
      'Several Pentateuchal commandments are designated “a statute forever” (ḥuqqat ʿôlām), among them Passover, the Day of Atonement and the Aaronide priesthood.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding the designation',
    divergence: 'What “forever” commits the reader to is the philological question recorded in AM-CLAIM-000218.',
    witnesses: ['Exodus 12:14', 'Leviticus 16:29–34', 'Exodus 29:9'],
    evidence: [['Leviticus 23:14', 'The formula recurs through the festival calendar (23:21, 31, 41).']],
    confidence: REPORT_CONFIDENCE([5], [3, 'The formula is clear; the duration ʿôlām implies is debated (AM-CLAIM-000218).']),
  }),
  newClaim('AM-CLAIM-000212', 'thesis', 'Torah', [CASE], {
    statement:
      'Deuteronomy says the commandment “is not in heaven”: it is near, in the mouth and the heart, to be done.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No',
    divergence:
      'Rabbinic tradition reads the verse as placing interpretation in human hands (AM-CLAIM-000213); Paul reads it of the word of faith (Romans 10:6–8).',
    witnesses: ['Deuteronomy 30:11–14'],
    evidence: [['Romans 10:6–8', 'Paul’s reading of the same verses.']],
    quotations: [{ text: 'It is not in heaven', reference: 'Deuteronomy 30:12', translation: 'jps-1917' }],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000213', 'thesis', 'Torah', [CASE], {
    statement:
      'The Babylonian Talmud (Bava Metzia 59b) applies “it is not in heaven” to rule that a heavenly voice cannot decide a question of law: the decision rests with the sages, by majority.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the passage narrates',
    divergence: 'How far the story licenses rabbinic legislative authority, as opposed to interpretive authority, is debated.',
    witnesses: ['b. Bava Metzia 59b'],
    confidence: REPORT_CONFIDENCE([4, 'Manuscripts of the passage differ in wording, not in the ruling it narrates.']),
  }),
  newClaim('AM-CLAIM-000214', 'lemma', 'Torah', [CASE], {
    statement:
      'The Talmud reads “These are the commandments” (Leviticus 27:34) to teach that from then on no prophet may introduce anything new.',
    classification: 'exegetical_lemma',
    headline: 'Very high',
    disputed: 'No — regarding what the Talmud teaches',
    divergence: 'The principle sits beside rules allowing a prophet temporary suspension (AM-CLAIM-000216).',
    witnesses: ['b. Shabbat 104a', 'b. Megillah 2b'],
    evidence: [['Leviticus 27:34', 'The verse the derivation reads.']],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000215', 'thesis', 'Torah', [CASE], {
    statement:
      'Maimonides rules that the Torah’s commandments stand forever, so that a prophet who claims to add or abrogate a commandment is a false prophet; he counts the Torah’s immutability among the thirteen principles of faith.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Maimonides rules',
    divergence: 'The thirteen principles are widely received but their status as binding dogma has been debated within Judaism.',
    witnesses: ['Maimonides, Mishneh Torah Yesodei HaTorah 9:1', 'Maimonides, Commentary on the Mishnah Sanhedrin 10:1'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000216', 'thesis', 'Torah', [CASE], {
    statement:
      'Rabbinic law allows a recognised prophet to suspend a commandment temporarily, for the need of the hour (horāʾat shāʿāh), citing Elijah’s sacrifice on Mount Carmel; it does not allow permanent abrogation.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the sources rule',
    divergence:
      'Read within the tradition as confirming permanence, since only a temporary measure is allowed; read by others as conceding that the law can be set aside.',
    witnesses: ['b. Yevamot 90b', 'Maimonides, Mishneh Torah Yesodei HaTorah 9:3'],
    evidence: [
      ['1 Kings 18:30–38', 'Elijah offers sacrifice outside the Temple.'],
      ['Deuteronomy 18:15', '“To him you shall listen,” the verse the ruling reads.'],
    ],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000217', 'thesis', 'Torah', [CASE], {
    statement: 'A Talmudic dictum holds that “the commandments will be annulled in the time to come.”',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the dictum says',
    divergence:
      'Most authorities read it of the dead or of the messianic future, not as permission to set the commandments aside now; some modern and Christian readers cite it as rabbinic precedent for change.',
    witnesses: ['b. Niddah 61b'],
    quotations: [{ text: 'the commandments will be annulled in the time to come', reference: 'b. Niddah 61b', translation: 'editorial-literal' }],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000218', 'lemma', 'Torah', [CASE, 'priesthood-new-covenant'], {
    statement:
      'In ḥuqqat ʿôlām the noun ʿôlām denotes perpetuity; its range also covers “a long, indefinite time”, and rabbinic exegesis itself reads it as limited in at least one case.',
    classification: 'philological_claim',
    headline: 'Moderate',
    disputed: 'Partly',
    divergence:
      'Read as “forever” in rabbinic tradition for the perpetual statutes. Christian interpreters often read it as “for the age” of the Sinai order, or as perpetual within that covenant’s own terms.',
    witnesses: ['Exodus 12:14', 'Exodus 21:6'],
    evidence: [
      ['HALOT s.v. עוֹלָם', 'Standard lexicon of Biblical Hebrew.'],
      ['Rashi on Exodus 21:6', 'Reads the slave’s service “forever” (le-ʿôlām) as lasting until the Jubilee.'],
    ],
    confidence: conf({
      textual: [5],
      philological: [3, 'The word’s range runs from “forever” to “a long time”; the perpetual sense is the majority reading for the statutes.'],
      historical: [null],
      inferential: [3, 'Applying the perpetual sense to every ḥuqqat ʿôlām is defeasible on the lexical evidence.'],
    }),
    attribution: scholarship(),
    acceptance: accept(
      ['rabbinic-judaism', 'affirms', 'For the perpetual statutes; exceptions such as Exodus 21:6 are read by tradition.'],
      ...CHRISTIAN.map((t) => [t, 'disputes', 'Commonly read as perpetual within the Sinai order, or as “for the age”.'] as [string, 'disputes', string]),
    ),
  }),
  newClaim('AM-CLAIM-000219', 'position', 'Torah', [CASE], {
    statement:
      'The commandments given at Sinai are permanent: no later prophet or revelation may abrogate them, and the authority to interpret and safeguard them operates within the Torah.',
    classification: 'doctrinal_interpretation',
    headline: 'High',
    disputed: 'Yes — between traditions',
    divergence:
      'The core of Rabbinic Judaism’s answer. In the priesthood case the same conclusion appears as a reading principle (AM-AX-005); here it is the conclusion under examination, with its own derivations.',
    witnesses: ['Deuteronomy 4:2', 'Deuteronomy 13:1', 'Maimonides, Mishneh Torah Yesodei HaTorah 9:1'],
    confidence: conf({
      textual: [5],
      philological: [3, 'The plain-sense derivation turns on ʿôlām (AM-CLAIM-000218).'],
      historical: [null],
      inferential: [
        4,
        'Two independent derivations: through rabbinic interpretation (needs AM-AX-007) and from the plain sense of Deuteronomy and the perpetual statutes (needs no axiom, but needs AM-CLAIM-000218).',
      ],
    }),
    attribution: attributed(['rabbinic-judaism']),
    acceptance: accept(
      ['rabbinic-judaism', 'affirms', null, ['Maimonides, Commentary on the Mishnah Sanhedrin 10:1']],
      ...['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical'].map(
        (t) => [t, 'rejects', 'Holds the ceremonial provisions fulfilled in Christ while the moral law endures.'] as [string, 'rejects', string],
      ),
      ['dispensational', 'rejects', 'The Mosaic law is not the rule of life in the church age.'],
      ['latter-day-saint', 'rejects', 'The law of Moses is fulfilled in Christ.', ['3 Nephi 15:4–5']],
      ['sunni-islam', 'rejects', 'Each community is given its own law; later revelation may modify earlier precepts.', ['Q 5:48']],
      ['shia-islam', 'rejects', 'As for Sunni Islam.', ['Q 5:48']],
    ),
  }),
  newClaim('AM-CLAIM-000220', 'thesis', 'Torah', [CASE], {
    statement: 'Paul calls the law a guardian (paidagōgos) until Christ, and says that after faith has come believers are no longer under it.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Paul writes',
    divergence:
      'Whether “no longer under” the guardian means the law is abolished, fulfilled, or no longer the means of righteousness is a major divergence between Christian traditions and within Pauline scholarship.',
    witnesses: ['Galatians 3:24–25'],
    evidence: [['Galatians 3:17', 'The law, coming 430 years after the promise, does not annul it.']],
    confidence: REPORT_CONFIDENCE([5], [4, 'παιδαγωγός is a child-minder or guardian, not a teacher; the sense is clear.']),
  }),
  newClaim('AM-CLAIM-000221', 'position', 'Torah', [CASE], {
    statement:
      'The Sinai covenant is fulfilled in Christ: its moral law endures, but its ceremonial provisions no longer bind those in the new covenant.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence:
      'Christian traditions agree that the ceremonial law no longer binds, and differ on how to divide the law and on the meaning of “fulfil”.',
    witnesses: ['Hebrews 8:13', 'Galatians 3:24–25', 'Romans 10:4'],
    evidence: [['Westminster Confession 19.3–4', 'The Reformed division of the law into moral, ceremonial and judicial.']],
    confidence: conf({
      textual: [5],
      philological: [3, 'Romans 10:4 turns on the sense of τέλος (AM-CLAIM-000228).'],
      historical: [null],
      inferential: [3, 'Follows if apostolic exegesis is authoritative (AM-AX-001).'],
    }),
    attribution: attributed(CHRISTIAN),
    acceptance: accept(
      ...['catholic', 'eastern-orthodox', 'lutheran', 'evangelical'].map((t) => [t, 'affirms', null] as [string, 'affirms', null]),
      ['reformed', 'affirms', null, ['Westminster Confession 19.3–4']],
      ['dispensational', 'qualifies', 'The Mosaic law as a whole is not the church’s rule of life; the law of Christ is.'],
      ['latter-day-saint', 'qualifies', 'Agrees the law of Moses is fulfilled; grounds this in the Book of Mormon (AM-CLAIM-000227).'],
      ['rabbinic-judaism', 'rejects', null],
    ),
  }),
  newClaim('AM-CLAIM-000222', 'thesis', 'Law', [CASE], {
    statement:
      'The Qurʾān has ʿĪsā say that he comes confirming the Torah before him and making lawful some of what had been forbidden.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the Qurʾān states',
    divergence: 'Which prohibitions are meant is discussed in tafsīr; the principle that a prophet may modify earlier law is not in dispute in Islamic tradition.',
    witnesses: ['Q 3:50'],
    quotations: [
      {
        text: 'confirming what was before me of the Torah, and to make lawful for you some of what was forbidden to you',
        reference: 'Q 3:50',
        translation: 'editorial-literal',
      },
    ],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000223', 'thesis', 'Law', [CASE], {
    statement:
      'The Qurʾān describes the unlettered prophet as one who makes lawful the good things, forbids the foul, and lifts the burdens and shackles that were upon those who follow him.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the Qurʾān states',
    divergence: 'Read in tafsīr as relieving burdens of earlier law; the scope is discussed.',
    witnesses: ['Q 7:157'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000224', 'thesis', 'Law', [CASE, 'ibrahim-heirs-and-revelation'], {
    statement: 'The Qurʾān says that to each community God has appointed a law and a way (shirʿa wa-minhāj).',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No',
    divergence: 'Whether the verse grounds the legitimacy of earlier laws for their communities, or only explains their difference, is discussed.',
    witnesses: ['Q 5:48'],
    quotations: [{ text: 'To each of you We have appointed a law and a way', reference: 'Q 5:48', translation: 'editorial-literal' }],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000225', 'position', 'Law', [CASE], {
    statement:
      'God gives each community a law; later revelation may lift or modify earlier precepts, and Muslims are bound by the law revealed to Muhammad.',
    classification: 'doctrinal_interpretation',
    headline: 'High',
    disputed: 'Yes — between traditions',
    divergence:
      'Islamic answer to a different question: not whether the Sinai law can change for Israel, but how successive revelations relate. Naskh between scriptures is distinct from abrogation within the Qurʾān, which is separately debated.',
    witnesses: ['Q 5:48', 'Q 3:50', 'Q 7:157'],
    confidence: conf({
      textual: [5],
      philological: [4],
      historical: [null],
      inferential: [3, 'Follows if the Qurʾān is the final, authoritative revelation (AM-AX-008).'],
    }),
    attribution: attributed(['sunni-islam', 'shia-islam']),
    acceptance: accept(
      ['sunni-islam', 'affirms', null],
      ['shia-islam', 'affirms', null],
      ['rabbinic-judaism', 'rejects', null],
      ...CHRISTIAN.map((t) => [t, 'rejects', 'Does not receive the Qurʾān as revelation.'] as [string, 'rejects', string]),
      ['latter-day-saint', 'rejects', null],
    ),
  }),
  newClaim('AM-CLAIM-000226', 'thesis', 'Law', [CASE], {
    statement:
      'In the Book of Mormon, the risen Jesus tells the people that the law given to Moses is fulfilled in him and therefore has an end.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the text states',
    divergence: 'Latter-day Saint teaching distinguishes the fulfilled law of Moses from covenants it holds continue.',
    witnesses: ['3 Nephi 15:4–5'],
    quotations: [{ text: 'the law in me is fulfilled', reference: '3 Nephi 15:5', translation: null }],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000227', 'position', 'Law', [CASE], {
    statement:
      'The law of Moses was fulfilled in Christ and its performances ended, while the covenant God made with Israel continues through the restored gospel.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes — between traditions',
    divergence: 'Agrees with other Christian traditions that the law is fulfilled, on the authority of Restoration scripture.',
    witnesses: ['3 Nephi 15:4–5'],
    confidence: conf({
      textual: [5],
      philological: [5],
      historical: [null],
      inferential: [3, 'Follows if Restoration scripture is revelation (AM-AX-011).'],
    }),
    attribution: attributed(['latter-day-saint']),
    acceptance: accept(
      ['latter-day-saint', 'affirms', null],
      ['rabbinic-judaism', 'rejects', null],
      ...CHRISTIAN.map((t) => [t, 'qualifies', 'Agrees the law is fulfilled in Christ; does not accept the Book of Mormon as its ground.'] as [string, 'qualifies', string]),
    ),
  }),
  newClaim('AM-CLAIM-000228', 'lemma', 'Torah', [CASE], {
    statement:
      'Paul’s statement that Christ is the τέλος of the law (Romans 10:4) can be read as its end (termination) or its goal (fulfilment); both senses are attested for the word.',
    classification: 'philological_claim',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence: 'A long-standing divergence in Pauline interpretation, cutting across confessional lines.',
    witnesses: ['Romans 10:4'],
    evidence: [['BDAG s.v. τέλος', 'Lists both “end, termination” and “goal, outcome”.']],
    confidence: conf({
      textual: [5],
      philological: [3, 'Both senses are attested; neither is the clear majority reading in scholarship.'],
      historical: [null],
      inferential: [4],
    }),
    attribution: scholarship(),
  }),
];
