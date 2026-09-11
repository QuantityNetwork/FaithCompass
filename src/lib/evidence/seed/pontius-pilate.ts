/**
 * Historical and archaeological demonstration.
 *
 * Included because it is the cleanest available illustration of the boundary
 * the product insists on: the same figure supports an extremely well-evidenced
 * historical claim and a claim historical method cannot reach at all, and the
 * two must not be allowed to borrow confidence from each other.
 */

import type { SeededSubject } from './types';

export const PONTIUS_PILATE: SeededSubject = {
  id: 'analysis-pontius-pilate',
  slug: 'topic/pontius-pilate',
  resourceType: 'TOPIC',
  title: 'Pontius Pilate',
  subtitle: 'What epigraphy, documentary history and literary sources establish.',
  reference: null,
  passageText: null,
  passageAttribution: null,
  summary:
    'Pilate is among the best-attested minor officials of the early Roman empire — a contemporary inscription, two near-contemporary Jewish writers, a hostile Roman historian and the Christian sources all converge. That is a strong historical result, and it does not extend to the theological claims made about the events over which he presided.',
  aliases: ['pontius pilate', 'pilate', 'pilate stone'],
  claims: [
    {
      statement:
        'Pontius Pilate was a historical Roman official who governed Judaea under Tiberius.',
      claimType: 'HISTORICAL',
      scope: 'Roman administration of Judaea, c. 26–36 CE',
      rationale:
        'A test case for what strong historical corroboration actually looks like in this period.',
      assessment: {
        summary:
          'Established. A dedicatory inscription produced during Pilate\'s own administration names him with his prefectural title, and it is corroborated by two near-contemporary Jewish writers, a hostile Roman historian, and the Christian sources — witnesses with no shared interest in inventing him.',
        scope: 'Roman administration of Judaea, c. 26–36 CE',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Universal agreement. Pilate\'s historicity is not contested by any scholarly party. Debate concerns his exact title, the length and character of his administration, and the reliability of specific incidents reported about him.',
        positionNote: null,
        assumptions: [
          'That the reconstruction of the damaged portions of the Caesarea inscription is correct.',
          'That Philo, Josephus and Tacitus did not draw on a single common source.',
        ],
        uncertainties: [
          'Whether Pilate held the title praefectus throughout, or procurator later — the inscription reads praefectus while Tacitus uses procurator, likely reflecting the terminology of Tacitus\' own day.',
          'The precise dates of his appointment and removal.',
        ],
        whatWouldChangeThis: [
          'Demonstration that the Caesarea inscription is a forgery or that its reconstruction is wrong.',
          'Evidence that Philo, Josephus and Tacitus depend on a common source, which would collapse three witnesses into one.',
        ],
        evidence: [
          {
            title: 'The Pilate Stone',
            description:
              'A limestone dedicatory inscription found at Caesarea Maritima in 1961, naming [Pon]tius Pilatus as [praef]ectus of Juda[ea] — produced during his own administration.',
            sourceRef: 'insc.pilate-stone',
            relationship: 'SUPPORTS',
            dimension: 'archaeological_correspondence',
            directness: 0.95,
            relevance: 1.0,
            independence: 1.0,
            excerpt: '[...]S TIBERIÉUM / [PON]TIUS PILATUS / [PRAEF]ECTUS IUDA[EA]E',
            whyItMatters:
              'Contemporary epigraphic evidence, produced by Pilate\'s own administration and entirely independent of any literary tradition. This is the single strongest item, and it is the kind of evidence most claims of this period simply do not have.',
          },
          {
            title: 'Philo, writing within a decade',
            description:
              'Philo of Alexandria describes Pilate in office in the Legatio ad Gaium, written around 41 CE.',
            sourceRef: 'anc.philo-legatio',
            relationship: 'SUPPORTS',
            dimension: 'external_historical_corroboration',
            directness: 0.9,
            relevance: 0.95,
            independence: 0.95,
            excerpt: null,
            whyItMatters:
              'A near-contemporary Jewish witness with no Christian interest whatever. Philo is hostile to Pilate, which affects his portrait of the man far more than the fact of the office.',
          },
          {
            title: 'Josephus on Pilate\'s administration',
            description:
              'Josephus reports several incidents from Pilate\'s governorship, including the standards in Jerusalem and the aqueduct disturbance.',
            sourceRef: 'anc.josephus-ant18',
            relationship: 'SUPPORTS',
            dimension: 'independent_sources',
            directness: 0.9,
            relevance: 0.95,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'A Jewish historian with access to Judaean administrative memory, writing independently of Philo. Note that one passage in this same book — the Testimonium Flavianum — is demonstrably interpolated, which is why passages are assessed individually rather than the source being accepted or rejected wholesale.',
          },
          {
            title: 'Tacitus, Annals 15.44',
            description:
              'Tacitus reports that "Christus" was executed under Pilate during Tiberius\' reign.',
            sourceRef: 'anc.tacitus-annals15',
            relationship: 'SUPPORTS',
            dimension: 'external_historical_corroboration',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.75,
            excerpt: null,
            whyItMatters:
              'A hostile Roman source with no motive to corroborate Christian claims. Independence is discounted because whether Tacitus drew on official records or on what Christians of his own day reported is genuinely disputed.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'archaeological_correspondence',
            reasoningSummary:
              'A contemporary inscription naming the man and his office, from a documented excavation.',
            strength: 0.95,
          },
          {
            dimensionType: 'external_historical_corroboration',
            reasoningSummary:
              'Jewish and Roman sources, hostile and neutral, corroborating independently.',
            strength: 0.92,
          },
          {
            dimensionType: 'independent_sources',
            reasoningSummary:
              'At least three genuinely independent lines: epigraphic, Jewish literary, Roman literary.',
            strength: 0.9,
          },
          {
            dimensionType: 'chronological_fit',
            reasoningSummary:
              'The sources cohere on the period of his governorship under Tiberius.',
            strength: 0.88,
          },
          {
            dimensionType: 'geographic_accuracy',
            reasoningSummary:
              'Caesarea as the prefect\'s seat is confirmed both archaeologically and in the literary sources.',
            strength: 0.9,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The literary sources are well transmitted, with one known interpolation in Josephus that does not affect the Pilate material.',
          },
          {
            dimension: 'historical',
            applicable: true,
            reasoningSummary:
              'Contemporary epigraphic evidence plus multiple independent literary witnesses, hostile and neutral alike.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'That Pilate existed and held office is not an interpretive question. The character and motives attributed to him would be.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'A contemporary dedicatory inscription from a documented excavation names Pilate with his prefectural title.',
            'Philo describes him in office within a decade of his removal.',
            'Josephus reports his administration independently of Philo.',
            'Tacitus, hostile to Christianity, reports the execution under his authority.',
            'The witnesses are epigraphic, Jewish and Roman — no shared interest in invention.',
          ],
          lowering: [
            'The inscription is damaged and partly reconstructed.',
            'Tacitus may depend on Christian report rather than official records, which would reduce his independence.',
          ],
          uncertainties: [
            'Whether the title was praefectus throughout or procurator later.',
            'The precise dates of appointment and removal.',
          ],
          assumptions: [
            'That the reconstruction of the damaged inscription is correct.',
          ],
          alternativeInterpretations: [],
          missingEvidence: [
            'Roman administrative records from the province itself, which do not survive.',
          ],
          scholarlyDisagreements: [
            'None on historicity. Disagreement concerns title, chronology and the reliability of particular incidents.',
          ],
          conclusion:
            'Pilate\'s historicity is as well established as that of any minor Roman provincial official, and better than most. This is what strong historical corroboration actually looks like — and it is worth noting how rarely a claim of this period has it.',
        },
        certaintyBreakdown: {
          certain: [
            'An inscription naming Pontius Pilatus as prefect of Judaea was recovered at Caesarea Maritima.',
            'Philo, Josephus and Tacitus all refer to Pilate governing Judaea under Tiberius.',
          ],
          probable: [
            'Pilate governed from roughly 26 to 36 CE.',
            'His formal title during his tenure was praefectus.',
          ],
          possible: [
            'That specific incidents Josephus reports are shaped by his own apologetic aims.',
          ],
          speculative: [
            'Reconstructions of Pilate\'s personal motives and character.',
          ],
          unknown: [
            'His career before and after the Judaean prefecture.',
          ],
        },
        penalties: {
          missingEvidence: 0.15,
          sourceDependence: 0.2,
          chronologyUncertainty: 0.2,
          interpretiveAmbiguity: 0.1,
          scholarlyDisagreement: 0.05,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    {
      statement:
        'The execution carried out under Pilate\'s authority accomplished the redemption of humanity.',
      claimType: 'METAPHYSICAL',
      scope: 'Theological significance of the crucifixion',
      rationale:
        'Placed alongside the previous claim deliberately: the strength of the historical result must not be allowed to transfer to the theological one.',
      assessment: {
        summary:
          'Not directly scorable under historical method. That a man was executed under Pilate is a historical claim with strong support. That the execution accomplished redemption is a theological claim about the meaning of an event, and no quantity of epigraphic or documentary evidence bears on it in either direction.',
        scope: 'Theological significance of the crucifixion',
        scholarlyPosition: 'INSUFFICIENT_LITERATURE',
        scholarlyLandscape:
          'Not a question historical scholarship adjudicates. Historians assess the execution, its circumstances and the origins of the belief that grew from it. The theological claim is addressed in systematic theology, on grounds outside historical method.',
        positionNote: 'Not directly scorable under historical method.',
        assumptions: [],
        uncertainties: [
          'The relationship between historical evidence and theological claims about the same event is itself philosophically contested.',
        ],
        whatWouldChangeThis: [
          'Nothing within historical method. The strength of the historical result about Pilate does not transfer to this claim, and never could.',
        ],
        evidence: [],
        dimensionReasoning: [
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'Deeply grounded in the New Testament writings and in the historic creeds, which is a statement about textual grounding rather than about the truth of the claim.',
            strength: 0.85,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'Attested in the earliest Christian material, including creedal formulae that predate the surviving letters.',
            strength: 0.85,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: false,
            reasoningSummary:
              'Manuscript evidence can establish what the New Testament says about the crucifixion. It cannot establish that the claim is true.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'Historical method can establish that the execution occurred and that belief in its significance arose very early. It cannot adjudicate supernatural causation or metaphysical efficacy.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'The claim is not a reading of a text but a proposition about what an event accomplished.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [],
          lowering: [],
          uncertainties: [
            'Whether historical evidence can bear on theological claims about the meaning of events at all.',
          ],
          assumptions: [],
          alternativeInterpretations: [],
          missingEvidence: [],
          scholarlyDisagreements: [],
          conclusion:
            'No numerical evidence confidence is issued. Historical evidence can establish that a man was executed under a named prefect and that belief in the significance of that execution arose within a few years. It cannot demonstrate supernatural causation, and a system that pretended otherwise would be doing theology while claiming to do history.',
        },
        certaintyBreakdown: {
          certain: [],
          probable: [],
          possible: [],
          speculative: [],
          unknown: [
            'The metaphysical content of the claim lies entirely outside what historical method can reach.',
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
            'Historical method reaches the execution, its date, its circumstances and the early emergence of belief in its significance — including creedal material datable to within a few years of the event. It stops precisely there. Supernatural causation is not a hypothesis historical method is equipped to test.',
          theologicalReading:
            'Christian theology holds the claim on the basis of revelation, the apostolic witness and the reception of the church. Those are the claim\'s actual grounds, and presenting historical corroboration of surrounding events as though it established them would misrepresent both the history and the theology.',
        },
      },
    },
  ],
};
