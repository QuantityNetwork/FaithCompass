/**
 * Cross-tradition demonstration.
 *
 * This subject exists to prove the methodology is not confessionally rigged.
 * The system does not render "Book of Mormon: 21%" — that would be exactly the
 * unserious output the product refuses to produce. It separates the claims,
 * finds that they are supported to sharply different degrees, states the
 * Latter-day Saint scholarly response in its own terms, and distinguishes
 * throughout between "external evidence for this proposition is presently weak"
 * and "this religion is false".
 *
 * Those are not the same statement, and the difference is the product.
 */

import type { SeededSubject } from './types';

export const BOOK_OF_MORMON_MIGRATION: SeededSubject = {
  id: 'analysis-bom-migration',
  slug: 'book-of-mormon/near-eastern-migration',
  resourceType: 'CLAIM_QUERY',
  title: 'Near Eastern Migration to the Ancient Americas',
  subtitle: 'A cross-tradition demonstration of claim-level assessment.',
  reference: null,
  passageText: null,
  passageAttribution: null,
  summary:
    'Three distinct claims travel together in ordinary discussion of this topic and are supported very differently. What the 1830 text says is a matter of documentary record. Whether a Near Eastern population migrated to the Americas is a historical proposition on which external evidence is presently weak. Whether the record is of divine origin is not a proposition historical method can reach at all.',
  aliases: [
    'book of mormon',
    'book of mormon migration',
    'near eastern migration americas',
    'lehi',
    'nephite',
  ],
  claims: [
    {
      statement:
        'The Book of Mormon text, as published in 1830, describes populations deriving from ancient Near Eastern migrations to the Americas.',
      claimType: 'TEXTUAL',
      scope: 'The 1830 Book of Mormon as a published document',
      rationale:
        'What the book says is separable from whether what it says occurred, and only the first is a textual question.',
      assessment: {
        summary:
          'Established as a matter of documentary record. The 1830 edition exists in numerous copies, its publication history is thoroughly documented, and the narrative it contains describes migrations from Jerusalem to the Americas. This claim concerns the contents of a printed book and carries no implication about the antiquity of the record behind it.',
        scope: 'The 1830 Book of Mormon as a published document',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Not disputed by anyone. Latter-day Saint and non-Latter-day Saint scholars agree on what the 1830 text says; they disagree about its origin, which is a different claim.',
        positionNote: null,
        assumptions: [
          'That surviving 1830 copies represent the text as published.',
        ],
        uncertainties: [
          'Minor typesetting and punctuation variation between the 1830 printing and later editions, none of it affecting the migration narrative.',
        ],
        whatWouldChangeThis: [
          'Discovery that surviving 1830 copies differ substantially from the printed edition — which the volume of surviving copies makes very unlikely.',
        ],
        evidence: [
          {
            title: 'The 1830 first edition',
            description:
              'Printed by E. B. Grandin at Palmyra, New York, in 1830, in a documented print run, with many copies surviving in institutional collections.',
            sourceRef: 'bom.1830-edition',
            relationship: 'SUPPORTS',
            dimension: 'manuscript_attestation',
            directness: 1.0,
            relevance: 1.0,
            independence: 1.0,
            excerpt: null,
            whyItMatters:
              'Primary documentary evidence of the publication event. What the text says is directly inspectable.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'manuscript_attestation',
            reasoningSummary: 'Numerous surviving copies of a documented nineteenth-century printing.',
            strength: 0.95,
          },
          {
            dimensionType: 'transmission_stability',
            reasoningSummary:
              'Print transmission from 1830, with textual history well studied; variation is orthographic.',
            strength: 0.9,
          },
          {
            dimensionType: 'provenance',
            reasoningSummary: 'Publication place, printer and date are all documented.',
            strength: 0.95,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'A documented nineteenth-century printing surviving in many copies. What the text says is not in question.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'This claim is about the contents of a book, not about events. Historical corroboration is assessed on the next claim.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'The narrative content is not in interpretive dispute at this level of description.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'The 1830 edition survives in many copies with a documented printing history.',
            'The migration narrative is explicit in the text and not a matter of inference.',
            'No party to the debate disputes what the book says.',
          ],
          lowering: [
            'The claim is narrow. It establishes the contents of an 1830 publication and nothing about the antiquity of the record.',
          ],
          uncertainties: ['Minor typesetting variation between editions.'],
          assumptions: ['That surviving copies represent the text as printed.'],
          alternativeInterpretations: [],
          missingEvidence: [],
          scholarlyDisagreements: [
            'None on this claim. Disagreement concerns origin, which is assessed separately.',
          ],
          conclusion:
            'What the 1830 text says is established. Separating this from the historical and theological claims is the point of assessing it on its own.',
        },
        certaintyBreakdown: {
          certain: ['The 1830 edition was printed at Palmyra and describes migrations from Jerusalem to the Americas.'],
          probable: ['Surviving copies represent the text as first published.'],
          possible: ['Minor uncorrected typesetting variation between copies.'],
          speculative: [],
          unknown: ['Details of the printer\'s copy-text at some points.'],
        },
        penalties: {
          missingEvidence: 0.05,
          sourceDependence: 0.1,
          chronologyUncertainty: 0.05,
          interpretiveAmbiguity: 0.05,
          scholarlyDisagreement: 0.02,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    {
      statement:
        'A population originating in the ancient Near East migrated to the Americas and established the civilisations the Book of Mormon describes.',
      claimType: 'HISTORICAL',
      scope: 'Pre-Columbian population history of the Americas, c. 600 BCE – 400 CE',
      rationale:
        'This is the historical proposition underneath the narrative, and it is the one external evidence can address.',
      assessment: {
        summary:
          'External corroboration is presently limited. Population genetics indicates predominantly Northeast Asian ancestry for Indigenous American populations, and the specific material culture, metallurgy, domesticated animals, writing system and Old World crops the narrative implies have not been identified in the relevant archaeological record. Latter-day Saint scholarship responds with a limited-geography model and with founder-effect and genetic-drift arguments, and those responses are represented here in their own terms rather than summarised dismissively.',
        scope: 'Pre-Columbian population history of the Americas, c. 600 BCE – 400 CE',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Mainstream archaeology, population genetics and Mesoamerican studies do not identify evidence of a Near Eastern founding population in the pre-Columbian Americas, and this is not a contested question in those fields. A distinct body of Latter-day Saint scholarship argues that the narrative describes a small population within a much larger existing one, in which case the genetic and archaeological expectations would be very different. The two literatures largely address different questions.',
        positionNote:
          'External corroboration is limited. This is a finding about a specific historical proposition, not a verdict on a religious tradition.',
        assumptions: [
          'That the narrative implies a population large and distinct enough to leave a recoverable material or genetic trace.',
          'That present sampling of ancient and modern American populations is broad enough to detect a founding Near Eastern lineage if one existed.',
        ],
        uncertainties: [
          'Which geography the narrative describes. Without a fixed location, predictions about what should have been found are correspondingly loose.',
          'How large the migrating population was, and whether it remained genetically distinguishable after admixture.',
          'How completely relevant regions have been excavated, and how much organic material would survive in tropical conditions.',
        ],
        whatWouldChangeThis: [
          'Recovery of Old World domesticated animals or crops from securely dated pre-Columbian American contexts.',
          'A pre-Columbian inscription in a Near Eastern script from a documented excavation with secure stratigraphy.',
          'Ancient DNA from securely dated pre-Columbian remains showing a Near Eastern lineage.',
          'A limited-geography model making specific, falsifiable archaeological predictions that were then confirmed.',
          'Metallurgical evidence in the relevant period and region matching what the narrative implies.',
        ],
        evidence: [
          {
            title: 'Population-genetic evidence for Northeast Asian ancestry',
            description:
              'Autosomal, mitochondrial and Y-chromosome data indicate that Indigenous American populations derive predominantly from Northeast Asian founding populations entering via Beringia.',
            sourceRef: 'gen.native-american-ancestry-literature',
            relationship: 'CHALLENGES',
            dimension: 'independent_sources',
            directness: 0.8,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'The strongest external evidence bearing on the claim. Note the corpus record is marked UNVERIFIED: it stands for a body of literature rather than a specific paper, and no individual study has been reconciled against a catalogue here. The overall finding is not in scientific dispute, but this citation should not be read as authority for any particular publication.',
          },
          {
            title: 'Absence of Old World domesticates and metallurgy',
            description:
              'Horses, cattle, sheep, wheat, barley and iron and steel metallurgy of the kind the narrative implies have not been identified in securely dated pre-Columbian American contexts.',
            sourceRef: 'bom.southerton-lost-tribe',
            relationship: 'CHALLENGES',
            dimension: 'material_culture',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'Domesticated animals and crops leave durable and distinctive traces — bone, pollen, phytoliths — across large areas. Their absence is more informative than the absence of perishable goods would be.',
          },
          {
            title: 'The limited-geography model',
            description:
              'Sorenson argues the narrative describes a restricted Mesoamerican setting and a small population absorbed into a much larger existing one, which would change what evidence should be expected.',
            sourceRef: 'bom.sorenson-setting',
            relationship: 'WEAKLY_SUPPORTS',
            dimension: 'geographic_accuracy',
            directness: 0.7,
            relevance: 0.85,
            independence: 0.75,
            excerpt: null,
            whyItMatters:
              'Recorded as weak support rather than as context, because Sorenson argues it as a positive case: that internal distances and travel times fit a restricted Mesoamerican setting. It also bears on the absence argument — a small group absorbed into a large population would not leave the trace a founding migration would — and it narrows what the claim predicts, which cuts both ways, since a claim that predicts less is harder to confirm as well as harder to disconfirm.',
          },
          {
            title: 'Founder effect and genetic drift argument',
            description:
              'The official Latter-day Saint position holds that founder effect, genetic drift and population bottlenecks could erase a small Near Eastern genetic signal over two millennia.',
            sourceRef: 'bom.gospel-topics-dna',
            relationship: 'CONTEXTUAL',
            dimension: 'independent_sources',
            directness: 0.7,
            relevance: 0.8,
            independence: 0.7,
            excerpt: null,
            whyItMatters:
              'The mechanisms invoked are real population-genetic phenomena, not ad hoc inventions. What is contested is whether they suffice to account for the complete absence of a detectable signal. Recorded as contextual because it addresses what the evidence can show rather than supplying evidence for the claim.',
          },
          {
            title: 'No pre-Columbian Near Eastern inscriptions from documented excavations',
            description:
              'No inscription in a Near Eastern script has been recovered from a securely dated, stratigraphically documented pre-Columbian American context.',
            sourceRef: 'bom.southerton-lost-tribe',
            relationship: 'CHALLENGES',
            dimension: 'archaeological_correspondence',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'A literate population maintaining records over centuries, as the narrative describes, would be expected to leave epigraphic traces. Mesoamerica has been extensively excavated and its writing systems are well studied.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'independent_sources',
            reasoningSummary:
              'Independent genetic evidence points elsewhere; no independent source corroborates the migration.',
            strength: 0.2,
          },
          {
            dimensionType: 'archaeological_correspondence',
            reasoningSummary:
              'Expected epigraphic and material correspondences have not been identified in a well-excavated region.',
            strength: 0.2,
          },
          {
            dimensionType: 'material_culture',
            reasoningSummary:
              'Old World domesticates and metallurgy are absent from securely dated contexts.',
            strength: 0.18,
          },
          {
            dimensionType: 'geographic_accuracy',
            reasoningSummary:
              'No fixed geography, which limits what the claim predicts and therefore what could confirm or disconfirm it.',
            strength: 0.3,
          },
          {
            dimensionType: 'chronological_fit',
            reasoningSummary:
              'The narrative period is well studied archaeologically, and the expected correspondences have not appeared.',
            strength: 0.25,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The 1830 text is documented, but its own antiquity is not established by manuscript evidence in the way an ancient text\'s would be. No pre-1829 manuscript witness exists.',
          },
          {
            dimension: 'historical',
            applicable: true,
            reasoningSummary:
              'Independent genetic and archaeological evidence does not corroborate the claim and in places runs against it. The absence is assessed formally below rather than asserted.',
          },
          {
            dimension: 'interpretive',
            applicable: true,
            reasoningSummary:
              'What the narrative predicts archaeologically depends heavily on which geographic model is adopted, and the models differ substantially.',
          },
        ],
        interpretations: [
          {
            name: 'Hemispheric model',
            description:
              'The narrative describes populations spread across the Americas, with the described peoples as principal ancestors of Indigenous American populations.',
            tradition: 'LATTER_DAY_SAINT',
            scholarlyPosition: 'MINORITY_POSITION',
            directTextualSupport:
              'The plain sense of nineteenth-century readings of the text, and the reading assumed for much of the tradition\'s history.',
            canonicalSupport: 'Statements within the tradition historically supporting a broad geography.',
            historicalReception:
              'Predominant within the tradition into the twentieth century; largely superseded in Latter-day Saint scholarship since.',
            assumptionsRequired: [
              'That a large founding population left no detectable genetic or material trace.',
            ],
            counterarguments: [
              'Genetic evidence indicates predominantly Northeast Asian ancestry across the hemisphere.',
              'A hemispheric population of the size implied would be expected to leave substantial archaeological traces.',
            ],
            strength: 0.12,
          },
          {
            name: 'Limited-geography model',
            description:
              'The narrative describes a restricted Mesoamerican setting, with a small migrating group absorbed into a much larger existing population.',
            tradition: 'LATTER_DAY_SAINT',
            scholarlyPosition: 'PLURALITY_POSITION',
            directTextualSupport:
              'Internal distances and travel times in the narrative are argued to fit a limited region better than a hemispheric one.',
            canonicalSupport: 'Consistent with the text on its proponents\' reading; not universally accepted within the tradition.',
            historicalReception:
              'The dominant model in Latter-day Saint scholarship since Sorenson, and the frame of the official Gospel Topics essay.',
            assumptionsRequired: [
              'That the migrating group was small enough to leave no detectable genetic signal.',
              'That narrative geography maps onto a specific Mesoamerican region.',
              'That cultural assimilation was rapid and near-total.',
            ],
            counterarguments: [
              'The specific material culture and epigraphy the narrative implies have still not been identified in the proposed region.',
              'The model makes the claim substantially harder to test, which weakens it as a positive case even as it blunts the absence argument.',
            ],
            strength: 0.3,
          },
          {
            name: 'Non-historical composition',
            description:
              'The narrative is a nineteenth-century composition and does not describe actual pre-Columbian events.',
            tradition: 'SECULAR_HISTORICAL_CRITICAL',
            scholarlyPosition: 'BROAD_CONSENSUS',
            directTextualSupport:
              'Features of the text argued to reflect a nineteenth-century American setting.',
            canonicalSupport: 'Not applicable.',
            historicalReception: 'The standard position in non-Latter-day Saint scholarship.',
            assumptionsRequired: [
              'That the absence of corroborating evidence is best explained by non-historicity rather than by recovery limits.',
            ],
            counterarguments: [
              'Absence of corroboration is not by itself demonstration of composition, and the inference needs the absence framework to be run properly rather than assumed.',
            ],
            strength: 0.72,
          },
        ],
        whyThisScore: {
          increasing: [
            'The proposed Mesoamerican region has genuine population movement and cultural complexity in the relevant period.',
            'The limited-geography model is internally coherent and reduces what the claim predicts.',
            'Founder effect and genetic drift are real mechanisms, not invented for this argument.',
          ],
          lowering: [
            'Population genetics indicates predominantly Northeast Asian ancestry with no detected Near Eastern founding lineage.',
            'Old World domesticated animals and crops are absent from securely dated pre-Columbian contexts.',
            'No pre-Columbian Near Eastern inscription has been recovered from a documented excavation.',
            'Metallurgy of the kind implied is not attested in the relevant period and region.',
            'No pre-1829 manuscript witness to the record exists.',
          ],
          uncertainties: [
            'Which geography the narrative describes.',
            'How large the migrating population was and whether it would remain detectable.',
            'Excavation coverage and organic preservation in tropical conditions.',
          ],
          assumptions: [
            'That the narrative implies a population large enough to leave a recoverable trace.',
            'That current sampling would detect a founding Near Eastern lineage if one existed.',
          ],
          alternativeInterpretations: [
            'Limited-geography model with near-total assimilation.',
            'Non-historical nineteenth-century composition.',
          ],
          missingEvidence: [
            'Ancient DNA from securely dated pre-Columbian remains showing Near Eastern lineage.',
            'Epigraphic material in a Near Eastern script from a documented excavation.',
            'Old World domesticates from secure pre-Columbian contexts.',
          ],
          scholarlyDisagreements: [
            'Mainstream archaeology and genetics on one side; a distinct Latter-day Saint scholarly literature on the other. The two largely address different questions, which is itself part of why the dispute persists.',
          ],
          conclusion:
            'External evidence for this particular historical proposition is presently weak, and in the case of the genetic data runs against it. That is a statement about what the available evidence shows, and it is not a statement that the tradition is false — those are different claims, resting on different kinds of grounds, and only the first is assessed here.',
        },
        certaintyBreakdown: {
          certain: [
            'No Near Eastern founding lineage has been identified in Indigenous American population genetics.',
            'No pre-Columbian Near Eastern inscription has been recovered from a documented excavation.',
          ],
          probable: [
            'Indigenous American populations derive predominantly from Northeast Asian founding populations.',
            'A hemispheric migration of the scale sometimes proposed would have left detectable traces.',
          ],
          possible: [
            'That a very small group could migrate and be absorbed without leaving a detectable genetic signal.',
          ],
          speculative: [
            'Specific identifications of narrative locations with known archaeological sites.',
          ],
          unknown: [
            'How much relevant material remains unexcavated in the proposed regions.',
            'What proportion of organic evidence would survive tropical conditions over two millennia.',
          ],
        },
        penalties: {
          missingEvidence: 0.45,
          sourceDependence: 0.3,
          chronologyUncertainty: 0.4,
          interpretiveAmbiguity: 0.5,
          scholarlyDisagreement: 0.3,
        },
        absence: {
          verdict: 'EXPECTED_EVIDENCE_CONSPICUOUSLY_ABSENT',
          wouldEvidenceSurvive:
            'Partly. Organic material survives poorly in tropical Mesoamerica, but bone, pollen, phytoliths, metallurgical residue and stone inscriptions do survive, and these are the categories the claim most directly predicts.',
          excavationCoverage:
            'High for Mesoamerica specifically. It is one of the most intensively excavated regions outside the Mediterranean, and its writing systems have been extensively studied and substantially deciphered.',
          expectedMaterialFootprint:
            'On a hemispheric reading, very large. On a limited-geography reading, considerably smaller — though a literate population maintaining records across centuries would still be expected to leave epigraphic traces.',
          datingPrecision:
            'Good. The narrative period of roughly 600 BCE to 400 CE is well covered by Mesoamerican chronology.',
          materialCultureDistinctiveness:
            'High. Old World domesticates, Near Eastern scripts and iron metallurgy would be immediately recognisable against the local material culture and could not be mistaken for indigenous development.',
          penalty: 0.62,
        },
        prophetic: null,
        metaphysical: null,
      },
    },

    {
      statement:
        'The Book of Mormon is scripture of divine origin, translated by the gift and power of God.',
      claimType: 'METAPHYSICAL',
      scope: 'The origin and status of the record',
      rationale:
        'The claim that actually matters to adherents, and the one this framework cannot adjudicate. Saying so explicitly is part of the methodology.',
      assessment: {
        summary:
          'Not directly scorable under historical method. Whether a text is of divine origin is not a proposition that manuscript evidence, archaeology or population genetics can settle in either direction. Assigning it a low number because external corroboration for an associated historical claim is weak would be a category error, and assigning it a high one because a tradition holds it would be another.',
        scope: 'The origin and status of the record',
        scholarlyPosition: 'INSUFFICIENT_LITERATURE',
        scholarlyLandscape:
          'Not a question academic history adjudicates. Scholarship addresses the composition, the historical claims and the reception; the metaphysical claim is held or rejected on grounds outside that literature.',
        positionNote: 'Not directly scorable under historical method.',
        assumptions: [],
        uncertainties: [
          'The relationship between the historical claims and the theological claim is itself contested. Some adherents treat the historicity of the narrative as essential to the record\'s divine origin; others do not.',
        ],
        whatWouldChangeThis: [
          'Nothing within historical method. The claim would remain unadjudicated by this framework whatever the archaeology showed.',
        ],
        evidence: [],
        dimensionReasoning: [
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'Internally coherent within the tradition\'s canon, which is a statement about coherence and not about origin.',
            strength: 0.5,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'Not applicable in the usual sense: the record has no ancient reception history independent of the tradition that produced it.',
            strength: 0.2,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: false,
            reasoningSummary:
              'Manuscript evidence can establish what a text says and how it was transmitted. It cannot establish that a text is of divine origin.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'Historical method addresses what happened, not whether an event had a divine cause. It cannot reach this claim.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'The claim is not an interpretation of a text; it is a claim about the text\'s origin and status.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [],
          lowering: [],
          uncertainties: [
            'Whether the tradition\'s theological claim depends on the historicity of the narrative is disputed within the tradition itself.',
          ],
          assumptions: [],
          alternativeInterpretations: [],
          missingEvidence: [],
          scholarlyDisagreements: [],
          conclusion:
            'This claim receives no numerical evidence confidence, and that is the correct output rather than an evasion. Historical and textual method have no purchase on divine origin. The framework says what it can assess and stops where its methods stop.',
        },
        certaintyBreakdown: {
          certain: [],
          probable: [],
          possible: [],
          speculative: [],
          unknown: [
            'Everything this claim asserts lies outside what historical and textual method can reach.',
          ],
        },
        penalties: {
          missingEvidence: 0,
          sourceDependence: 0,
          chronologyUncertainty: 0,
          interpretiveAmbiguity: 0,
          scholarlyDisagreement: 0,
        },
        absence: null,
        prophetic: null,
        metaphysical: {
          historicalReach:
            'Historical method can assess the 1830 publication, the composition circumstances, and the historical propositions the narrative makes. It cannot assess whether the record originated with God. No quantity of archaeology would settle the question either way.',
          theologicalReading:
            'Within the Latter-day Saint tradition the claim is grounded in personal revelation and the witness of the Spirit, explicitly rather than in external corroboration. Whether that is adequate grounds is a theological and epistemological question, and it is not one this framework is built to answer.',
        },
      },
    },
  ],
};
