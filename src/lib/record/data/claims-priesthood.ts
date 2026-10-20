/**
 * Christian studies flagship: priesthood under the New Covenant.
 *
 * AM-CLAIM-000184 to 000191 are the earlier public Claim Ledger. Revision 1 of each
 * is that record verbatim (from live-import.ts), provisional because no editorial
 * verification of it was ever recorded (see IMPORTED_STATUS). Revision 2 adds the
 * formal metadata the ledger lacked — editions, variants, a confidence profile
 * on separate axes, tradition acceptance — without changing the statement.
 *
 * AM-CLAIM-000192 onward are new in this migration.
 */

import type { Claim, ClaimRevision } from '../schema';
import type { ClaimClassification, ClaimRole } from '../taxonomy';
import {
  IMPORTED_STATUS,
  NOT_RECORDED,
  REPORT_CONFIDENCE,
  accept,
  attributed,
  claim,
  conf,
  newClaim,
  revision,
  scholarship,
  type RevisionInput,
} from './build';
import { LIVE_CLAIMS } from './live-import';

const CASE = 'priesthood-new-covenant';

const CLASS_BY_LABEL: Record<string, ClaimClassification> = {
  'Explicit textual proposition': 'textual_proposition',
  'Exegetical lemma': 'exegetical_lemma',
  'Doctrinal inference': 'inference',
};

function live(code: string) {
  const l = LIVE_CLAIMS.find((c) => c.code === code);
  if (!l) throw new Error(`No live claim ${code}`);
  return l;
}

/** Revision 1: the earlier public record, exactly; awaiting editorial review. */
export function liveRevision(code: string): ClaimRevision {
  const l = live(code);
  const classification = CLASS_BY_LABEL[l.claim_type];
  if (!classification) throw new Error(`Unmapped claim type "${l.claim_type}"`);
  return revision(1, {
    status: IMPORTED_STATUS,
    publishedAt: l.updated_at,
    statement: l.statement,
    classification,
    headline: l.textual_confidence as ClaimRevision['headlineConfidence'],
    disputed: l.disputed,
    divergence: l.interpretive_divergence,
    witnesses: l.sources,
    confidence: null,
    attribution:
      classification === 'inference'
        ? { kind: 'tradition', traditions: [], note: 'Attribution was recorded in the interpretive divergence field.' }
        : undefined,
    provenance: l.provenance.map(({ label, detail }) => ({ label, detail })),
    changeNote: 'Published in the AbrahamMoses Claim Ledger.',
    machine: NOT_RECORDED,
  });
}

const REV2_NOTE =
  'Formal metadata added: editions, evidence notes, variants, a confidence profile on separate axes and tradition acceptance. Derivations recorded with AND/OR structure. Statement unchanged.';

function liveClaim(
  code: string,
  role: ClaimRole,
  cases: string[],
  rev2: Partial<RevisionInput> & Pick<RevisionInput, 'confidence'>,
): Claim {
  const r1 = liveRevision(code);
  const l = live(code);
  return claim({
    code,
    role,
    topic: l.topic,
    cases,
    revisions: [
      r1,
      revision(2, {
        statement: l.statement,
        classification: r1.classification,
        headline: r1.headlineConfidence,
        disputed: l.disputed,
        divergence: l.interpretive_divergence,
        witnesses: l.sources,
        provenance: r1.provenanceNotes,
        attribution: r1.attribution,
        changeNote: REV2_NOTE,
        ...rev2,
      }),
    ],
  });
}

