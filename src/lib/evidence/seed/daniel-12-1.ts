/**
 * Flagship demonstration: Daniel 12:1.
 *
 * Chosen because one short verse carries claims of five different types at once
 * — textual, interpretive, canonical, theological and eschatological — which
 * are supported to genuinely different degrees. A system that scored the verse
 * as a single object would obscure exactly the distinction this product exists
 * to make.
 */

import type { SeededSubject } from './types';

export const DANIEL_12_1: SeededSubject = {
  id: 'analysis-daniel-12-1',
  slug: 'daniel/12/1',
  resourceType: 'PASSAGE',
  title: 'Daniel 12:1',
  subtitle: 'Every one who is found written in the book.',
  reference: {
    work: 'daniel',
    display: 'Daniel 12:1',
    chapter: 12,
    verse: 1,
    slug: 'daniel/12/1',
  },
  passageText:
    '"At that time shall arise Michael, the great prince who has charge of your people. And there shall be a time of trouble, such as never has been since there was a nation till that time. But at that time your people shall be delivered, everyone whose name shall be found written in the book."',
  passageAttribution: 'Daniel 12:1',
  summary:
    'Daniel 12:1 is among the most securely transmitted verses in the Hebrew Bible, and among the most contested in its interpretation. The wording is not seriously in doubt. What Michael is, what "the book" denotes, and what the passage says about resurrection are separate questions with separate evidence, and they do not resolve at the same level of confidence.',
  aliases: ['daniel 12:1', 'daniel 12', 'michael', 'daniel 12 1', 'dan 12:1'],
  claims: [
    /* ---------------- Claim 1: textual ---------------- */
    {
      statement:
        'The wording of Daniel 12:1 is securely reconstructed from the surviving manuscript tradition.',
      claimType: 'TEXTUAL',
      scope: 'Daniel 12:1, Hebrew consonantal text',
      rationale:
        'Before any interpretive question can be asked, the text being interpreted has to be established.',
      assessment: {
        summary:
          'The consonantal text of Daniel 12:1 is stable across witnesses separated by more than a millennium. Qumran fragments, the medieval Masoretic manuscripts and the two Greek traditions agree on the substance of the verse; the variants that exist are orthographic or stylistic and none of them alters the meaning.',
        scope: 'Daniel 12:1, Hebrew consonantal text',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Textual critics across confessional lines agree that Daniel\'s Hebrew and Aramaic text is well preserved. Disagreement in Daniel studies concentrates on date, genre and interpretation, not on wording. The one genuinely complex textual question in Daniel — the substantial divergence between the Old Greek and Theodotion in chapters 4–6 — does not affect chapter 12.',
        positionNote: null,
        assumptions: [
          'That the Qumran Daniel fragments and the Masoretic tradition descend from a shared textual line rather than having been harmonised later.',
          'That orthographic variation between witnesses is scribal rather than semantically motivated.',
        ],
        uncertainties: [
          'The Qumran Daniel manuscripts are fragmentary. Coverage of chapter 12 specifically is thinner than coverage of the book as a whole, so stability at this verse is partly inferred from stability across the book.',
          'No manuscript survives from between the second century BCE and the Greek codices, so the earliest centuries of transmission are reconstructed rather than observed.',
        ],
        whatWouldChangeThis: [
          'Discovery of a pre-Christian Hebrew Daniel manuscript preserving chapter 12 with substantive variants.',
          'Demonstration that the Qumran Daniel copies were corrected toward a proto-Masoretic standard, which would make their agreement evidence of standardisation rather than of stable transmission.',
          'A critical re-edition establishing that the Old Greek of Daniel 12 translated a materially different Hebrew Vorlage.',
        ],
        evidence: [
          {
            title: 'Daniel manuscripts from Qumran Cave 4',
            description:
              'Eight copies of Daniel were recovered at Qumran, the earliest dating to within roughly fifty years of the book reaching its final form — an unusually short gap between composition and surviving witness for any book of the Hebrew Bible.',
            sourceRef: 'ms.4qdan',
            relationship: 'SUPPORTS',
            dimension: 'manuscript_attestation',
            directness: 0.9,
            relevance: 0.95,
            independence: 1.0,
            excerpt: null,
            whyItMatters:
              'This collapses the interval in which undetected change could have occurred. For most of the Hebrew Bible the earliest witnesses stand many centuries after composition; for Daniel the gap is close to a single lifetime.',
          },
          {
            title: 'Agreement between Qumran witnesses and the Masoretic tradition',
            description:
              'Where the Qumran Daniel fragments overlap with Codex Leningradensis, the consonantal text agrees closely. Roughly eleven centuries separate the two, with no intervening Hebrew witness.',
            sourceRef: 'ms.leningradensis',
            relationship: 'SUPPORTS',
            dimension: 'transmission_stability',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'Agreement across that interval is the strongest available evidence that the intervening transmission was conservative, since the two witnesses had no opportunity to influence one another.',
          },
          {
            title: 'Critical apparatus of Biblia Hebraica Stuttgartensia',
            description:
              'The standard critical edition records no variant at Daniel 12:1 that affects the sense of the verse.',
            sourceRef: 'ed.bhs',
            relationship: 'SUPPORTS',
            dimension: 'transmission_stability',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.5,
            excerpt: null,
            whyItMatters:
              'Independence is discounted here: BHS is a diplomatic edition of Codex Leningradensis, so it is substantially the same witness rather than an additional one.',
          },
          {
            title: 'The two Greek traditions of Daniel',
            description:
              'Daniel survives in two distinct Greek forms, the Old Greek and the Theodotionic text, which diverge substantially in chapters 4–6. At chapter 12 they do not.',
            sourceRef: 'ed.gottingen-daniel',
            relationship: 'SUPPORTS',
            dimension: 'manuscript_attestation',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Two independent translations converging on the same Hebrew sense is stronger evidence than either alone. That the same tradition diverges sharply elsewhere in the book shows the agreement at chapter 12 is a real finding, not an artefact of how the editions were made.',
          },
          {
            title: 'Fragmentary coverage at chapter 12',
            description:
              'The Qumran Daniel manuscripts are damaged and do not preserve the entire book. Coverage of chapter 12 is thinner than the count of Daniel copies alone would suggest.',
            sourceRef: 'sch.tov-textual-criticism',
            relationship: 'WEAKLY_CHALLENGES',
            dimension: 'manuscript_attestation',
            directness: 0.7,
            relevance: 0.8,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The honest form of the claim is that Daniel as a book is exceptionally well attested early, and that this verse inherits that stability, rather than that this verse is itself preserved in eight second-century witnesses.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'manuscript_attestation',
            reasoningSummary:
              'Multiple early Hebrew copies plus two independent Greek translation traditions, tempered by fragmentary coverage at this specific verse.',
            strength: 0.88,
          },
          {
            dimensionType: 'transmission_stability',
            reasoningSummary:
              'Close agreement across an eleven-century gap with no intervening witness, and no sense-affecting variant in the critical apparatus.',
            strength: 0.92,
          },
          {
            dimensionType: 'dating_confidence',
            reasoningSummary:
              'Palaeographic and radiocarbon dating of the Qumran copies is well established and narrowly bounded.',
            strength: 0.85,
          },
          {
            dimensionType: 'provenance',
            reasoningSummary:
              'Qumran provenance is archaeologically documented; the medieval codices have a continuous custodial history.',
            strength: 0.85,
          },
          {
            dimensionType: 'scholarly_consensus',
            reasoningSummary:
              'Textual critics across confessional lines agree the wording is not in serious doubt.',
            strength: 0.9,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The wording is supported across early and geographically distributed manuscript traditions, with no major variant affecting the central meaning.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'This claim concerns what the text says, not whether the events it describes occurred. Historical corroboration is not the relevant axis and is not scored.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'Establishing the wording is prior to interpreting it. Interpretive confidence is assessed on the claims that follow, not on this one.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'Eight Daniel copies from Qumran, the earliest within roughly fifty years of the book\'s final form.',
            'Close agreement between the Qumran witnesses and Codex Leningradensis across eleven centuries with no intervening Hebrew witness.',
            'Two independent Greek translation traditions converge at chapter 12, though they diverge sharply in chapters 4–6.',
            'No sense-affecting variant recorded in the standard critical apparatus.',
          ],
          lowering: [
            'The Qumran fragments are damaged; coverage of chapter 12 is thinner than coverage of the book overall.',
            'No Hebrew manuscript survives between the second century BCE and the medieval codices, so the intervening transmission is inferred.',
            'BHS is not an independent witness to Codex Leningradensis; it is an edition of it.',
          ],
          uncertainties: [
            'Whether apparent stability reflects conservative copying or later standardisation toward a proto-Masoretic text.',
          ],
          assumptions: [
            'That the Qumran and Masoretic lines are genuinely independent descendants of a common text.',
          ],
          alternativeInterpretations: [],
          missingEvidence: [
            'A Hebrew witness to Daniel 12 from between the second century BCE and the medieval period.',
          ],
          scholarlyDisagreements: [
            'None material to the wording. Daniel is disputed on date and genre, not on text.',
          ],
          conclusion:
            'The wording of Daniel 12:1 is about as securely established as anything in the Hebrew Bible. This is a claim about the text, and it says nothing about whether any interpretation of the text is correct.',
        },
        certaintyBreakdown: {
          certain: [
            'Daniel is attested at Qumran in multiple copies from the second and first centuries BCE.',
            'The Masoretic text of Daniel 12:1 contains no sense-affecting variant in the standard apparatus.',
          ],
          probable: [
            'The consonantal text of this verse stood substantially as we have it by the second century BCE.',
          ],
          possible: [
            'Minor orthographic variation existed in lines of transmission that have not survived.',
          ],
          speculative: [
            'That an earlier form of the verse differed in substance from the received text.',
          ],
          unknown: [
            'What the text looked like in the first decades after composition, before the earliest surviving copy.',
          ],
        },
        penalties: {
          missingEvidence: 0.15,
          sourceDependence: 0.2,
          chronologyUncertainty: 0.1,
          interpretiveAmbiguity: 0.05,
          scholarlyDisagreement: 0.05,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 2: Michael as heavenly prince ---------------- */
    {
      statement:
        'Michael is presented in Daniel as a heavenly prince associated with Daniel\'s people.',
      claimType: 'INTERPRETIVE',
      scope: 'Daniel 10:13, 10:21, 12:1',
      rationale:
        'This is what the text says about Michael on its own terms, before any question of his rank or identity arises.',
      assessment: {
        summary:
          'The text states this almost explicitly. Daniel calls Michael a "prince" three times and twice ties him specifically to Daniel\'s people. Reaching this reading requires no assumption the passage does not itself supply, which is why it sits at the top of the interpretive range.',
        scope: 'Daniel 10:13, 10:21, 12:1',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Critical, Jewish, Catholic and evangelical commentators agree on this point. It is one of the few interpretive questions in Daniel 10–12 where the literature is not divided, because the reading is close to a paraphrase of the text.',
        positionNote: null,
        assumptions: [
          'That the Hebrew sar in these verses carries its ordinary sense of a ruling or commanding figure rather than a specialised technical sense.',
          'That "your people" in Daniel 12:1 refers to Israel, as the surrounding narrative frame indicates.',
        ],
        uncertainties: [
          'The text describes Michael\'s function, not his nature. What kind of being a heavenly "prince" is remains open at this level.',
        ],
        whatWouldChangeThis: [
          'Lexical evidence that sar in Second Temple Hebrew apocalyptic carried a sense incompatible with a commanding heavenly figure.',
          'A manuscript tradition in which "your people" is absent or refers to a different group.',
        ],
        evidence: [
          {
            title: 'Daniel calls Michael "one of the chief princes"',
            description:
              'At Daniel 10:13 Michael is introduced as one of the foremost princes, and at 10:21 as "your prince" — the patron of Daniel\'s own people, set against the angelic patrons of Persia and Greece.',
            sourceRef: 'ed.bhs',
            relationship: 'SUPPORTS',
            dimension: 'linguistic_fit',
            directness: 0.95,
            relevance: 1.0,
            independence: 0.8,
            excerpt: 'Michael, one of the chief princes, came to help me… Michael, your prince.',
            whyItMatters:
              'The claim is made by the text about itself. Little inferential distance separates the words from the reading.',
          },
          {
            title: 'The national-patron structure of Daniel 10',
            description:
              'Daniel 10 sets out a structure in which nations have angelic patrons who contend with one another, and places Michael in that structure on Israel\'s side.',
            sourceRef: 'sch.collins-daniel',
            relationship: 'SUPPORTS',
            dimension: 'canonical_correspondence',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The reading is not extracted from an isolated phrase; it is the framework the whole vision is built on, which makes it much harder to explain away.',
          },
          {
            title: 'Independent convergence in the Anchor Bible commentary',
            description:
              'Hartman and Di Lella reach the same reading of Michael\'s role from a Catholic scholarly tradition working independently of Collins.',
            sourceRef: 'sch.hartman-dilella-daniel',
            relationship: 'SUPPORTS',
            dimension: 'interpretive_consensus',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Two major commentaries in different confessional traditions converging by separate routes is worth more than either restating the other.',
          },
          {
            title: 'Michael as commanding figure at Qumran',
            description:
              'The War Scroll depicts Michael as a commanding angelic figure in eschatological conflict, in a Jewish community close in time to Daniel.',
            sourceRef: 'ms.1qm',
            relationship: 'SUPPORTS',
            dimension: 'ancient_reception',
            directness: 0.7,
            relevance: 0.8,
            independence: 0.95,
            excerpt: null,
            whyItMatters:
              'Shows the reading is not a modern imposition: readers within a century or two of the text, in its own language and thought-world, understood Michael this way.',
          },
          {
            title: 'Jewish scholarly annotation',
            description:
              'The Jewish Study Bible reads Michael in Daniel as Israel\'s angelic patron within the same national-patron framework.',
            sourceRef: 'sch.jewish-study-bible',
            relationship: 'SUPPORTS',
            dimension: 'interpretive_consensus',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'A reading of Daniel from within the Jewish tradition, not summarised from outside it, and it agrees.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'linguistic_fit',
            reasoningSummary:
              'The Hebrew sar is used plainly and repeatedly, with no lexical strain in the reading.',
            strength: 0.92,
          },
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'The reading is the organising framework of Daniel 10–12 rather than an inference from a single phrase.',
            strength: 0.9,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'Second Temple Jewish sources close in time and language read Michael the same way.',
            strength: 0.85,
          },
          {
            dimensionType: 'interpretive_consensus',
            reasoningSummary:
              'Agreement across critical, Jewish, Catholic and evangelical commentary.',
            strength: 0.9,
          },
          {
            dimensionType: 'cultural_fit',
            reasoningSummary:
              'National angelic patrons are a recognised feature of Second Temple Jewish thought.',
            strength: 0.85,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The verses carrying this reading are among the best-attested in Daniel, with no relevant variant. The manuscript evidence is assessed in full as Claim 01; no textual evidence is cited separately here, because the difficulty with this claim is interpretive rather than textual.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'The claim is about what the text presents, not about whether an angelic prince exists. Historical corroboration cannot bear on it.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'Near-explicit textual support, a coherent literary framework, early reception agreement and cross-confessional convergence.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'Daniel explicitly describes Michael as a prince, three times.',
            'Daniel 10:21 ties him directly to Daniel\'s own people.',
            'The national-patron structure of Daniel 10 makes the reading the framework of the vision, not an inference from one phrase.',
            'The War Scroll shows readers close in time and language reading Michael the same way.',
            'Critical, Jewish, Catholic and evangelical commentators converge.',
          ],
          lowering: [
            'The text describes Michael\'s function, not his nature; this reading does not settle what kind of being he is.',
            'Every witness is a reading of the same passage, so the convergence is less independent than the number of sources suggests.',
          ],
          uncertainties: [
            'The precise force of "one of the chief princes" — whether it implies a fixed hierarchy or a looser prominence.',
          ],
          assumptions: [
            'That sar carries its ordinary sense here rather than a specialised technical one.',
          ],
          alternativeInterpretations: [
            'That "prince" is a purely honorific title carrying no implication of rank or agency — a reading the surrounding conflict narrative makes difficult.',
          ],
          missingEvidence: [
            'Second Temple lexical evidence bearing directly on the technical range of sar in apocalyptic contexts.',
          ],
          scholarlyDisagreements: [
            'None material. Disagreement in Daniel 10–12 concerns Michael\'s rank and identity, not this description.',
          ],
          conclusion:
            'The identification of Michael as a heavenly prince associated with Israel is about as strongly supported as an interpretive claim can be, because it is close to a paraphrase of what the text states.',
        },
        certaintyBreakdown: {
          certain: [
            'Daniel applies the title "prince" to Michael and associates him with Daniel\'s people.',
          ],
          probable: [
            'The author intended Michael as Israel\'s angelic patron within a structure of national patrons.',
          ],
          possible: [
            'That "one of the chief princes" implies a defined hierarchy rather than general prominence.',
          ],
          speculative: [
            'Reconstructions of a specific angelic rank system underlying the phrase.',
          ],
          unknown: [
            'Whether the author drew on an established angelology or shaped one for this vision.',
          ],
        },
        penalties: {
          missingEvidence: 0.1,
          sourceDependence: 0.3,
          chronologyUncertainty: 0.05,
          interpretiveAmbiguity: 0.15,
          scholarlyDisagreement: 0.05,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 3: Michael as archangelic figure ---------------- */
    {
      statement: 'Michael is a high-ranking angelic being.',
      claimType: 'CANONICAL',
      scope: 'Daniel 10 and 12, read alongside Jude 9, Revelation 12:7 and Second Temple sources',
      rationale:
        'A step beyond the previous claim: it moves from Michael\'s function in Daniel to his standing across the canon.',
      assessment: {
        summary:
          'Strongly supported when the canon is read as a whole. Jude names Michael an archangel outright and Revelation shows him commanding angels; Daniel itself calls him one of the chief princes. The step down from the previous claim is real but small: Daniel alone does not define his rank, and the texts that do are two to three centuries later.',
        scope: 'Daniel 10 and 12, with Jude 9, Revelation 12:7 and Second Temple parallels',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'That Michael is a chief or archangelic figure is agreed across Jewish, Catholic, Orthodox, Protestant and critical scholarship. The disputed questions are what "archangel" implied in the first century and whether Daniel\'s author already held a developed angelic hierarchy.',
        positionNote: null,
        assumptions: [
          'That New Testament usage may legitimately inform how Michael is understood canonically, even though Jude and Revelation are later than Daniel.',
          'That the Greek archangelos maps onto the hierarchy Daniel\'s "chief princes" implies.',
        ],
        uncertainties: [
          'Whether Daniel\'s author held a defined angelic hierarchy, or whether the hierarchy is a later systematisation read back into the text.',
          'How much of the developed angelology is owed to 1 Enoch rather than to Daniel.',
        ],
        whatWouldChangeThis: [
          'Second Temple evidence showing "chief prince" and "archangel" were not equivalent categories.',
          'Demonstration that Jude 9 depends on a source that did not treat Michael as an angel at all.',
          'Earlier Jewish evidence of a competing angelology in which Michael held no elevated rank.',
        ],
        evidence: [
          {
            title: 'Jude explicitly calls Michael an archangel',
            description:
              'Jude 9 uses archangelos of Michael — the only place in the New Testament where the word is applied to him by name.',
            sourceRef: 'anc.jude',
            relationship: 'SUPPORTS',
            dimension: 'canonical_correspondence',
            directness: 0.95,
            relevance: 0.95,
            independence: 0.8,
            excerpt: 'But when the archangel Michael, contending with the devil…',
            whyItMatters:
              'The most direct canonical statement available. It is also two to three centuries later than Daniel, so it evidences first-century understanding rather than authorial intent.',
          },
          {
            title: 'Michael commands angels in Revelation 12',
            description:
              'Revelation 12:7 depicts "Michael and his angels" fighting the dragon — Michael as commander of an angelic force.',
            sourceRef: 'anc.revelation12',
            relationship: 'SUPPORTS',
            dimension: 'canonical_correspondence',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.5,
            excerpt: 'Now war arose in heaven, Michael and his angels fighting against the dragon.',
            whyItMatters:
              'Independence is discounted deliberately: Revelation draws heavily on Danielic imagery, so it partly restates Daniel rather than corroborating it from outside.',
          },
          {
            title: 'Angelic hierarchy in 1 Enoch',
            description:
              '1 Enoch names a set of chief angels including Michael, in a Jewish apocalyptic text roughly contemporary with Daniel.',
            sourceRef: 'anc.1enoch',
            relationship: 'SUPPORTS',
            dimension: 'ancient_reception',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'Close in time and thought-world to Daniel, and largely independent of it. This is the strongest evidence that a ranked angelology was already in circulation rather than imposed later.',
          },
          {
            title: 'Daniel\'s own phrase does not fix a rank',
            description:
              '"One of the chief princes" places Michael among several prominent figures without specifying a hierarchy, an office, or how many such figures there are.',
            sourceRef: 'sch.collins-daniel',
            relationship: 'WEAKLY_CHALLENGES',
            dimension: 'linguistic_fit',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The specific claim "Michael is the archangel" is weaker than "Michael is a high-ranking angelic being". Daniel supports the second and underdetermines the first.',
          },
          {
            title: 'Textual security of the passages at issue',
            description:
              'Daniel 10 and 12 are preserved among the Qumran Daniel copies, and the relevant New Testament texts are well attested. No party to this question is working from a disputed reading.',
            sourceRef: 'ms.4qdan',
            relationship: 'SUPPORTS',
            dimension: 'manuscript_attestation',
            directness: 0.7,
            relevance: 0.8,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Worth stating explicitly: the disagreement about Michael\'s rank is interpretive, not textual. Establishing that closes off one line of dispute before it starts.',
          },
          {
            title: 'Patristic reception',
            description:
              'Hippolytus, in the earliest surviving Christian commentary on Daniel, reads Michael as an exalted angelic figure.',
            sourceRef: 'anc.hippolytus-daniel',
            relationship: 'SUPPORTS',
            dimension: 'ancient_reception',
            directness: 0.7,
            relevance: 0.75,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Early Christian reading of Daniel, roughly four centuries after composition, and independent of the New Testament witnesses.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'Explicit designation in Jude and a commanding role in Revelation, discounted for Revelation\'s dependence on Daniel.',
            strength: 0.88,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              '1 Enoch and Hippolytus attest an elevated Michael independently across four centuries.',
            strength: 0.85,
          },
          {
            dimensionType: 'linguistic_fit',
            reasoningSummary:
              '"One of the chief princes" supports elevation but does not fix a specific rank.',
            strength: 0.72,
          },
          {
            dimensionType: 'interpretive_consensus',
            reasoningSummary: 'Agreed across every major tradition and in critical scholarship.',
            strength: 0.9,
          },
          {
            dimensionType: 'manuscript_attestation',
            reasoningSummary: 'All relevant texts are well attested; none rests on a disputed reading.',
            strength: 0.88,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'Every text bearing on this claim is well attested, with no relevant variant.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'Whether an angelic being exists is not adjudicable by historical method. This claim is assessed canonically.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'Strong canonical support, with a real gap between what Daniel says and what later texts specify.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'Daniel explicitly describes Michael as a prince.',
            'Daniel 10 associates Michael with heavenly conflict.',
            'Jude explicitly calls Michael an archangel.',
            'Revelation depicts Michael commanding angels.',
            '1 Enoch attests a ranked angelology in circulation at roughly Daniel\'s own date.',
          ],
          lowering: [
            '"Prince" does not by itself define Michael\'s complete ontology.',
            'Jude and Revelation are two to three centuries later than Daniel and cannot settle authorial intent.',
            'Revelation depends on Danielic imagery, so it corroborates less independently than it appears to.',
            'Later theological traditions interpret Michael differently.',
          ],
          uncertainties: [
            'Whether Daniel\'s author held a developed angelic hierarchy or a looser notion of heavenly prominence.',
          ],
          assumptions: [
            'That later canonical usage may legitimately inform the reading of an earlier text.',
          ],
          alternativeInterpretations: [
            'That Michael is a heavenly figure of a kind not well captured by the later category "angel".',
            'That "archangel" in Jude reflects first-century systematisation rather than Daniel\'s own categories.',
          ],
          missingEvidence: [
            'Second Temple lexical evidence on whether "chief prince" and "archangel" were equivalent.',
          ],
          scholarlyDisagreements: [
            'Not over Michael\'s elevation, but over how developed the angelology behind Daniel was.',
          ],
          conclusion:
            'The identification of Michael as a high-ranking angelic being is strongly supported, while more specific claims about his exact rank remain less certain.',
        },
        certaintyBreakdown: {
          certain: [
            'Jude applies the word "archangel" to Michael.',
            'Daniel places Michael among the chief princes.',
          ],
          probable: [
            'Daniel\'s author regarded Michael as pre-eminent among heavenly beings.',
          ],
          possible: [
            'That a defined angelic hierarchy with fixed ranks stands behind Daniel\'s language.',
          ],
          speculative: [
            'Reconstructions specifying Michael\'s precise position within such a hierarchy.',
          ],
          unknown: [
            'How much of the developed angelology Daniel inherited and how much it originated.',
          ],
        },
        penalties: {
          missingEvidence: 0.2,
          sourceDependence: 0.35,
          chronologyUncertainty: 0.25,
          interpretiveAmbiguity: 0.25,
          scholarlyDisagreement: 0.1,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 4: Michael = Christ ---------------- */
    {
      statement: 'Michael in Daniel 12:1 is to be identified with Jesus Christ.',
      claimType: 'THEOLOGICAL',
      scope: 'Daniel 12:1, read christologically',
      rationale:
        'A serious minority reading with real defenders and real historical pedigree. It has to be assessed rather than dismissed.',
      assessment: {
        summary:
          'A minority theological interpretation with a genuine history — Calvin held it, and it remains the position of several Protestant bodies. The textual case is thin: it depends on inferences from shared imagery rather than on anything Daniel says, and Jude 9 tells against it by having Michael decline to rebuke the devil in his own authority. Assessed as weakly supported by the evidence, which is not the same as false.',
        scope: 'Daniel 12:1, read christologically',
        scholarlyPosition: 'MINORITY_POSITION',
        scholarlyLandscape:
          'A minority position in Christian interpretation and essentially absent from Jewish and critical scholarship. It is held today chiefly by Seventh-day Adventist and Jehovah\'s Witness traditions, and it was held by some Reformation-era interpreters including Calvin. Catholic and Orthodox theology reject it, treating Michael as a creature and Christ as uncreated.',
        positionNote: 'Minority theological interpretation.',
        assumptions: [
          'That "prince" language in Daniel carries a christological rather than an angelological sense.',
          'That the figure of Daniel 12:1 may be identified with the "one like a son of man" of Daniel 7.',
          'That the New Testament\'s use of Michael is compatible with an identification the New Testament never makes.',
        ],
        uncertainties: [
          'Whether Reformation-era readings reflect exegesis of the Hebrew or a christological reading habit applied across the Old Testament.',
        ],
        whatWouldChangeThis: [
          'A pre-Christian Jewish source identifying Michael with a messianic or divine figure rather than an angelic one.',
          'Early Christian evidence that Michael and Christ were treated as the same figure before the identification became a confessional position.',
          'A demonstration that the Hebrew of Daniel 10–12 distinguishes Michael from the other heavenly princes in a way implying uncreated status.',
        ],
        evidence: [
          {
            title: 'Calvin identifies Michael with Christ at Daniel 12:1',
            description:
              'In his Daniel commentary Calvin reads Michael at 12:1 as Christ, on the grounds that the protection described exceeds what a creature could give.',
            sourceRef: 'sch.calvin-daniel',
            relationship: 'WEAKLY_SUPPORTS',
            dimension: 'ancient_reception',
            directness: 0.7,
            relevance: 0.85,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'Establishes the reading as a considered position in mainstream Reformation exegesis rather than a modern sectarian novelty. It is evidence about reception history, not about the Hebrew text.',
          },
          {
            title: 'Denominational exegetical case',
            description:
              'The Seventh-day Adventist Bible Commentary argues the identification from Michael\'s function as deliverer, from the "voice of the archangel" at 1 Thessalonians 4:16, and from parallels between Daniel 12 and Christ\'s eschatological role.',
            sourceRef: 'sch.sda-commentary',
            relationship: 'WEAKLY_SUPPORTS',
            dimension: 'interpretive_consensus',
            directness: 0.7,
            relevance: 0.85,
            independence: 0.6,
            excerpt: null,
            whyItMatters:
              'The strongest sustained statement of the case, and it is presented here as its defenders present it. Its confessional starting point is declared rather than concealed.',
          },
          {
            title: 'Daniel distinguishes Michael from God',
            description:
              'Michael acts within a company of heavenly princes, contends with other angelic patrons and is called "one of" the chief princes — language of membership in a class.',
            sourceRef: 'sch.collins-daniel',
            relationship: 'CHALLENGES',
            dimension: 'linguistic_fit',
            directness: 0.9,
            relevance: 0.95,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'This is the central difficulty. "One of the chief princes" places Michael in a category with peers, which sits badly with an identification with an uncreated figure.',
          },
          {
            title: 'Jude 9 has Michael appeal to a higher authority',
            description:
              'In Jude 9, Michael does not rebuke the devil on his own authority but says "The Lord rebuke you."',
            sourceRef: 'anc.jude',
            relationship: 'CHALLENGES',
            dimension: 'canonical_correspondence',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.8,
            excerpt: 'The Lord rebuke you.',
            whyItMatters:
              'The one New Testament text that names Michael directly shows him deferring to a higher authority — difficult to reconcile with identifying him as that authority. Defenders read it as voluntary condescension; that reading is possible but requires an additional assumption.',
          },
          {
            title: 'No pre-Christian Jewish identification',
            description:
              'No Second Temple Jewish source identifies Michael with a messianic or divine figure. In 1 Enoch and the War Scroll he is consistently one of several chief angels.',
            sourceRef: 'anc.1enoch',
            relationship: 'CHALLENGES',
            dimension: 'ancient_reception',
            directness: 0.8,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The readers closest to Daniel in time, language and thought-world did not read it this way. That is significant evidence about what the text meant to its first audiences.',
          },
          {
            title: 'Jewish reading of Michael',
            description:
              'Jewish interpretation reads Michael consistently as Israel\'s angelic patron, with no messianic identification.',
            sourceRef: 'sch.jewish-study-bible',
            relationship: 'CHALLENGES',
            dimension: 'interpretive_consensus',
            directness: 0.75,
            relevance: 0.85,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'The tradition that has read this text continuously in its original language has never found the identification in it.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'linguistic_fit',
            reasoningSummary:
              '"One of the chief princes" is class-membership language and tells against the identification.',
            strength: 0.25,
          },
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'The one NT text naming Michael has him deferring to a higher authority. Defenders can accommodate this, at the cost of an added assumption.',
            strength: 0.3,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'No pre-Christian Jewish source reads Michael this way; the reading appears late in Christian interpretation.',
            strength: 0.25,
          },
          {
            dimensionType: 'interpretive_consensus',
            reasoningSummary:
              'A minority position, though held by serious interpreters including Calvin.',
            strength: 0.3,
          },
          {
            dimensionType: 'modern_scholarly_dispute',
            reasoningSummary:
              'Not seriously contested in the academic literature; the dispute is confessional rather than exegetical.',
            strength: 0.25,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The wording is not in dispute, and is assessed in full as Claim 01. The difficulty here is interpretive, not textual — everyone is reading the same words.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'The identity of Michael with Christ is a theological proposition. Archaeology and documentary history cannot bear on it.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'Weakly supported. The reading depends on inference from shared imagery and must accommodate the class-membership language and Jude 9.',
          },
        ],
        interpretations: [
          {
            name: 'Michael is an archangel distinct from Christ',
            description:
              'Michael is a created heavenly being of high rank, Israel\'s angelic patron, distinct from the Son.',
            tradition: 'SECULAR_HISTORICAL_CRITICAL',
            scholarlyPosition: 'BROAD_CONSENSUS',
            directTextualSupport:
              'Daniel calls Michael "one of the chief princes", language of membership in a class of peers.',
            canonicalSupport:
              'Jude names him an archangel and shows him deferring to the Lord; Revelation places him at the head of angels, not above them.',
            historicalReception:
              'The reading of Second Temple Judaism, of Jewish interpretation throughout, and of Catholic, Orthodox and most Protestant theology.',
            assumptionsRequired: [
              'That the categories of Second Temple angelology apply to Daniel\'s language.',
            ],
            counterarguments: [
              'The protective role attributed to Michael at 12:1 is unusually exalted for a creature.',
            ],
            strength: 0.87,
          },
          {
            name: 'Michael is Christ',
            description:
              'Michael is a title or pre-incarnate manifestation of the Son, who delivers his people at the end.',
            tradition: 'PROTESTANT',
            scholarlyPosition: 'MINORITY_POSITION',
            directTextualSupport:
              'Limited. It rests on the exalted character of the deliverance at 12:1 and on parallels with the "son of man" figure of Daniel 7, neither of which names Michael.',
            canonicalSupport:
              'The "voice of the archangel" at 1 Thessalonians 4:16 is read as Christ\'s own, and Michael\'s victory in Revelation 12 as Christ\'s.',
            historicalReception:
              'Held by Calvin and some Reformation interpreters; maintained today chiefly by Seventh-day Adventist and Jehovah\'s Witness traditions. Absent from Jewish interpretation and rejected by Catholic and Orthodox theology.',
            assumptionsRequired: [
              'That "prince" language is christological rather than angelological.',
              'That the Daniel 7 son of man and the Daniel 12 Michael are the same figure.',
              'That Michael\'s deference in Jude 9 is voluntary condescension rather than subordination.',
            ],
            counterarguments: [
              '"One of the chief princes" is class-membership language.',
              'Jude 9 has Michael appeal to a higher authority.',
              'No pre-Christian Jewish source makes the identification.',
            ],
            strength: 0.33,
          },
        ],
        whyThisScore: {
          increasing: [
            'Held by Calvin and other serious Reformation interpreters, so it is not a modern novelty.',
            'The deliverance described at 12:1 is exalted in a way defenders reasonably find striking.',
            'The tradition maintaining it has produced a sustained exegetical case rather than an assertion.',
          ],
          lowering: [
            '"One of the chief princes" places Michael among peers.',
            'Jude 9 has Michael defer to a higher authority.',
            'No Second Temple Jewish source identifies Michael with a messianic or divine figure.',
            'Jewish interpretation, reading the Hebrew continuously, has never found the identification.',
            'The reading requires at least three assumptions the text does not supply.',
          ],
          uncertainties: [
            'Whether Reformation-era readings reflect exegesis of the Hebrew or a general christological reading habit.',
          ],
          assumptions: [
            'That later christological categories may be read back into a second-century BCE Jewish apocalypse.',
          ],
          alternativeInterpretations: [
            'Michael as a created archangel distinct from Christ — the majority reading.',
            'Michael as a heavenly figure whose ontology Daniel simply leaves open.',
          ],
          missingEvidence: [
            'Any pre-Christian Jewish source identifying Michael with a messianic or divine figure.',
          ],
          scholarlyDisagreements: [
            'The division is confessional rather than academic; the identification is not a live question in critical scholarship.',
          ],
          conclusion:
            'The evidence does not support this identification well. That is a statement about what the texts show, not a verdict on the traditions that hold it — a doctrine can be held on grounds this framework does not measure, and a low evidence confidence is not a finding of falsehood.',
        },
        certaintyBreakdown: {
          certain: [
            'The identification is a minority position in the history of Christian interpretation.',
            'No pre-Christian Jewish source makes it.',
          ],
          probable: [
            'Daniel\'s author did not intend Michael as a divine or messianic figure.',
          ],
          possible: [
            'That Reformation-era readings preserve an older interpretive strand not otherwise attested.',
          ],
          speculative: [
            'That Daniel 12:1 encodes a christological identification recoverable from the Hebrew.',
          ],
          unknown: [
            'Whether an early Christian identification of Michael with Christ existed before the surviving evidence.',
          ],
        },
        // Penalties record uncertainty that is NOT already represented on the
        // evidence ledger. The absence of a pre-Christian Jewish identification
        // is recorded above as a CHALLENGES item, so it is not also charged
        // here as missing evidence; double-counting it would penalise the
        // reading twice for one weakness.
        penalties: {
          missingEvidence: 0.25,
          sourceDependence: 0.2,
          chronologyUncertainty: 0.2,
          interpretiveAmbiguity: 0.4,
          scholarlyDisagreement: 0.25,
        },
        absence: null,
        prophetic: null,
        metaphysical: {
          historicalReach:
            'Historical and textual method can establish what Daniel\'s language meant in its own setting, and how later readers understood it. It cannot adjudicate the identity of divine persons.',
          theologicalReading:
            'Christian traditions holding this identification do so on systematic-theological grounds — the unity of divine action across the testaments — rather than on the philology of Daniel 12:1. Assessed on that basis it is a different claim from the one scored here.',
        },
      },
    },

    /* ---------------- Claim 5: the book ---------------- */
    {
      statement:
        '"The book" in Daniel 12:1 refers to a heavenly register of those belonging to God.',
      claimType: 'INTERPRETIVE',
      scope: 'Daniel 12:1, with canonical parallels',
      rationale:
        'The phrase is brief and unexplained, so the reading depends on canonical parallels rather than on the verse itself.',
      assessment: {
        summary:
          'Well supported. The motif of a divine register recurs across the Hebrew Bible and Second Temple literature, and Daniel 12:1 uses it without explanation — which itself indicates the author expected it to be recognised. The reading rests on parallels rather than on anything the verse states, which is what holds it below the top band.',
        scope: 'Daniel 12:1, with canonical parallels',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Broadly agreed across traditions. Disagreement concerns what the register implies — whether inclusion is a matter of election, of covenant faithfulness, or of survival through the crisis — not whether the motif is present.',
        assumptions: [
          'That the definite article in "the book" points to a motif already familiar to the audience.',
          'That the Exodus and Psalms register passages belong to the same tradition Daniel draws on.',
        ],
        uncertainties: [
          'Whether the register denotes eschatological salvation or, more narrowly, survival of the crisis described in the verse.',
          'Whether inclusion is presented as a matter of covenant membership or of individual faithfulness.',
        ],
        whatWouldChangeThis: [
          'Second Temple evidence that "the book" in apocalyptic contexts denoted something other than a divine register — a record of deeds, say, rather than of persons.',
          'A textual variant supplying an explanatory phrase that fixes the sense differently.',
        ],
        positionNote: null,
        evidence: [
          {
            title: 'The register motif across the Hebrew Bible',
            description:
              'A divine book recording persons appears at Exodus 32:32–33, Psalm 69:28 and Malachi 3:16, in each case a register of those belonging to God.',
            sourceRef: 'ed.bhs',
            relationship: 'SUPPORTS',
            dimension: 'canonical_correspondence',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.7,
            excerpt: null,
            whyItMatters:
              'The motif is established across several centuries and genres before Daniel, so the reading does not depend on Daniel alone.',
          },
          {
            title: 'The unexplained definite article',
            description:
              'Daniel writes "the book" without introducing or explaining it, in a vision otherwise careful to explain its symbols.',
            sourceRef: 'sch.collins-daniel',
            relationship: 'SUPPORTS',
            dimension: 'linguistic_fit',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'An unexplained definite reference in a text that explains its other symbols is good evidence that the author expected recognition — which points to an existing motif.',
          },
          {
            title: 'Heavenly tablets in Second Temple literature',
            description:
              '1 Enoch and related literature describe heavenly tablets and books recording human destinies, contemporary with Daniel.',
            sourceRef: 'anc.1enoch',
            relationship: 'SUPPORTS',
            dimension: 'ancient_reception',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'Shows the motif was live in Daniel\'s own literary environment, not merely in earlier scripture.',
          },
          {
            title: 'Convergent commentary reading',
            description:
              'Hartman and Di Lella independently read the phrase as the register of those destined for deliverance.',
            sourceRef: 'sch.hartman-dilella-daniel',
            relationship: 'SUPPORTS',
            dimension: 'interpretive_consensus',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Independent confirmation from a different confessional tradition.',
          },
          {
            title: 'The verse does not define the register',
            description:
              'Daniel gives no criterion for inclusion and no description of the book itself.',
            sourceRef: 'sch.baldwin-daniel',
            relationship: 'WEAKLY_CHALLENGES',
            dimension: 'linguistic_fit',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'The general reading is secure; the specific theological content read into it is supplied from elsewhere and should not inherit the same confidence.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'Multiple independent register passages across several centuries and genres.',
            strength: 0.88,
          },
          {
            dimensionType: 'linguistic_fit',
            reasoningSummary:
              'The unexplained definite article points to a recognised motif; the verse still supplies no criterion of inclusion.',
            strength: 0.8,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'Heavenly-book imagery is well attested in contemporary Jewish apocalyptic.',
            strength: 0.85,
          },
          {
            dimensionType: 'interpretive_consensus',
            reasoningSummary: 'Agreed across traditions and in critical commentary.',
            strength: 0.87,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The phrase is textually secure, with no relevant variant. Assessed in full as Claim 01; nothing turns on the wording here.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'A heavenly register is not the kind of object historical method investigates. The claim is about the text\'s meaning.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'Strong canonical parallels and a telling definite article, held below the top band because the verse itself says little.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'The register motif appears at Exodus 32:32–33, Psalm 69:28 and Malachi 3:16.',
            'Daniel uses the definite article without explanation, in a vision that explains its other symbols.',
            'Heavenly-book imagery is well attested in contemporary Second Temple literature.',
            'Critical and confessional commentaries converge.',
          ],
          lowering: [
            'The verse gives no criterion for inclusion and does not describe the book.',
            'The reading rests on parallels rather than on anything the verse states.',
          ],
          uncertainties: [
            'Whether the register denotes eschatological salvation or survival of the immediate crisis.',
          ],
          assumptions: [
            'That the earlier register passages belong to the same tradition Daniel draws on.',
          ],
          alternativeInterpretations: [
            'A record of deeds rather than of persons.',
            'A census-like register of the covenant community rather than an eschatological one.',
          ],
          missingEvidence: [
            'Second Temple evidence fixing the technical sense of "the book" in apocalyptic contexts.',
          ],
          scholarlyDisagreements: [
            'Over what the register implies theologically, not over whether the motif is present.',
          ],
          conclusion:
            'Danielic judgement imagery and multiple canonical parallels strongly support this reading. What inclusion in the register means is a further question, and it is less settled.',
        },
        certaintyBreakdown: {
          certain: [
            'Daniel 12:1 refers to "the book" with a definite article and no explanation.',
            'A divine register motif is attested in earlier Hebrew scripture.',
          ],
          probable: [
            'The author expected the audience to recognise an existing register motif.',
          ],
          possible: [
            'That the register denotes survival of the immediate crisis rather than eschatological salvation.',
          ],
          speculative: [
            'Detailed reconstructions of the criteria for inclusion.',
          ],
          unknown: [
            'Whether Daniel\'s author distinguished this register from those of the earlier texts.',
          ],
        },
        penalties: {
          missingEvidence: 0.2,
          sourceDependence: 0.25,
          chronologyUncertainty: 0.1,
          interpretiveAmbiguity: 0.3,
          scholarlyDisagreement: 0.1,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 6: resurrection ---------------- */
    {
      statement:
        'Daniel 12 describes an eschatological resurrection of the dead.',
      claimType: 'INTERPRETIVE',
      scope: 'Daniel 12:1–3, especially 12:2',
      rationale:
        'Daniel 12:2 is the clearest resurrection statement in the Hebrew Bible, and the reading of 12:1 depends on it.',
      assessment: {
        summary:
          'Very strongly supported. Daniel 12:2 states it about as plainly as the Hebrew Bible ever states anything of the kind — sleepers in the dust awakening, some to everlasting life and some to reproach — and Second Temple readers, including those at Qumran and the rabbinic tradition, read it that way from the beginning.',
        scope: 'Daniel 12:1–3, especially 12:2',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Effectively unanimous. Critical, Jewish, Catholic, Orthodox and Protestant scholarship agree that Daniel 12:2 describes bodily resurrection. Debate concerns scope — whether the resurrection is universal or limited — and whether the idea developed within Israelite tradition or under Persian influence.',
        positionNote: null,
        assumptions: [
          'That "sleep in the dust of the earth" is the standard idiom for death rather than a metaphor for national dormancy.',
          'That "awake" denotes restoration to life rather than figurative national revival.',
        ],
        uncertainties: [
          'Whether the resurrection envisaged is universal or restricted to the notably righteous and notably wicked, which the "many" of 12:2 leaves open.',
          'Whether the concept developed internally or under Persian influence — a live question that does not affect what the text says.',
        ],
        whatWouldChangeThis: [
          'Lexical evidence that the dust-sleep idiom carried a collective-national sense in Second Temple Hebrew.',
          'Second Temple evidence that Daniel 12:2 was originally read as national restoration rather than personal resurrection.',
        ],
        evidence: [
          {
            title: 'Daniel 12:2 states it explicitly',
            description:
              '"And many of those who sleep in the dust of the earth shall awake, some to everlasting life, and some to shame and everlasting contempt."',
            sourceRef: 'ed.bhs',
            relationship: 'SUPPORTS',
            dimension: 'linguistic_fit',
            directness: 0.95,
            relevance: 1.0,
            independence: 0.8,
            excerpt:
              'And many of those who sleep in the dust of the earth shall awake, some to everlasting life, and some to shame and everlasting contempt.',
            whyItMatters:
              'Two contrasting destinies after awakening make a purely national-restoration reading very difficult: nations are not raised to individual shame.',
          },
          {
            title: 'Second Temple reception',
            description:
              'Qumran texts and later rabbinic literature read Daniel 12:2 as bodily resurrection; it becomes a standard proof-text for the doctrine.',
            sourceRef: 'ms.1qm',
            relationship: 'SUPPORTS',
            dimension: 'ancient_reception',
            directness: 0.75,
            relevance: 0.85,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The earliest readers, in the text\'s own language and setting, took it this way. Reception this early and this consistent is strong evidence of meaning.',
          },
          {
            title: 'Critical commentary agreement',
            description:
              'Collins treats Daniel 12:2 as the clearest and probably earliest unambiguous statement of resurrection in the Hebrew Bible.',
            sourceRef: 'sch.collins-daniel',
            relationship: 'SUPPORTS',
            dimension: 'interpretive_consensus',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The critical tradition, which has no confessional stake in finding resurrection here, reaches the same reading.',
          },
          {
            title: 'Jewish scholarly agreement',
            description:
              'Jewish scholarship reads the verse as resurrection and treats it as foundational for the later doctrine.',
            sourceRef: 'sch.jewish-study-bible',
            relationship: 'SUPPORTS',
            dimension: 'interpretive_consensus',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Convergence across traditions with different theological interests in the outcome.',
          },
          {
            title: 'The scope of "many" is unresolved',
            description:
              'Daniel 12:2 says "many", not "all", and commentators divide on whether this restricts the resurrection or is an idiom for a large number.',
            sourceRef: 'sch.hartman-dilella-daniel',
            relationship: 'CONTEXTUAL',
            dimension: 'linguistic_fit',
            directness: 0.8,
            relevance: 0.75,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Bears on the scope of the resurrection, not on whether resurrection is described. Recorded as contextual so it informs the reader without moving the score.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'linguistic_fit',
            reasoningSummary:
              'The dust-sleep idiom and the two contrasting destinies make the reading close to explicit.',
            strength: 0.92,
          },
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'Coheres with Isaiah 26:19 and anticipates the developed resurrection language of later Jewish and Christian texts.',
            strength: 0.85,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'Read as resurrection from the earliest surviving reception onward.',
            strength: 0.9,
          },
          {
            dimensionType: 'interpretive_consensus',
            reasoningSummary: 'Effectively unanimous across traditions and critical scholarship.',
            strength: 0.93,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'Daniel 12:2 is textually secure across all witnesses. Assessed in full as Claim 01; every party to this question reads the same text.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'Whether a resurrection will occur is not adjudicable by historical method. The claim assessed is what the text describes.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'Near-explicit language, unanimous early reception and cross-tradition agreement.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'Daniel 12:2 describes sleepers in the dust awakening to two contrasting destinies.',
            'Individual shame and everlasting contempt do not fit a national-restoration reading.',
            'Second Temple and rabbinic readers took it as resurrection from the earliest surviving reception.',
            'Critical, Jewish, Catholic and Protestant scholarship converge.',
          ],
          lowering: [
            '"Many" rather than "all" leaves the scope of the resurrection open.',
            'The claim concerns what the text describes, not whether the event will occur.',
          ],
          uncertainties: [
            'Whether the resurrection is universal or restricted.',
            'Whether the concept developed internally or under Persian influence.',
          ],
          assumptions: [
            'That the dust-sleep idiom denotes death rather than national dormancy.',
          ],
          alternativeInterpretations: [
            'National restoration imagery on the model of Ezekiel 37 — a reading the individual destinies of 12:2 make difficult.',
          ],
          missingEvidence: [
            'Second Temple lexical evidence bearing on the collective sense of the idiom.',
          ],
          scholarlyDisagreements: [
            'Over scope and origin, not over whether resurrection is described.',
          ],
          conclusion:
            'That Daniel 12 describes an eschatological resurrection is among the most securely supported interpretive claims in the book. The scope of that resurrection is a further and less settled question.',
        },
        certaintyBreakdown: {
          certain: [
            'Daniel 12:2 speaks of awakening from the dust to everlasting life or everlasting contempt.',
          ],
          probable: [
            'The author intended bodily resurrection of individuals.',
            'This is the earliest unambiguous resurrection statement in the Hebrew Bible.',
          ],
          possible: [
            'That "many" restricts the resurrection to a subset rather than all the dead.',
          ],
          speculative: [
            'Reconstructions of the specific channel by which the concept entered Jewish thought.',
          ],
          unknown: [
            'Whether the author held a developed anthropology of the intermediate state.',
          ],
        },
        penalties: {
          missingEvidence: 0.15,
          sourceDependence: 0.2,
          chronologyUncertainty: 0.1,
          interpretiveAmbiguity: 0.2,
          scholarlyDisagreement: 0.05,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },
  ],
};
