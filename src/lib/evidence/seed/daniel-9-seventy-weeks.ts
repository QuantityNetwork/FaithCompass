/**
 * Prophecy demonstration: Daniel 9:24–27.
 *
 * "Fulfilled prophecy" is the claim most often asserted and least often shown.
 * This subject exists to show it instead, by running the prophetic framework:
 * when was the text composed, when is it first attested, how specific is the
 * prediction, how ambiguous, how many interpretive assumptions does a given
 * fulfilment require, and what are the competing candidates.
 *
 * The date of composition is the hinge, and it is genuinely disputed. The
 * assessment does not resolve that dispute by fiat; it shows how much each
 * reading depends on it.
 */

import type { SeededSubject } from './types';

export const DANIEL_9_SEVENTY_WEEKS: SeededSubject = {
  id: 'analysis-daniel-9-24',
  slug: 'daniel/9/24',
  resourceType: 'PASSAGE',
  title: 'Daniel 9:24–27',
  subtitle: 'Seventy weeks are decreed about your people and your holy city.',
  reference: {
    work: 'daniel',
    display: 'Daniel 9:24–27',
    chapter: 9,
    verse: 24,
    verseEnd: 27,
    slug: 'daniel/9/24',
  },
  passageText:
    '"Seventy weeks are decreed about your people and your holy city, to finish the transgression, to put an end to sin, and to atone for iniquity, to bring in everlasting righteousness, to seal both vision and prophet, and to anoint a most holy place. … And after the sixty-two weeks, an anointed one shall be cut off and shall have nothing. And the people of the prince who is to come shall destroy the city and the sanctuary."',
  passageAttribution: 'Daniel 9:24–27',
  summary:
    'The most disputed prophetic passage in the Hebrew Bible. Four questions travel together here and separate sharply under examination: what the text says, when it was written, whether its language is specific enough to identify a fulfilment, and which fulfilment it identifies. The wording is secure. The date is contested, and almost everything else depends on it.',
  aliases: ['daniel 9', 'seventy weeks', 'daniel 9:24', 'seventy sevens', 'dan 9:24'],
  claims: [
    /* ---------------- Claim 1: date of composition ---------------- */
    {
      statement:
        'The visions of Daniel 7–12 reached their final form in the second century BCE, during the Antiochene crisis.',
      claimType: 'CHRONOLOGICAL',
      scope: 'Composition of Daniel 7–12',
      rationale:
        'Every prophetic claim in this passage depends on this one. A prediction written before the event is a different kind of claim from a description written after it, and the framework cannot assess either without settling which is being argued.',
      assessment: {
        summary:
          'The majority critical position, held on converging linguistic, historical and literary grounds: the book\'s knowledge of Hellenistic events grows dense and accurate through the reign of Antiochus IV and then becomes inaccurate precisely at his death. A serious conservative minority defends a sixth-century setting. The dispute is real and is represented here on both sides, because the prophetic claims downstream inherit it.',
        scope: 'Composition of Daniel 7–12',
        scholarlyPosition: 'MAJORITY_POSITION',
        scholarlyLandscape:
          'A second-century dating is the standard position in critical scholarship and in most Catholic and mainline Protestant commentary. A sixth-century dating is defended by a conservative evangelical minority on the Aramaic, the Persian and Greek loanwords, and the theological objection that the critical reading presupposes predictive prophecy is impossible. The two literatures engage each other directly, which is more than can be said for many disputes in this field.',
        positionNote: null,
        assumptions: [
          'That the point at which a text\'s historical accuracy fails is evidence of when its author was writing.',
          'That the linguistic profile of Daniel\'s Aramaic can be dated with useful precision.',
        ],
        uncertainties: [
          'The dating of Imperial Aramaic is not precise enough to settle the question by itself, and both sides acknowledge this.',
          'Chapters 1–6 may preserve materially older traditions than chapters 7–12, so "the date of Daniel" may not be a single answer.',
        ],
        whatWouldChangeThis: [
          'A Daniel manuscript or citation demonstrably older than the Antiochene crisis.',
          'Linguistic analysis establishing that Daniel\'s Aramaic cannot be as late as the second century.',
          'Demonstration that the detailed material in Daniel 11 corresponds to events after Antiochus IV as accurately as it does to events before his death.',
        ],
        evidence: [
          {
            title: 'Accuracy that fails at a datable point',
            description:
              'Daniel 11 tracks Hellenistic dynastic history in dense and accurate detail down to the reign of Antiochus IV, then describes his death in terms that do not correspond to what is independently known of it.',
            sourceRef: 'sch.collins-daniel',
            relationship: 'SUPPORTS',
            dimension: 'chronological_fit',
            directness: 0.9,
            relevance: 0.95,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The central argument, and it is a testable one. A text whose accuracy degrades sharply at one point is most economically explained as having been written at that point. Note what it assumes: that the pattern indicates authorship date rather than the limits of a genuine revelation.',
          },
          {
            title: 'Independent account of the Antiochene crisis',
            description:
              '1 Maccabees describes the desecration of the temple and the persecution under Antiochus IV, matching the circumstances Daniel 7–12 addresses.',
            sourceRef: 'anc.1maccabees',
            relationship: 'SUPPORTS',
            dimension: 'external_historical_corroboration',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'Establishes independently that the crisis Daniel addresses was real and datable. It corroborates the setting rather than the composition date, which is a narrower contribution than it is often made to carry.',
          },
          {
            title: 'Earliest manuscript evidence is second-century',
            description:
              'The oldest Daniel copies from Qumran date to within roughly fifty years of the Antiochene crisis. No earlier witness exists.',
            sourceRef: 'ms.4qdan',
            relationship: 'WEAKLY_SUPPORTS',
            dimension: 'dating_confidence',
            directness: 0.7,
            relevance: 0.8,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'Consistent with a second-century composition but far from decisive: manuscripts give a date before which a text existed, never the date it was written. A sixth-century Daniel would also be expected to be circulating by then.',
          },
          {
            title: 'Porphyry, the earliest statement of the argument',
            description:
              'In the third century CE Porphyry argued that Daniel was written during the Antiochene persecution rather than in the sixth century. The work is lost and survives only in the commentary that set out to refute it.',
            sourceRef: 'anc.porphyry-via-jerome',
            relationship: 'CONTEXTUAL',
            dimension: 'source_dependence',
            directness: 0.6,
            relevance: 0.7,
            independence: 0.35,
            excerpt: null,
            whyItMatters:
              'Recorded as contextual, and heavily discounted for dependence. Porphyry reaches us only through Jerome, who quoted him in order to rebut him and had no reason to preserve his argument at its strongest. This is one witness reported by its opponent, not two witnesses, and it shows that the question is ancient rather than modern — which is all it can show.',
          },
          {
            title: 'Jerome preserves the patristic rebuttal',
            description:
              'Jerome answers Porphyry directly, defending a sixth-century Daniel and treating the correspondence with Hellenistic history as genuine prediction.',
            sourceRef: 'anc.jerome-daniel',
            relationship: 'WEAKLY_CHALLENGES',
            dimension: 'ancient_reception',
            directness: 0.7,
            relevance: 0.75,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Evidence that the traditional dating was held by informed readers who knew the counterargument and answered it, rather than by readers unaware of the problem.',
          },
          {
            title: 'The conservative linguistic case',
            description:
              'Baldwin argues that Daniel\'s Aramaic, and the distribution of its Persian and Greek loanwords, fit a sixth-century setting better than a second-century one.',
            sourceRef: 'sch.baldwin-daniel',
            relationship: 'CHALLENGES',
            dimension: 'linguistic_fit',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'The strongest form of the minority case, and a genuine constraint: the Greek loanwords are fewer than a second-century Palestinian composition might lead one to expect. Critical scholarship answers this, but it is not a frivolous objection.',
          },
          {
            title: 'Catholic critical commentary concurs independently',
            description:
              'Hartman and Di Lella reach a second-century dating from a Catholic scholarly tradition working separately from Collins.',
            sourceRef: 'sch.hartman-dilella-daniel',
            relationship: 'SUPPORTS',
            dimension: 'scholarly_consensus',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Convergence from a confessional tradition with no stake in denying predictive prophecy carries more weight than agreement among scholars who share a prior.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'chronological_fit',
            reasoningSummary:
              'The point at which the book\'s historical accuracy fails is sharp, datable and independently checkable.',
            strength: 0.88,
          },
          {
            dimensionType: 'dating_confidence',
            reasoningSummary:
              'Manuscript evidence bounds the text from one side only; the argument rests on internal content.',
            strength: 0.7,
          },
          {
            dimensionType: 'authorship_confidence',
            reasoningSummary:
              'The author is anonymous and the book is pseudonymous on any reading. Authorship cannot be established, only the setting it was written into.',
            strength: 0.45,
          },
          {
            dimensionType: 'linguistic_fit',
            reasoningSummary:
              'Aramaic dating is too imprecise to settle the question, and the loanword distribution is a real if limited difficulty for the majority view.',
            strength: 0.55,
          },
          {
            dimensionType: 'external_historical_corroboration',
            reasoningSummary:
              'The Antiochene crisis is independently attested; its correspondence to Daniel is not in dispute, only its explanation.',
            strength: 0.85,
          },
          {
            dimensionType: 'source_dependence',
            reasoningSummary:
              'The earliest statement of the argument survives only through a hostile intermediary and is weighted accordingly.',
            strength: 0.3,
          },
          {
            dimensionType: 'scholarly_consensus',
            reasoningSummary:
              'Majority position across critical, Catholic and mainline Protestant scholarship; contested by a serious evangelical minority.',
            strength: 0.8,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The text is well attested from the second century BCE; the manuscript record bounds the composition from one side but cannot date it.',
          },
          {
            dimension: 'historical',
            applicable: true,
            reasoningSummary:
              'The Hellenistic events the book tracks are independently documented, and the point where its accuracy fails can be checked against them.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'What the accuracy pattern means is where the dispute actually lies, and it turns partly on a prior about whether predictive prophecy is possible.',
          },
        ],
        interpretations: [
          {
            name: 'Second-century composition',
            description:
              'Chapters 7–12 were composed during the Antiochene persecution, addressing that crisis in the voice of a sixth-century seer.',
            tradition: 'SECULAR_HISTORICAL_CRITICAL',
            scholarlyPosition: 'MAJORITY_POSITION',
            directTextualSupport:
              'The density and accuracy of Daniel 11\'s Hellenistic detail, and the point at which it fails.',
            canonicalSupport:
              'Pseudonymous composition in an ancient seer\'s voice is a recognised feature of Second Temple apocalyptic, not an accusation of fraud.',
            historicalReception:
              'Argued by Porphyry in the third century and dominant in scholarship since the nineteenth.',
            assumptionsRequired: [
              'That a break in historical accuracy marks the author\'s own vantage point.',
            ],
            counterarguments: [
              'The Greek loanwords are fewer than a second-century Palestinian setting might predict.',
              'The argument presupposes that genuine long-range prediction is not a live possibility.',
            ],
            strength: 0.78,
          },
          {
            name: 'Sixth-century composition',
            description:
              'The book records genuine sixth-century visions, and the Hellenistic detail is predictive.',
            tradition: 'EVANGELICAL',
            scholarlyPosition: 'MINORITY_POSITION',
            directTextualSupport:
              'The book\'s own sixth-century setting and first-person narration.',
            canonicalSupport:
              'Consistent with a canonical understanding of prophecy as genuinely predictive.',
            historicalReception:
              'The traditional Jewish and Christian reading, defended by Jerome against Porphyry and maintained in conservative scholarship.',
            assumptionsRequired: [
              'That long-range predictive prophecy of this specificity occurs.',
              'That the inaccuracy about Antiochus\' death is explicable on other grounds.',
            ],
            counterarguments: [
              'The accuracy break is sharp and falls exactly where a second-century author would be standing.',
              'The Aramaic evidence, while imprecise, sits more comfortably late than early.',
            ],
            strength: 0.3,
          },
        ],
        whyThisScore: {
          increasing: [
            'Daniel 11 tracks Hellenistic history accurately and then fails at a datable point.',
            'The Antiochene crisis is independently attested in 1 Maccabees.',
            'Critical and Catholic scholarship converge from different starting points.',
            'The earliest manuscripts are consistent with the dating.',
          ],
          lowering: [
            'Manuscript evidence can bound a composition date from one side only.',
            'Aramaic dating is not precise enough to settle the question.',
            'The Greek loanword distribution is a real difficulty for a second-century Palestinian composition.',
            'The argument depends on a prior about whether long-range prediction is possible, which is not itself a historical finding.',
          ],
          uncertainties: [
            'Whether chapters 1–6 preserve materially older traditions than 7–12.',
            'How much weight the linguistic evidence can bear in either direction.',
          ],
          assumptions: [
            'That a break in historical accuracy marks the author\'s vantage point rather than the limits of a revelation.',
          ],
          alternativeInterpretations: [
            'Sixth-century composition with genuine predictive content.',
            'A composite text with early traditions redacted in the second century.',
          ],
          missingEvidence: [
            'Any Daniel manuscript or citation demonstrably older than the Antiochene crisis.',
          ],
          scholarlyDisagreements: [
            'A live dispute between majority critical scholarship and a serious conservative minority, in which both sides engage each other\'s arguments directly.',
          ],
          conclusion:
            'A second-century setting is well supported and is the majority position, but it is not established beyond dispute, and part of the disagreement turns on a prior about predictive prophecy rather than on the evidence. Every prophetic claim below inherits this uncertainty, and none of them can be more secure than this one.',
        },
        certaintyBreakdown: {
          certain: [
            'Daniel was circulating by the second century BCE.',
            'Daniel 11 corresponds closely to Hellenistic dynastic history down to Antiochus IV.',
          ],
          probable: [
            'Chapters 7–12 reached their final form during the Antiochene crisis.',
          ],
          possible: [
            'That older traditions underlie the visions in their present form.',
          ],
          speculative: [
            'Reconstructions identifying the author or the community behind the book.',
          ],
          unknown: [
            'Whether any part of the material predates the Hellenistic period.',
          ],
        },
        penalties: {
          missingEvidence: 0.35,
          sourceDependence: 0.25,
          chronologyUncertainty: 0.3,
          interpretiveAmbiguity: 0.3,
          scholarlyDisagreement: 0.3,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 2: the prophetic claim itself ---------------- */
    {
      statement:
        'The "anointed one" cut off after sixty-two weeks is a specific prediction of the death of Jesus of Nazareth.',
      claimType: 'PROPHETIC',
      scope: 'Daniel 9:26, read messianically',
      rationale:
        'The most widely asserted fulfilment claim in the passage, and the one that most needs the prophetic framework rather than an assertion.',
      assessment: {
        summary:
          'Assessed through the prophetic framework rather than affirmed or dismissed. The passage does not name a person, a year, or a starting point for the count, and the Hebrew term rendered "anointed one" is applied elsewhere in scripture to priests and to a Persian king. A messianic reading is possible and has ancient support, but reaching a specific identification requires choosing among several undetermined variables, and each choice is an assumption the text does not supply.',
        scope: 'Daniel 9:26, read messianically',
        scholarlyPosition: 'SIGNIFICANTLY_DISPUTED',
        scholarlyLandscape:
          'Critical scholarship overwhelmingly identifies the cut-off anointed one with the high priest Onias III, murdered in 171 BCE, which fits the Antiochene setting of the surrounding chapters. Traditional Christian interpretation identifies him with Jesus. Jewish interpretation has read the passage variously, generally in relation to the Second Temple period rather than messianically in the Christian sense. This is a genuine three-way division, not a consensus with dissenters.',
        positionNote: 'Significantly disputed. Fulfilment claims are shown with their assumptions.',
        assumptions: [
          'That the "weeks" are heptads of years rather than an indeterminate symbolic period.',
          'That a specific decree can be identified as the starting point of the count.',
          'That "anointed one" carries a messianic sense here rather than its ordinary sense of a consecrated priest or ruler.',
          'That the count runs continuously rather than with a gap between the sixty-ninth and seventieth week.',
        ],
        uncertainties: [
          'Which decree begins the period. At least four candidates are proposed, and they differ by nearly a century.',
          'Whether the numbers are intended arithmetically or schematically, as sabbatical-jubilee symbolism.',
          'Whether verse 26 and verse 27 refer to the same figure or to different ones.',
        ],
        whatWouldChangeThis: [
          'Second Temple evidence that the seventy-weeks scheme was already read as a calculable messianic chronology before the first century CE.',
          'A pre-Christian Jewish source identifying the cut-off anointed one with a future messianic figure rather than a priest.',
          'Demonstration that the Hebrew requires a continuous count, which would eliminate the gap-dependent readings.',
          'A securely identified starting decree that resolves the arithmetic without further assumption.',
        ],
        evidence: [
          {
            title: 'The passage names no one',
            description:
              'Daniel 9:26 refers to an anointed one being cut off without giving a name, a year, or an unambiguous starting point for the count.',
            sourceRef: 'ed.bhs',
            relationship: 'WEAKLY_CHALLENGES',
            dimension: 'linguistic_fit',
            directness: 0.9,
            relevance: 0.95,
            independence: 0.7,
            excerpt: 'And after the sixty-two weeks, an anointed one shall be cut off and shall have nothing.',
            whyItMatters:
              'Specificity is the property that makes a prediction testable. A passage that names no one can accommodate more than one fulfilment, and that flexibility counts against a claim to have identified the fulfilment uniquely.',
          },
          {
            title: 'The ordinary sense of the term',
            description:
              'The Hebrew mashiach denotes a consecrated figure, and elsewhere in scripture is applied to priests and, at Isaiah 45:1, to Cyrus the Persian king.',
            sourceRef: 'sch.tov-textual-criticism',
            relationship: 'WEAKLY_CHALLENGES',
            dimension: 'linguistic_fit',
            directness: 0.75,
            relevance: 0.85,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'A messianic reading requires the term to carry more than its ordinary range. That is possible, but it is a step the text does not take by itself.',
          },
          {
            title: 'The Onias III identification',
            description:
              'Critical scholarship identifies the cut-off anointed one with the high priest Onias III, murdered in 171 BCE — an anointed figure removed without succession, within the Antiochene setting of Daniel 7–12.',
            sourceRef: 'sch.collins-daniel',
            relationship: 'CHALLENGES',
            dimension: 'chronological_fit',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'A competing candidate that fits the passage\'s own historical horizon and requires no gap in the count. Its existence is what makes the Christian identification a choice among candidates rather than the only available reading.',
          },
          {
            title: 'Early Christian messianic reading',
            description:
              'Hippolytus and later Jerome read the passage as pointing to Christ, establishing the interpretation within two to four centuries of the events.',
            sourceRef: 'anc.hippolytus-daniel',
            relationship: 'WEAKLY_SUPPORTS',
            dimension: 'ancient_reception',
            directness: 0.7,
            relevance: 0.8,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Establishes the reading as early rather than modern. It is evidence of how Christians read the passage, not evidence that the author intended it — and the reading postdates the events it identifies.',
          },
          {
            title: 'The destruction of the sanctuary',
            description:
              'Verse 26 speaks of a people destroying the city and the sanctuary, which Christian interpretation connects to 70 CE and critical interpretation to the Antiochene desecration.',
            sourceRef: 'anc.1maccabees',
            relationship: 'CONTEXTUAL',
            dimension: 'external_historical_corroboration',
            directness: 0.6,
            relevance: 0.75,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'Recorded as contextual because it supports both readings. Both a second-century desecration and a first-century destruction are historically real, and the passage is compatible with either — which is precisely the ambiguity the framework has to surface rather than resolve.',
          },
          {
            title: 'Jewish interpretation does not read it messianically in this sense',
            description:
              'Jewish scholarship generally relates the passage to the Second Temple period rather than to a messianic figure identified with Jesus.',
            sourceRef: 'sch.jewish-study-bible',
            relationship: 'CHALLENGES',
            dimension: 'interpretive_consensus',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'The tradition that has read this text continuously in its original language, and that was reading it before the events in question, has not found this identification in it.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'linguistic_fit',
            reasoningSummary:
              'The term carries its ordinary priestly and royal range; a messianic sense is possible but not required by the Hebrew.',
            strength: 0.4,
          },
          {
            dimensionType: 'chronological_fit',
            reasoningSummary:
              'The arithmetic depends on an undetermined starting decree, and a competing candidate fits without a gap.',
            strength: 0.35,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'Read messianically in Christian interpretation from the second century, but only after the events identified.',
            strength: 0.5,
          },
          {
            dimensionType: 'interpretive_consensus',
            reasoningSummary:
              'A genuine three-way division between critical, Christian and Jewish readings.',
            strength: 0.35,
          },
          {
            dimensionType: 'external_historical_corroboration',
            reasoningSummary:
              'Both candidate fulfilments correspond to real events, which is the difficulty rather than the support.',
            strength: 0.45,
          },
          {
            dimensionType: 'modern_scholarly_dispute',
            reasoningSummary: 'Actively disputed, with the division falling along confessional lines.',
            strength: 0.35,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The wording is secure. Nothing here turns on a variant; all parties read the same Hebrew.',
          },
          {
            dimension: 'historical',
            applicable: true,
            reasoningSummary:
              'Both candidate fulfilments are historically real events. That both fit is what weakens a claim to unique identification.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'The identification requires four choices among undetermined variables, each of which the text leaves open.',
          },
        ],
        interpretations: [
          {
            name: 'Onias III',
            description:
              'The cut-off anointed one is the high priest Onias III, murdered in 171 BCE during the events the surrounding chapters address.',
            tradition: 'SECULAR_HISTORICAL_CRITICAL',
            scholarlyPosition: 'MAJORITY_POSITION',
            directTextualSupport:
              'An anointed figure removed without succession, within the passage\'s own historical horizon.',
            canonicalSupport:
              'Coheres with the Antiochene setting of Daniel 7–12 as a whole.',
            historicalReception: 'The standard reading in critical scholarship since the nineteenth century.',
            assumptionsRequired: [
              'That the passage addresses the crisis the surrounding chapters address.',
            ],
            counterarguments: [
              'The arithmetic of the seventy weeks does not resolve cleanly on this reading either.',
            ],
            strength: 0.68,
          },
          {
            name: 'Jesus of Nazareth',
            description:
              'The cut-off anointed one is Jesus, with the destruction of city and sanctuary referring to 70 CE.',
            tradition: 'PROTESTANT',
            scholarlyPosition: 'SIGNIFICANTLY_DISPUTED',
            directTextualSupport:
              'Limited. The passage names no one, and the identification rests on the arithmetic, which depends on choices the text does not make.',
            canonicalSupport:
              'Coheres with the New Testament\'s broader reading of Daniel, though no New Testament text applies this verse to the crucifixion explicitly.',
            historicalReception:
              'Attested in Christian interpretation from Hippolytus onward, and dominant in Christian reading since.',
            assumptionsRequired: [
              'That a specific decree begins the count.',
              'That the weeks are arithmetical rather than schematic.',
              'That "anointed one" bears a messianic sense.',
              'On most reckonings, that the count is not continuous.',
            ],
            counterarguments: [
              'Four undetermined variables must each be resolved for the identification to hold.',
              'A competing candidate fits the passage\'s own historical horizon without a gap.',
              'The reading is attested only after the events it identifies.',
            ],
            strength: 0.32,
          },
          {
            name: 'Schematic, non-calculable',
            description:
              'The seventy weeks are sabbatical-jubilee symbolism marking a period of judgement and restoration, not a chronology to be computed.',
            tradition: 'JEWISH',
            scholarlyPosition: 'PLURALITY_POSITION',
            directTextualSupport:
              'The seven-based structure matches the sabbatical and jubilee patterns of Leviticus 25 and Jeremiah 25.',
            canonicalSupport: 'Coheres with the schematic use of numbers across Hebrew prophetic literature.',
            historicalReception: 'Represented across Jewish interpretation and in parts of critical scholarship.',
            assumptionsRequired: [
              'That the numbers are symbolic rather than arithmetical.',
            ],
            counterarguments: [
              'The passage\'s precise divisions of the seventy invite arithmetical reading.',
            ],
            strength: 0.55,
          },
        ],
        whyThisScore: {
          increasing: [
            'The reading is attested in Christian interpretation from the second century onward.',
            'The destruction of city and sanctuary in verse 26 corresponds to a real historical event on this reading.',
            'The passage does concern an anointed figure being removed, which is the shape the claim requires.',
          ],
          lowering: [
            'The passage names no person, no year, and no unambiguous starting point.',
            'The Hebrew term carries its ordinary priestly and royal sense elsewhere in scripture, including of a Persian king.',
            'A competing candidate, Onias III, fits the passage\'s own historical horizon and needs no gap in the count.',
            'The identification requires four separate assumptions the text does not supply.',
            'Jewish interpretation, reading the Hebrew continuously, has not found it there.',
            'The reading is attested only after the events it identifies.',
          ],
          uncertainties: [
            'Which decree begins the count; the candidates differ by nearly a century.',
            'Whether the numbers are arithmetical or schematic.',
            'Whether verses 26 and 27 concern one figure or two.',
          ],
          assumptions: [
            'That this passage is intended as a calculable chronology at all.',
          ],
          alternativeInterpretations: [
            'Onias III, murdered in 171 BCE.',
            'Sabbatical-jubilee symbolism not intended to be computed.',
          ],
          missingEvidence: [
            'Any pre-Christian Jewish source reading the seventy weeks as a calculable messianic chronology.',
          ],
          scholarlyDisagreements: [
            'A genuine three-way division between critical, Christian and Jewish readings, falling largely along confessional lines.',
          ],
          conclusion:
            'This is a possible reading with a long history, not a demonstrated fulfilment. Calling it "fulfilled prophecy" without showing the four assumptions it requires, and without mentioning that a competing candidate fits the passage\'s own setting more economically, would misrepresent the state of the evidence. Nothing here shows the reading to be false; it shows how much has to be supplied to reach it.',
        },
        certaintyBreakdown: {
          certain: [
            'Daniel 9:26 refers to an anointed one being cut off, without naming him.',
            'The Hebrew term is applied elsewhere to priests and to Cyrus.',
          ],
          probable: [
            'The passage\'s own historical horizon is the Antiochene crisis addressed by the surrounding chapters.',
          ],
          possible: [
            'That the author intended a figure beyond that horizon.',
          ],
          speculative: [
            'Specific chronologies computing from a named decree to a named year.',
          ],
          unknown: [
            'Whether the numbers were meant arithmetically at all.',
          ],
        },
        penalties: {
          missingEvidence: 0.4,
          sourceDependence: 0.2,
          chronologyUncertainty: 0.55,
          interpretiveAmbiguity: 0.6,
          scholarlyDisagreement: 0.5,
        },
        absence: null,
        prophetic: {
          compositionDate:
            'Disputed. Majority critical scholarship places the final form of Daniel 7–12 in the second century BCE, during the Antiochene crisis; a conservative minority defends a sixth-century setting. Assessed separately as Claim 01, and every figure here depends on it.',
          earliestManuscriptEvidence:
            'Qumran Daniel copies from roughly the mid-second to mid-first century BCE. These bound the text from one side only: a manuscript shows when a text already existed, never when it was written.',
          specificity:
            'Low. The passage gives no name, no absolute year, and no unambiguous starting point for the count. It specifies an office and an outcome, and leaves the referent open.',
          ambiguity:
            'High. At least four candidate starting decrees are proposed, differing by nearly a century; the "weeks" may be arithmetical or schematic; and verses 26 and 27 may concern one figure or two.',
          retrospectiveCompositionRisk:
            'Material for the surrounding chapters, whose Hellenistic detail is dense and accurate to a datable point. For this verse specifically the risk is lower, since the identification in question postdates any proposed composition date — the issue here is under-determination rather than composition after the fact.',
          historicalCorrespondence:
            'Two candidate fulfilments correspond to real events: the murder of Onias III in 171 BCE with the Antiochene desecration, and the crucifixion with the destruction of Jerusalem in 70 CE. That both correspond is the difficulty, not the support.',
          interpretiveAssumptionCount: 4,
          alternativeFulfilmentCandidates: [
            'Onias III, high priest, murdered 171 BCE — fits the passage\'s own historical horizon and requires no gap in the count.',
            'Seleucus IV, assassinated 175 BCE — proposed by some as the cut-off figure.',
            'A schematic reading on which no individual fulfilment is intended and the numbers are sabbatical-jubilee symbolism.',
            'Jesus of Nazareth, with the destruction referring to 70 CE.',
          ],
        },
        metaphysical: null,
      },
    },
  ],
};