export const PRIESTHOOD_CLAIMS: Claim[] = [
  liveClaim('AM-CLAIM-000184', 'thesis', [CASE, 'restoration-priesthood-authority'], {
    evidence: [
      ['Hebrews 5:10', 'Hebrews names him high priest after the order of Melchizedek a fourth time.'],
      ['Psalm 110:4', 'The phrase Hebrews repeats is quoted from the psalm.'],
    ],
    variants: [
      {
        reference: 'Hebrews 7:17',
        description:
          'Hebrews quotes Psalm 110:4 in its Septuagint wording (κατὰ τὴν τάξιν Μελχισέδεκ, LXX Psalm 109:4). No known variant in Hebrews affects the phrase.',
        bearing: 'none',
      },
    ],
    confidence: REPORT_CONFIDENCE(
      [5, 'The phrase is stable across the major witnesses to Hebrews 5:6, 6:20 and 7:17.'],
      [5, 'In Greek, Μελχισέδεκ is unambiguously a proper name and τάξις an order or rank.'],
    ),
  }),
  liveClaim('AM-CLAIM-000185', 'thesis', [CASE, 'torah-permanence'], {
    evidence: [
      ['Hebrews 8:8–12', 'Hebrews quotes the passage in full.'],
      ['LXX Jeremiah 38:31–34', 'The Septuagint numbering of the same passage.'],
    ],
    variants: [
      {
        reference: 'Jeremiah 31:32',
        description:
          'Where the Masoretic Text reads “though I was a husband to them” (bāʿaltî), the Septuagint (38:32) reads “and I disregarded them”; Hebrews 8:9 follows the Septuagint. The difference does not affect the announcement of a new covenant.',
        bearing: 'minor',
      },
    ],
    confidence: REPORT_CONFIDENCE(
      [4, 'Stable in the Masoretic Text; the Septuagint differs at 31:32 in a clause that does not alter the proposition.'],
      [
        4,
        '“New covenant” (bərît ḥădāšâ) is clear. Whether “new” means renewed or replaced is the interpretive divergence, not a question about the wording.',
      ],
    ),
  }),
  liveClaim('AM-CLAIM-000186', 'thesis', [CASE], {
    evidence: [
      ['Genesis 14:18–20', 'The only other passage in the Hebrew Bible that names Melchizedek.'],
      ['NJPS Psalm 110:4', 'Renders the clause “a rightful king by My decree”, reading malkî-ṣedeq as a title.'],
      ['b. Nedarim 32b', 'A rabbinic reading that applies the psalm to Abraham.'],
    ],
    variants: [
      {
        reference: 'Psalm 110:3',
        description:
          'Verse 3 is textually difficult and the Septuagint (109:3) differs substantially. The difficulty does not reach the declaration in verse 4.',
        bearing: 'none',
      },
    ],
    confidence: conf({
      textual: [4, 'Verse 4 is stable; the textual difficulty of verse 3 does not bear on it.'],
      philological: [
        3,
        'ʿal-dibrātî malkî-ṣedeq is traditionally rendered “after the order of Melchizedek”; NJPS renders “a rightful king by My decree”, taking malkî-ṣedeq as a title rather than a name.',
      ],
      historical: [null],
      inferential: [5, 'Stated in the psalm, on either rendering of the name.'],
    }),
  }),
  liveClaim('AM-CLAIM-000187', 'thesis', [CASE, 'ibrahim-heirs-and-revelation'], {
    disputed: 'Partly — whether the promise is “unconditional” is an inference; see the evidence notes.',
    evidence: [
      ['Genesis 15:17–18', 'God alone passes between the pieces, the basis for reading the promise as unconditional.'],
      ['Genesis 17:1', 'The promise is preceded by a command to walk before God and be blameless.'],
      ['Genesis 17:9–14', 'Circumcision is the covenant obligation of Abraham’s descendants.'],
      ['Genesis 26:5', 'The promise to Isaac is grounded in Abraham’s obedience.'],
    ],
    confidence: conf({
      textual: [5, 'The cited passages are stable in the Masoretic Text.'],
      philological: [4],
      historical: [null],
      inferential: [
        3,
        'Descendants, land and blessing are stated outright. “Unconditional” is inferred from Genesis 15, while 17:1, 17:9–14 and 26:5 attach obligations or ground the promise in obedience.',
      ],
    }),
  }),
  liveClaim('AM-CLAIM-000188', 'thesis', [CASE, 'torah-permanence'], {
    evidence: [
      ['Exodus 29:9', 'The priesthood is given to Aaron’s line as “a statute forever”.'],
      ['Numbers 18:1–7', 'Distinguishes the Aaronide priests from the Levites who assist them.'],
    ],
    confidence: conf({
      textual: [5],
      philological: [5],
      historical: [
        null,
        'The claim reports what the Pentateuch presents. How the priesthood developed historically is a separate question the claim does not make.',
      ],
      inferential: [4, 'A synthesis of the cited passages read together; no contested assumption is required.'],
    }),
  }),
  liveClaim('AM-CLAIM-000189', 'lemma', [CASE], {
    quotations: [
      { text: 'without father or mother… resembling the Son of God', reference: 'Hebrews 7:3', translation: 'esv-2016' },
    ],
    confidence: conf({
      textual: [5],
      philological: [
        4,
        'ἀπάτωρ, ἀμήτωρ, ἀγενεαλόγητος are clear. Whether ἀφωμοιωμένος (“made like”) concerns the likeness of the portrayal or of nature is debated.',
      ],
      historical: [null],
      inferential: [5, 'A report of the reading Hebrews makes.'],
    }),
  }),
  liveClaim('AM-CLAIM-000190', 'lemma', [CASE, 'torah-permanence'], {
    confidence: conf({
      textual: [5],
      philological: [
        4,
        'μετάθεσις νόμου (7:12) — a “change” or “transfer” of law — is clear in sense; its scope is the interpretive divergence.',
      ],
      historical: [null],
      inferential: [5, 'A report of the argument Hebrews makes.'],
    }),
  }),
  liveClaim('AM-CLAIM-000191', 'parent', [CASE], {
    attribution: attributed(
      ['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical'],
      'Held across Christian traditions, with the differences of framing recorded in the acceptance matrix.',
    ),
    evidence: [
      ['Hebrews 7:11–19', 'The priesthood argument.'],
      ['Hebrews 8:6–13', 'The covenant argument, an independent derivation.'],
    ],
    confidence: conf({
      textual: [5, 'The cited passages are textually secure.'],
      philological: [4],
      historical: [null, 'A theological claim about priestly orders. Historical method does not adjudicate it.'],
      inferential: [
        3,
        'Follows from Hebrews only if apostolic exegesis is authoritative (AM-AX-001). The priesthood argument also requires typology (AM-AX-002); the covenant argument does not.',
      ],
    }),
    acceptance: accept(
      ['catholic', 'affirms', 'Framed as the fulfilment of the Levitical priesthood in Christ’s one sacrifice.'],
      ['eastern-orthodox', 'affirms', null],
      ['lutheran', 'affirms', null],
      ['reformed', 'qualifies', 'Framed as fulfilment within one covenant of grace (AM-AX-003), not replacement.'],
      ['evangelical', 'affirms', null],
      [
        'dispensational',
        'qualifies',
        'The Levitical order is superseded for the church; the new covenant’s promises to Israel and Judah remain to be fulfilled.',
      ],
      [
        'latter-day-saint',
        'qualifies',
        'The law of Moses is fulfilled in Christ; the Melchizedek priesthood is also held as an office by ordained men.',
        ['3 Nephi 15:4–5', 'D&C 107:1–4'],
      ],
      ['rabbinic-judaism', 'rejects', 'The Levitical order is suspended by the loss of the Temple, not superseded.'],
      [
        'sunni-islam',
        'not_addressed',
        'Priesthood is not a category of Islamic theology; the comparable question concerns prophetic authority and law.',
      ],
      ['shia-islam', 'not_addressed', 'As for Sunni Islam.'],
      ['historical-critical', 'not_addressed', 'Describes Hebrews’ argument historically and sets the theological claim aside.'],
    ),
  }),

  /* ---------------- New in this migration ---------------- */

  newClaim('AM-CLAIM-000192', 'thesis', 'Covenant', [CASE, 'torah-permanence'], {
    statement:
      'Hebrews says that in speaking of a new covenant God has made the first one old, and that what is growing old is ready to vanish.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Hebrews states',
    divergence:
      'Traditions differ on whether “the first covenant” means the Sinai covenant as a whole or its sacrificial order, and on whether the obsolescence is completed or ongoing.',
    witnesses: ['Hebrews 8:13'],
    evidence: [['Hebrews 8:6–12', 'The conclusion follows Hebrews’ quotation of Jeremiah 31:31–34.']],
    confidence: REPORT_CONFIDENCE(
      [5],
      [4, 'πεπαλαίωκεν (“has made old”) is clear; whether it means “declared obsolete” or “made to age” is a nuance.'],
    ),
  }),
  newClaim('AM-CLAIM-000193', 'thesis', 'Priesthood', [CASE, 'restoration-priesthood-authority'], {
    statement:
      'Hebrews contrasts the many Levitical priests, prevented by death from continuing in office, with Jesus, who holds his priesthood permanently because he continues forever.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Hebrews states',
    divergence:
      'Whether “permanently” excludes any priesthood held by others, or describes only the permanence of Christ’s own, is disputed (see AM-CLAIM-000194).',
    witnesses: ['Hebrews 7:23–24'],
    confidence: REPORT_CONFIDENCE([5], [3, 'The sense of ἀπαράβατος in 7:24 is debated; see AM-CLAIM-000194.']),
  }),
  newClaim('AM-CLAIM-000194', 'lemma', 'Priesthood', [CASE, 'restoration-priesthood-authority'], {
    statement:
      'The adjective ἀπαράβατος in Hebrews 7:24 is glossed by the standard lexica as “permanent, unchangeable”; the sense “not passing to another” is argued from the contrast with succession in 7:23.',
    classification: 'philological_claim',
    headline: 'Moderate',
    disputed: 'Partly',
    divergence:
      'Protestant readings often take the word to exclude any priestly successor. Catholic and Latter-day Saint readings take it to describe the permanence of Christ’s own priesthood without excluding a priesthood participated in or conferred.',
    witnesses: ['Hebrews 7:24'],
    evidence: [['BDAG s.v. ἀπαράβατος', 'Standard New Testament lexicon.']],
    confidence: conf({
      textual: [5],
      philological: [3, 'The lexical sense is established; the contextual sense “non-transferable” is debated.'],
      historical: [null],
      inferential: [4, 'A report of the lexical evidence and of the contextual argument made from it.'],
    }),
    attribution: scholarship(),
  }),
  newClaim('AM-CLAIM-000195', 'thesis', 'Priesthood', [CASE, 'torah-permanence'], {
    statement:
      'In the Masoretic Text, Jeremiah 33:17–18 promises that the Levitical priests will never lack a man to offer sacrifices; the passage (33:14–26) is absent from the Septuagint.',
    classification: 'textual_proposition',
    headline: 'High',
    disputed: 'No — regarding the two textual forms',
    divergence:
      'Whether the promise refers to a restored Levitical cult or is read figuratively depends on which text is authoritative and how prophetic promises to Israel are read (AM-AX-004).',
    witnesses: ['Jeremiah 33:17–18'],
    evidence: [['Jeremiah 33:14–26', 'The whole passage is a Masoretic plus.']],
    variants: [
      {
        reference: 'Jeremiah 33:14–26',
        description:
          'Present in the Masoretic Text and absent from the Septuagint, which preserves a shorter edition of Jeremiah. The variant bears directly on whether “Jeremiah promises” this at all.',
        bearing: 'material',
      },
    ],
    confidence: conf({
      textual: [
        3,
        'The proposition is stated so as to hold on both textual forms. A claim that “Jeremiah promises” this without qualification would sit at level 2.',
      ],
      philological: [5],
      historical: [null],
      inferential: [5],
    }),
  }),
  newClaim('AM-CLAIM-000196', 'thesis', 'Priesthood', [CASE, 'torah-permanence'], {
    statement: 'Numbers grants Phinehas and his descendants “a covenant of perpetual priesthood”.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No',
    divergence: 'Whether “perpetual” (ʿôlām) means everlasting or enduring for an age is debated (see AM-CLAIM-000218).',
    witnesses: ['Numbers 25:13'],
    quotations: [{ text: 'a covenant of perpetual priesthood', reference: 'Numbers 25:13', translation: 'editorial-literal' }],
    confidence: REPORT_CONFIDENCE([5], [3, 'The duration implied by ʿôlām is debated; see AM-CLAIM-000218.']),
  }),
  newClaim('AM-CLAIM-000197', 'position', 'Priesthood', [CASE], {
    statement:
      'The Levitical priesthood is suspended by the loss of the Temple, not superseded: no later priesthood abrogates the Torah’s priestly order.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence: 'Held in Rabbinic Judaism; rejected by Christian traditions, which hold the Levitical order fulfilled in Christ.',
    witnesses: ['Numbers 25:13', 'Exodus 29:9', 'Jeremiah 33:17–18'],
    evidence: [
      ['Hosea 3:4–5', 'Israel will live “many days” without sacrifice and afterward return.'],
      ['Maimonides, Mishneh Torah Kings and Wars 11:1', 'The messianic king restores the Temple and its offerings.'],
    ],
    confidence: conf({
      textual: [4, 'The Pentateuchal witnesses are secure; the Jeremiah witness is a Masoretic plus (AM-CLAIM-000195).'],
      philological: [3, 'Turns partly on the sense of ʿôlām (AM-CLAIM-000218).'],
      historical: [null],
      inferential: [3, 'Follows if the Torah is unabrogated (AM-AX-005) or if prophetic promises to Israel keep their plain sense (AM-AX-004).'],
    }),
    attribution: attributed(['rabbinic-judaism'], 'Reproduced from counter-model AM-CM-001 as a position so it can be tested on the same terms.'),
    acceptance: accept(
      ['rabbinic-judaism', 'affirms', null],
      ...['catholic', 'eastern-orthodox', 'lutheran', 'reformed', 'evangelical'].map(
        (t) => [t, 'rejects', 'Holds the Levitical priesthood fulfilled in Christ.'] as [string, 'rejects', string],
      ),
      [
        'dispensational',
        'disputes',
        'Some dispensational interpreters expect a restored temple and sacrifices in the millennium, understood as memorial rather than atoning.',
        ['Ezekiel 37:24–28'],
      ],
      ['latter-day-saint', 'rejects', 'Holds the law of Moses fulfilled in Christ.', ['3 Nephi 15:4–5']],
      ['sunni-islam', 'not_addressed', 'Priesthood is not a category of Islamic theology.'],
      ['shia-islam', 'not_addressed', 'As for Sunni Islam.'],
    ),
  }),
  newClaim('AM-CLAIM-000198', 'thesis', 'Priesthood', [CASE], {
    statement:
      'Lumen Gentium 10 teaches that the common priesthood of the faithful and the ministerial priesthood differ in essence and not only in degree, while each in its own way shares in the one priesthood of Christ.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the document teaches',
    divergence: 'Protestant traditions reject a ministerial priesthood distinct in essence from that of all believers.',
    witnesses: ['Lumen Gentium 10'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000199', 'position', 'Priesthood', [CASE], {
    statement:
      'The ministerial priesthood of bishops and priests participates in the one priesthood of Christ and is conferred by sacramental ordination.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence: 'Held in Catholic and Orthodox teaching; rejected in Protestant traditions.',
    witnesses: ['Lumen Gentium 10', 'Council of Trent Session 23'],
    confidence: conf({
      textual: [5],
      philological: [4],
      historical: [null],
      inferential: [3, 'Follows if Christ is high priest as Hebrews says (AM-AX-001) and if apostolic succession transmits authority (AM-AX-012).'],
    }),
    attribution: attributed(['catholic', 'eastern-orthodox']),
    acceptance: accept(
      ['catholic', 'affirms', null, ['Lumen Gentium 10']],
      ['eastern-orthodox', 'affirms', null],
      ['lutheran', 'rejects', 'Ordained ministry is a public office of word and sacrament, not a sacrificing priesthood.'],
      ['reformed', 'rejects', null],
      ['evangelical', 'rejects', null],
      ['dispensational', 'rejects', null],
      ['latter-day-saint', 'rejects', 'Holds that the authority to ordain was lost and later restored.'],
      ['rabbinic-judaism', 'not_addressed', null],
    ),
  }),
  newClaim('AM-CLAIM-000200', 'thesis', 'Priesthood', [CASE, 'restoration-priesthood-authority'], {
    statement: '1 Peter and Revelation call the community of believers a priesthood: “a royal priesthood” and “priests to God”.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the texts state',
    divergence:
      'Catholic and Orthodox teaching reads these texts as the common priesthood alongside a ministerial one; Protestant traditions read them as excluding a separate sacrificing priesthood.',
    witnesses: ['1 Peter 2:9', '1 Peter 2:5', 'Revelation 1:6'],
    evidence: [['Exodus 19:6', '1 Peter 2:9 echoes the Sinai designation of Israel as “a kingdom of priests”.']],
    quotations: [
      { text: 'a royal priesthood', reference: '1 Peter 2:9', translation: 'world-english-bible' },
      { text: 'priests to God', reference: 'Revelation 1:6', translation: 'editorial-literal' },
    ],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000201', 'thesis', 'Priesthood', [CASE], {
    statement:
      'In To the Christian Nobility (1520), Luther argues that all baptized Christians belong to the spiritual estate and are consecrated priests.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what Luther argues',
    divergence: 'Lutheran churches retain an ordained ministry; how it relates to the priesthood of all the baptized is debated within Lutheranism.',
    witnesses: ['Luther, To the Christian Nobility'],
    confidence: REPORT_CONFIDENCE(),
  }),
  newClaim('AM-CLAIM-000202', 'position', 'Priesthood', [CASE, 'restoration-priesthood-authority'], {
    statement:
      'Christ alone holds the Melchizedekian priesthood, permanently; all believers share a common priesthood, and no sacrificing priesthood is transmitted to ministers.',
    classification: 'doctrinal_interpretation',
    headline: 'Moderate',
    disputed: 'Yes',
    divergence: 'Held in Protestant traditions; rejected in Catholic, Orthodox and Latter-day Saint teaching.',
    witnesses: ['Hebrews 7:23–24', '1 Peter 2:9'],
    evidence: [['Luther, To the Christian Nobility', 'Classic Reformation statement of the common priesthood.']],
    confidence: conf({
      textual: [5],
      philological: [3, 'The exclusive reading leans on a debated sense of ἀπαράβατος (AM-CLAIM-000194).'],
      historical: [null],
      inferential: [3, 'Follows if apostolic exegesis is authoritative (AM-AX-001) and Scripture alone is the rule (AM-AX-013).'],
    }),
    attribution: attributed(['lutheran', 'reformed', 'evangelical', 'dispensational']),
    acceptance: accept(
      ['lutheran', 'affirms', 'Retains an ordained ministry of word and sacrament, not a sacrificing priesthood.'],
      ['reformed', 'affirms', null],
      ['evangelical', 'affirms', null],
      ['dispensational', 'affirms', null],
      ['catholic', 'rejects', null, ['Lumen Gentium 10']],
      ['eastern-orthodox', 'rejects', null],
      ['latter-day-saint', 'rejects', 'Holds the Melchizedek priesthood to be conferred on ordained men.', ['D&C 107:1–4']],
      ['rabbinic-judaism', 'not_addressed', null],
    ),
  }),
  newClaim('AM-CLAIM-000203', 'thesis', 'Priesthood', [CASE], {
    statement:
      'The Council of Trent (Session 23, 1563) teaches that the New Testament has a visible and external priesthood, instituted by Christ and conferred in the sacrament of order.',
    classification: 'textual_proposition',
    headline: 'Very high',
    disputed: 'No — regarding what the council teaches',
    divergence: 'Rejected in Protestant traditions, against which the decree was framed.',
    witnesses: ['Council of Trent Session 23'],
    confidence: REPORT_CONFIDENCE(),
  }),
];
