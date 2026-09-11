/**
 * Miracle demonstration: the resurrection of Jesus.
 *
 * The sharpest available test of the product's central discipline. Several
 * claims usually travel together here and are supported very differently: that
 * a man was crucified under Pilate, that his followers came to believe he had
 * been raised, that the tomb was found empty, and that God raised him.
 *
 * The first is about as secure as ancient history gets. The second is nearly as
 * secure and is often mistaken for the fourth. The third is genuinely disputed.
 * The fourth is not a proposition historical method can reach in either
 * direction, and the analysis says so rather than smuggling the strength of the
 * first three into it.
 */

import type { SeededSubject } from './types';

export const RESURRECTION: SeededSubject = {
  id: 'analysis-resurrection',
  slug: 'topic/resurrection-of-jesus',
  resourceType: 'TOPIC',
  title: 'The Resurrection of Jesus',
  subtitle: 'Where historical method reaches, and where it stops.',
  reference: null,
  passageText: null,
  passageAttribution: null,
  summary:
    'Four claims are routinely treated as one and are supported very differently. The crucifixion under Pilate is among the best-attested events of its kind. That the earliest followers believed they had encountered him alive is nearly as secure, and is a claim about their conviction, not about its cause. The empty tomb is disputed. That God raised him is not adjudicable by historical method at all — and the strength of the first three claims does not transfer to the fourth.',
  aliases: ['resurrection', 'resurrection of jesus', 'empty tomb', 'easter'],
  claims: [
    /* ---------------- Claim 1: crucifixion ---------------- */
    {
      statement: 'Jesus of Nazareth was crucified under the authority of Pontius Pilate.',
      claimType: 'BIOGRAPHICAL',
      scope: 'Judaea, c. 30–33 CE',
      rationale:
        'The foundation of every other claim here, and the one with the widest independent attestation.',
      assessment: {
        summary:
          'Established. Attested by Christian sources, by a Jewish historian, and by a Roman historian hostile to Christianity, within a century of the event. The convergence of sources with no shared interest is what carries this, and it is a stronger evidential position than most events of this period enjoy.',
        scope: 'Judaea, c. 30–33 CE',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Effectively unanimous, including among scholars with no religious commitment. Crucifixion is often described in the critical literature as among the most certain facts about Jesus, partly because it is the sort of detail an inventing tradition would have no motive to produce: an executed criminal was an obstacle to the movement\'s claims, not an asset.',
        positionNote: null,
        assumptions: [
          'That Tacitus is not simply repeating what Christians of his own day reported.',
          'That the Pilate material in Josephus is authentic even where the surrounding Testimonium is interpolated.',
        ],
        uncertainties: [
          'The precise year, which the sources do not fix.',
          'How far Tacitus is independent of Christian report.',
        ],
        whatWouldChangeThis: [
          'Demonstration that the Tacitus passage is a later interpolation.',
          'Evidence that all surviving references descend from a single source.',
        ],
        evidence: [
          {
            title: 'Paul, within about twenty-five years',
            description:
              'Paul refers to the crucifixion as established fact in a letter datable to the mid-50s CE, writing to a community that already knew it.',
            sourceRef: 'anc.1corinthians15',
            relationship: 'SUPPORTS',
            dimension: 'independent_sources',
            directness: 0.9,
            relevance: 0.95,
            independence: 0.9,
            excerpt: 'that Christ died for our sins in accordance with the Scriptures, that he was buried…',
            whyItMatters:
              'A named author writing within living memory, to people in a position to contradict him. The interval here is exceptionally short by the standards of ancient history.',
          },
          {
            title: 'Tacitus reports the execution under Pilate',
            description:
              'A Roman senatorial historian, hostile to Christianity, records that "Christus" was executed under Pilate during Tiberius\' reign.',
            sourceRef: 'anc.tacitus-annals15',
            relationship: 'SUPPORTS',
            dimension: 'external_historical_corroboration',
            directness: 0.8,
            relevance: 0.9,
            independence: 0.75,
            excerpt: null,
            whyItMatters:
              'A hostile source with no motive to corroborate Christian claims. Discounted for independence because whether Tacitus drew on records or on contemporary Christian report is genuinely disputed.',
          },
          {
            title: 'Josephus refers to the execution',
            description:
              'Josephus refers to Jesus\' execution under Pilate; the surrounding passage is partly interpolated by later Christian hands, but the core reference is generally regarded as authentic.',
            sourceRef: 'anc.josephus-ant18',
            relationship: 'SUPPORTS',
            dimension: 'independent_sources',
            directness: 0.75,
            relevance: 0.85,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'An independent Jewish witness. The known interpolation in this very passage is why the source is assessed clause by clause rather than accepted or rejected whole.',
          },
          {
            title: 'Pilate held the office',
            description:
              'A contemporary inscription confirms Pilate as prefect of Judaea in the relevant period.',
            sourceRef: 'insc.pilate-stone',
            relationship: 'SUPPORTS',
            dimension: 'archaeological_correspondence',
            directness: 0.7,
            relevance: 0.8,
            independence: 1.0,
            excerpt: null,
            whyItMatters:
              'Epigraphic confirmation of the setting. It establishes that the official named held the office, not that this execution occurred — a narrower contribution than it is often made to carry.',
          },
          {
            title: 'Critical scholarship treats it as secure',
            description:
              'Sanders lists the crucifixion among the facts about Jesus that can be established by ordinary historical method.',
            sourceRef: 'sch.sanders-historical-jesus',
            relationship: 'SUPPORTS',
            dimension: 'scholarly_consensus',
            directness: 0.75,
            relevance: 0.85,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'From a scholar with no confessional stake in the conclusion, working by standard historical criteria.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'independent_sources',
            reasoningSummary:
              'Christian, Jewish and Roman sources converge, with no shared interest in the claim.',
            strength: 0.92,
          },
          {
            dimensionType: 'external_historical_corroboration',
            reasoningSummary: 'Non-Christian attestation within a century, from a hostile source.',
            strength: 0.85,
          },
          {
            dimensionType: 'archaeological_correspondence',
            reasoningSummary: 'The administrative setting is epigraphically confirmed.',
            strength: 0.8,
          },
          {
            dimensionType: 'chronological_fit',
            reasoningSummary: 'The sources cohere on the period, though not on the precise year.',
            strength: 0.82,
          },
          {
            dimensionType: 'scholarly_consensus',
            reasoningSummary: 'Effectively unanimous across confessional and secular scholarship.',
            strength: 0.93,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: false,
            reasoningSummary:
              'The claim is about an event, not a wording. The transmission of the sources reporting it is assessed within each source\'s reliability note.',
          },
          {
            dimension: 'historical',
            applicable: true,
            reasoningSummary:
              'Multiple independent witnesses within a century, including hostile ones, in a confirmed administrative setting.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'That the execution occurred is not an interpretive question. What it accomplished is, and is assessed separately.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'Paul refers to it as established fact within about twenty-five years.',
            'Tacitus, hostile to Christianity, reports it independently.',
            'Josephus provides independent Jewish attestation.',
            'A contemporary inscription confirms Pilate held the office.',
            'Critical scholarship with no confessional stake treats it as secure.',
          ],
          lowering: [
            'Tacitus may depend on Christian report rather than records.',
            'The passage in Josephus sits beside a known Christian interpolation.',
            'The precise year is not fixed by any source.',
          ],
          uncertainties: ['How far the non-Christian sources are genuinely independent.'],
          assumptions: ['That the core Josephus reference is authentic.'],
          alternativeInterpretations: [],
          missingEvidence: ['Roman provincial administrative records, which do not survive.'],
          scholarlyDisagreements: ['None material to the claim.'],
          conclusion:
            'About as securely established as any event of its kind in this period. Note what it does and does not carry: it establishes an execution, and nothing about what followed it.',
        },
        certaintyBreakdown: {
          certain: ['Paul, Tacitus and Josephus all refer to the execution under Pilate.'],
          probable: ['Jesus was crucified in Judaea during Pilate\'s prefecture, c. 30–33 CE.'],
          possible: ['That Tacitus drew on official records rather than Christian report.'],
          speculative: ['Reconstructions of the precise legal basis of the sentence.'],
          unknown: ['The exact year.'],
        },
        penalties: {
          missingEvidence: 0.15,
          sourceDependence: 0.25,
          chronologyUncertainty: 0.2,
          interpretiveAmbiguity: 0.05,
          scholarlyDisagreement: 0.05,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 2: early belief ---------------- */
    {
      statement:
        'Within a few years of the crucifixion, Jesus\' earliest followers were convinced they had encountered him alive.',
      claimType: 'HISTORICAL',
      scope: 'The origins of resurrection belief, c. 30–40 CE',
      rationale:
        'The claim most often confused with the theological one. It concerns what people believed and when, which is a historical question, and says nothing by itself about whether the belief was true.',
      assessment: {
        summary:
          'Strongly established, and routinely mistaken for a stronger claim than it is. The creedal material Paul quotes at 1 Corinthians 15:3–7 uses handover language indicating he received it already formulated, placing it within a few years of the crucifixion; Paul also states he had met some of the people the formula names. This establishes the conviction, its early date and its named bearers. It establishes nothing whatever about its cause.',
        scope: 'The origins of resurrection belief, c. 30–40 CE',
        scholarlyPosition: 'BROAD_CONSENSUS',
        scholarlyLandscape:
          'Broadly agreed across the spectrum, including by scholars who reject the resurrection entirely. Ehrman and Lüdemann accept the early conviction and explain it as visionary experience; Wright accepts it and argues bodily resurrection is the better explanation; Allison accepts it and declines to adjudicate. The agreement on the datum, and the disagreement on its explanation, is exactly the distinction this analysis is built to preserve.',
        positionNote: null,
        assumptions: [
          'That Paul\'s handover language marks quoted pre-formed tradition rather than his own composition.',
          'That the named figures in the formula were known to the Corinthian audience.',
        ],
        uncertainties: [
          'How much of 1 Corinthians 15:3–7 is the received formula and how much is Paul\'s expansion.',
          'The precise dating of the formula within the first decade.',
        ],
        whatWouldChangeThis: [
          'Demonstration that the passage is a later interpolation rather than early tradition.',
          'Evidence that resurrection belief emerged substantially later than the formula implies.',
          'Linguistic analysis showing the handover language does not indicate quoted tradition.',
        ],
        evidence: [
          {
            title: 'The creedal formula at 1 Corinthians 15:3–7',
            description:
              'Paul introduces the material with handover language conventionally marking transmitted tradition, and names Cephas, the twelve, a group of more than five hundred, James and the apostles.',
            sourceRef: 'anc.1corinthians15',
            relationship: 'SUPPORTS',
            dimension: 'independent_sources',
            directness: 0.95,
            relevance: 1.0,
            independence: 0.9,
            excerpt:
              'For I delivered to you as of first importance what I also received: that Christ died for our sins… and that he appeared to Cephas, then to the twelve.',
            whyItMatters:
              'The single most important item. Material Paul received rather than composed must predate the letter, which places the belief within a few years of the crucifixion — an interval that leaves very little room for legendary development.',
          },
          {
            title: 'Paul names people he had met',
            description:
              'Paul states elsewhere that he met Cephas and James personally, and the formula names both.',
            sourceRef: 'anc.1corinthians15',
            relationship: 'SUPPORTS',
            dimension: 'provenance',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.6,
            excerpt: null,
            whyItMatters:
              'Connects the tradition to named, locatable people rather than to anonymous report. Independence is discounted because this is the same source as the item above, not a second witness.',
          },
          {
            title: 'Critical scholarship accepts the datum',
            description:
              'Sanders lists the disciples\' conviction that they had seen the risen Jesus among the facts establishable by ordinary historical method, while declining to explain it.',
            sourceRef: 'sch.sanders-historical-jesus',
            relationship: 'SUPPORTS',
            dimension: 'scholarly_consensus',
            directness: 0.85,
            relevance: 0.9,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'Accepted by a scholar with no confessional stake, who is explicit that accepting the conviction is not accepting its cause.',
          },
          {
            title: 'A sceptical account accepts the same datum',
            description:
              'Ehrman accepts that the earliest followers believed they had seen Jesus alive, and explains it as visionary experience.',
            sourceRef: 'sch.ehrman-how-jesus-became-god',
            relationship: 'SUPPORTS',
            dimension: 'independent_sources',
            directness: 0.75,
            relevance: 0.85,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'Counts as support for this claim precisely because its author rejects the theological one. That a hostile explanation still requires the datum is strong evidence for the datum.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'independent_sources',
            reasoningSummary:
              'Early creedal material naming identifiable figures, accepted across the interpretive spectrum.',
            strength: 0.88,
          },
          {
            dimensionType: 'dating_confidence',
            reasoningSummary:
              'The handover formula places the tradition within a few years of the crucifixion.',
            strength: 0.82,
          },
          {
            dimensionType: 'provenance',
            reasoningSummary: 'Traceable to named people the author states he had met.',
            strength: 0.8,
          },
          {
            dimensionType: 'scholarly_consensus',
            reasoningSummary:
              'Agreed by scholars who accept and by scholars who reject the theological claim.',
            strength: 0.9,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: false,
            reasoningSummary:
              'The claim concerns what people believed, not the wording of a text. The transmission of 1 Corinthians is not in dispute.',
          },
          {
            dimension: 'historical',
            applicable: true,
            reasoningSummary:
              'Very early creedal material naming identifiable figures, accepted across the interpretive spectrum.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'What caused the conviction is a separate question and is assessed on the claims below.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'The handover language marks material Paul received rather than composed.',
            'The formula names identifiable figures, two of whom Paul states he had met.',
            'The interval leaves very little room for legendary development.',
            'Accepted by scholars who reject the theological claim as well as those who hold it.',
          ],
          lowering: [
            'The boundaries of the received formula within the passage are uncertain.',
            'Paul is the sole witness to the formula itself; the later narratives are not independent of the tradition it represents.',
          ],
          uncertainties: ['How much of the passage is quoted and how much is Paul\'s expansion.'],
          assumptions: ['That the handover language marks quoted tradition.'],
          alternativeInterpretations: [
            'That the formula is Paul\'s own composition, which would weaken the dating but not remove the early belief.',
          ],
          missingEvidence: ['Any independent first-generation account of the experiences themselves.'],
          scholarlyDisagreements: [
            'Not over the conviction or its date, but over what caused it — which is a different claim.',
          ],
          conclusion:
            'That the earliest followers were convinced, and convinced very early, is well established. This is a claim about what people believed. It is the most frequently over-read result in this subject: it does not by itself support any explanation of the belief, and the explanations are assessed separately below.',
        },
        certaintyBreakdown: {
          certain: ['1 Corinthians 15:3–7 presents itself as transmitted tradition and names specific figures.'],
          probable: [
            'The formula predates the letter by a substantial margin.',
            'Resurrection belief arose within a few years of the crucifixion.',
          ],
          possible: ['That parts of the passage are Paul\'s expansion of a shorter core.'],
          speculative: ['Reconstructions of the formula\'s exact original wording.'],
          unknown: ['The nature of the experiences the formula reports.'],
        },
        penalties: {
          missingEvidence: 0.25,
          sourceDependence: 0.35,
          chronologyUncertainty: 0.2,
          interpretiveAmbiguity: 0.15,
          scholarlyDisagreement: 0.1,
        },
        absence: null,
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 3: empty tomb ---------------- */
    {
      statement: 'The tomb in which Jesus was buried was found empty.',
      claimType: 'HISTORICAL',
      scope: 'Jerusalem, c. 30–33 CE',
      rationale:
        'Genuinely disputed among scholars who agree about the crucifixion and the early belief, which makes it the best available illustration of a real division.',
      assessment: {
        summary:
          'Disputed on the evidence, not along confessional lines alone. The narrative is early and has the awkward feature of resting on women\'s testimony, which an inventing tradition in this setting would have had reason to avoid. Against it: the earliest creedal material does not mention the tomb, and the earliest narrative account ends at a point its best manuscripts do not carry past. Both considerations are real, and the assessment does not resolve them.',
        scope: 'Jerusalem, c. 30–33 CE',
        scholarlyPosition: 'SIGNIFICANTLY_DISPUTED',
        scholarlyLandscape:
          'A genuine division. Many scholars, including critical ones, accept the empty tomb as historically probable on the grounds of early attestation and the women\'s testimony. Others, including Ehrman, regard the burial narrative itself as questionable, noting that crucifixion victims were commonly denied individual burial. Allison surveys both cases and concludes the evidence underdetermines the question. This is a dispute about evidence rather than about theology: it does not track confessional lines cleanly.',
        positionNote: 'Significantly disputed among scholars who agree on the surrounding claims.',
        assumptions: [
          'That Jesus received individual burial in an identifiable tomb rather than the common treatment of crucifixion victims.',
          'That the narrative tradition is independent enough of the creedal tradition to count as separate attestation.',
        ],
        uncertainties: [
          'Whether the silence of the creedal formula about the tomb is significant or merely a function of its brevity.',
          'How far the later narratives depend on Mark rather than attesting independently.',
        ],
        whatWouldChangeThis: [
          'Evidence that individual burial of crucifixion victims was routine, or that it was effectively impossible, in first-century Judaea.',
          'Demonstration that the later empty-tomb narratives are wholly dependent on Mark.',
          'An early source independent of the gospel tradition referring to the tomb.',
        ],
        evidence: [
          {
            title: 'The earliest narrative account',
            description:
              'Mark 15:42–16:8 records the burial and the discovery of the empty tomb, in the earliest surviving gospel.',
            sourceRef: 'anc.mark16',
            relationship: 'SUPPORTS',
            dimension: 'independent_sources',
            directness: 0.85,
            relevance: 0.95,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'The earliest narrative source, within roughly forty years. Note its own textual problem: the best manuscripts end at 16:8, so anything resting on the longer ending carries a weakness this passage does not.',
          },
          {
            title: 'The burial and empty-tomb passage is itself securely attested',
            description:
              'Mark 15:42–16:8 is present in the earliest and best manuscripts, including the codices that omit the longer ending. No variant affects the substance of the account.',
            sourceRef: 'anc.mark16',
            relationship: 'SUPPORTS',
            dimension: 'manuscript_attestation',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'Worth separating from the problem below: the dispute about this claim is historical, not textual. Everyone is reading the same account, and the manuscript difficulty in Mark falls after the passage rather than within it.',
          },
          {
            title: 'The Markan ending is textually insecure',
            description:
              'The earliest and best manuscripts of Mark end at 16:8. The longer ending, 16:9–20, which contains the appearance narratives, is absent from them.',
            sourceRef: 'anc.mark16',
            relationship: 'WEAKLY_CHALLENGES',
            dimension: 'manuscript_attestation',
            directness: 0.75,
            relevance: 0.8,
            independence: 0.5,
            excerpt: null,
            whyItMatters:
              'The burial and empty-tomb narrative at 15:42–16:8 is not itself affected — it sits before the disputed ending. But the most consequential textual problem in the New Testament falls immediately after this passage, and an assessment that did not mention it would be concealing a weakness a reader is entitled to weigh.',
          },
          {
            title: 'The testimony rests on women',
            description:
              'All the gospel accounts place the discovery with women, whose testimony carried limited standing in the legal conventions of the setting.',
            sourceRef: 'sch.wright-resurrection',
            relationship: 'SUPPORTS',
            dimension: 'cultural_fit',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'A detail an inventing tradition would have had reason to avoid, and therefore harder to explain as invention than as report. It is one of the stronger arguments on this side and is not a confessional one.',
          },
          {
            title: 'The earliest creedal material does not mention the tomb',
            description:
              'The formula at 1 Corinthians 15:3–7 refers to burial and to appearances, but says nothing about a tomb being found empty.',
            sourceRef: 'anc.1corinthians15',
            relationship: 'CHALLENGES',
            dimension: 'independent_sources',
            directness: 0.8,
            relevance: 0.9,
            independence: 0.85,
            excerpt: null,
            whyItMatters:
              'The earliest material is silent on the point. How much that silence weighs depends on whether the formula is a summary that would omit it anyway, which is exactly what the two sides dispute.',
          },
          {
            title: 'The burial itself is questioned',
            description:
              'Ehrman argues that crucifixion victims were commonly left unburied or placed in common graves, making an identifiable individual tomb less likely than the narratives assume.',
            sourceRef: 'sch.ehrman-how-jesus-became-god',
            relationship: 'CHALLENGES',
            dimension: 'cultural_fit',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.8,
            excerpt: null,
            whyItMatters:
              'Attacks the premise rather than the report: if there was no identifiable tomb, the question of its being empty does not arise. This is the strongest form of the opposing case.',
          },
          {
            title: 'A survey concluding the evidence underdetermines the question',
            description:
              'Allison examines both cases in detail and finds neither decisive.',
            sourceRef: 'sch.allison-resurrection',
            relationship: 'CONTEXTUAL',
            dimension: 'modern_scholarly_dispute',
            directness: 0.8,
            relevance: 0.85,
            independence: 0.9,
            excerpt: null,
            whyItMatters:
              'Recorded as contextual because it supplies no evidence either way. Its value is as a check on overconfidence: the most thorough recent survey declines to settle the question, and an assessment that settled it easily would be claiming more than the literature supports.',
          },
        ],
        dimensionReasoning: [
          {
            dimensionType: 'independent_sources',
            reasoningSummary:
              'Early narrative attestation, against silence in the earliest creedal material.',
            strength: 0.55,
          },
          {
            dimensionType: 'cultural_fit',
            reasoningSummary:
              'The women\'s testimony argues for report; the burial customs of crucifixion argue against the premise.',
            strength: 0.5,
          },
          {
            dimensionType: 'source_dependence',
            reasoningSummary:
              'How far the later narratives depend on Mark rather than attesting independently is unresolved.',
            strength: 0.4,
          },
          {
            dimensionType: 'modern_scholarly_dispute',
            reasoningSummary:
              'Actively disputed on evidential rather than confessional grounds.',
            strength: 0.45,
          },
          {
            dimensionType: 'archaeological_correspondence',
            reasoningSummary:
              'First-century rock-cut tombs around Jerusalem are well attested, establishing that such burial was possible but not that it occurred here.',
            strength: 0.5,
          },
          {
            dimensionType: 'manuscript_attestation',
            reasoningSummary:
              'The passage itself is securely attested; the longer ending immediately after it is not, which constrains what may be built on Mark as a whole.',
            strength: 0.6,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: true,
            reasoningSummary:
              'The Markan account is well attested to 16:8; the longer ending is absent from the earliest and best manuscripts, which matters for anything resting on it.',
          },
          {
            dimension: 'historical',
            applicable: true,
            reasoningSummary:
              'Early attestation and an awkward detail on one side; silence in the earliest material and the burial customs of crucifixion on the other.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'Whether the tomb was empty is a question of fact, not of reading. What an empty tomb would mean is assessed separately.',
          },
        ],
        interpretations: [],
        whyThisScore: {
          increasing: [
            'Mark provides narrative attestation within roughly forty years.',
            'The discovery rests on women\'s testimony, which an inventing tradition had reason to avoid.',
            'First-century rock-cut tombs around Jerusalem establish that such burial was possible.',
          ],
          lowering: [
            'The earliest creedal material says nothing about a tomb being found empty.',
            'Crucifixion victims were commonly denied individual burial, which puts the premise in question.',
            'How far the later narratives depend on Mark is unresolved.',
            'Mark\'s own ending is the most consequential textual problem in the New Testament.',
          ],
          uncertainties: [
            'Whether the creedal silence is significant or a function of brevity.',
            'Whether the narrative and creedal traditions are genuinely independent.',
          ],
          assumptions: ['That Jesus received individual burial in an identifiable tomb.'],
          alternativeInterpretations: [
            'Burial in a common grave, on which the question does not arise.',
            'A narrative developed to account for an already-established resurrection belief.',
          ],
          missingEvidence: [
            'Any source independent of the gospel tradition referring to the tomb.',
          ],
          scholarlyDisagreements: [
            'A real division that does not track confessional lines: critical scholars are found on both sides, and the most thorough recent survey declines to settle it.',
          ],
          conclusion:
            'Genuinely disputed, and the assessment reflects that rather than resolving it. This is the weakest of the three historical claims here, and it is worth noting that the case for early resurrection belief does not depend on it: the creedal material makes no mention of the tomb.',
        },
        certaintyBreakdown: {
          certain: [
            'Mark records the burial and the empty tomb.',
            'The earliest creedal material does not mention a tomb.',
          ],
          probable: ['The empty-tomb tradition is early rather than a late development.'],
          possible: [
            'That Jesus was buried in an identifiable tomb that was later found empty.',
            'That he received the common treatment of crucifixion victims.',
          ],
          speculative: ['Identifications of the tomb with any particular site.'],
          unknown: ['What happened to the body.'],
        },
        penalties: {
          missingEvidence: 0.45,
          sourceDependence: 0.45,
          chronologyUncertainty: 0.25,
          interpretiveAmbiguity: 0.3,
          scholarlyDisagreement: 0.5,
        },
        absence: {
          verdict: 'NO_EVIDENCE_DISCOVERED',
          wouldEvidenceSurvive:
            'No. A first-century burial that was vacated within days would leave no distinguishing material trace, and an occupied one would be indistinguishable from the many others in the same region.',
          excavationCoverage:
            'Jerusalem and its surroundings are extensively excavated, and first-century rock-cut tombs are well documented. But no excavation could identify which tomb was in question, so coverage does not help here.',
          expectedMaterialFootprint:
            'Effectively none. The claim predicts no distinctive material remains of any kind.',
          datingPrecision:
            'Good for the period in general, and irrelevant to this claim, since nothing datable is predicted.',
          materialCultureDistinctiveness:
            'None. Nothing about the claim implies a recoverable or distinguishable material signature.',
          penalty: 0,
        },
        prophetic: null,
        metaphysical: null,
      },
    },

    /* ---------------- Claim 4: the metaphysical claim ---------------- */
    {
      statement: 'God raised Jesus from the dead.',
      claimType: 'METAPHYSICAL',
      scope: 'The cause of the events reported',
      rationale:
        'The claim the subject exists for, and the one historical method cannot reach. Placing it beside a claim scoring in the nineties is the point.',
      assessment: {
        summary:
          'Not directly scorable under historical method. Historical method can establish that a man was executed, that his followers were convinced very early that they had encountered him alive, and that they said so to people who could have contradicted them. It cannot establish that God acted, and no accumulation of the first three claims converts into the fourth. A system that let a 94 on the crucifixion bleed into a number here would be doing theology while claiming to do history.',
        scope: 'The cause of the events reported',
        scholarlyPosition: 'INSUFFICIENT_LITERATURE',
        scholarlyLandscape:
          'Not a question academic history adjudicates, and the most careful writers on both sides say so. Wright argues bodily resurrection is the best available historical explanation of the movement\'s origin; critics, including sympathetic ones, locate the disagreement precisely at the step from "best explanation of the evidence" to "historically demonstrated". Ehrman holds that historians cannot in principle establish a miracle, since historical method works by assessing relative probability against normal experience. Allison concludes the evidence underdetermines the question either way.',
        positionNote: 'Not directly scorable under historical method.',
        assumptions: [],
        uncertainties: [
          'Whether historical method can in principle adjudicate a claim of supernatural causation is itself a live philosophical dispute, not a settled matter this framework can assume either way.',
        ],
        whatWouldChangeThis: [
          'Nothing within historical method. The strength of the historical claims above does not transfer here, and no archaeological or documentary discovery would convert them into a demonstration of divine action.',
        ],
        evidence: [],
        dimensionReasoning: [
          {
            dimensionType: 'canonical_correspondence',
            reasoningSummary:
              'Grounded across the New Testament writings and the historic creeds. A statement about textual grounding, not about the truth of the claim.',
            strength: 0.9,
          },
          {
            dimensionType: 'ancient_reception',
            reasoningSummary:
              'Attested in the earliest Christian material, including creedal formulae that predate the surviving letters.',
            strength: 0.88,
          },
          {
            dimensionType: 'interpretive_consensus',
            reasoningSummary:
              'Universal within Christian tradition; not a proposition academic history takes a position on.',
            strength: 0.5,
          },
        ],
        primaryReasoning: [
          {
            dimension: 'textual',
            applicable: false,
            reasoningSummary:
              'Manuscript evidence can establish what the New Testament says about the resurrection, and does so well. It cannot establish that the claim is true.',
          },
          {
            dimension: 'historical',
            applicable: false,
            reasoningSummary:
              'Historical method reaches the execution, the early conviction and its named bearers. Supernatural causation is not a hypothesis it is equipped to test, and its silence here is not evidence against the claim any more than it is evidence for it.',
          },
          {
            dimension: 'interpretive',
            applicable: false,
            reasoningSummary:
              'The claim is not a reading of a text but a proposition about what caused an event.',
          },
        ],
        interpretations: [
          {
            name: 'Bodily resurrection',
            description:
              'God raised Jesus bodily, and this is the best explanation of the origin of the movement.',
            tradition: 'EVANGELICAL',
            scholarlyPosition: 'MINORITY_POSITION',
            directTextualSupport:
              'The earliest creedal material and the narrative traditions state it directly.',
            canonicalSupport: 'The unanimous claim of the New Testament writings and the historic creeds.',
            historicalReception: 'Universal in Christian tradition from the earliest surviving material.',
            assumptionsRequired: [
              'That historical method can in principle license an inference to supernatural causation.',
              'That no natural explanation accounts for the evidence as economically.',
            ],
            counterarguments: [
              'Historical method assesses relative probability against normal experience, which is the step critics say cannot be taken here.',
              'The inference is to the best explanation, which is weaker than demonstration.',
            ],
            strength: 0.45,
          },
          {
            name: 'Visionary experience',
            description:
              'The earliest followers had genuine visionary experiences, which they understood as encounters with a risen Jesus.',
            tradition: 'SECULAR_HISTORICAL_CRITICAL',
            scholarlyPosition: 'MAJORITY_POSITION',
            directTextualSupport:
              'Paul\'s own account of his experience uses language compatible with a visionary encounter.',
            canonicalSupport: 'Not applicable.',
            historicalReception: 'The standard explanation in critical scholarship.',
            assumptionsRequired: [
              'That grief-related visionary experience accounts for the conviction of a group rather than an individual.',
              'That the empty-tomb tradition is a later development.',
            ],
            counterarguments: [
              'Group visionary experience of this kind is not well paralleled.',
              'The explanation must still account for the conviction arising as early as it did.',
            ],
            strength: 0.5,
          },
        ],
        whyThisScore: {
          increasing: [],
          lowering: [],
          uncertainties: [
            'Whether historical method can adjudicate supernatural causation at all is a philosophical dispute this framework does not settle.',
          ],
          assumptions: [],
          alternativeInterpretations: [
            'Bodily resurrection as the best historical explanation.',
            'Visionary experience within a grieving community.',
          ],
          missingEvidence: [],
          scholarlyDisagreements: [],
          conclusion:
            'No numerical evidence confidence is issued, and that is the correct output rather than an evasion. The claims above are among the better-evidenced results in this corpus, and that strength stops where it stops: it establishes an execution, an early conviction, and named people who held it. Whether God acted is not a proposition historical method can reach, and presenting the strength of the surrounding claims as though it settled this one would misrepresent both the history and the theology.',
        },
        certaintyBreakdown: {
          certain: [],
          probable: [],
          possible: [],
          speculative: [],
          unknown: [
            'The metaphysical content of the claim lies outside what historical and textual method can reach.',
          ],
        },
        penalties: {
          missingEvidence: 0,
          sourceDependence: 0,
          chronologyUncertainty: 0,
          interpretiveAmbiguity: 0,
          scholarlyDisagreement: 0,
        },
        absence: {
          verdict: 'NOT_APPLICABLE',
          wouldEvidenceSurvive:
            'The question does not arise. The claim does not predict recoverable material evidence of any kind.',
          excavationCoverage: 'Not applicable.',
          expectedMaterialFootprint:
            'None. No archaeological finding would confirm or disconfirm divine action.',
          datingPrecision: 'Not applicable.',
          materialCultureDistinctiveness: 'Not applicable.',
          penalty: 0,
        },
        prophetic: null,
        metaphysical: {
          historicalReach:
            'Historical method reaches the execution under Pilate, the early emergence of resurrection belief, the named figures who held it, and the fact that they proclaimed it within living memory to people positioned to contradict them. That is a substantial result and it is where the method stops. Supernatural causation is not a hypothesis historical method is equipped to test: it works by assessing relative probability against normal experience, and an event defined as a departure from normal experience falls outside what it can weigh.',
          theologicalReading:
            'Christian theology holds the claim on the basis of the apostolic witness, the reception of the church, and revelation. Those are its actual grounds. Presenting the well-evidenced historical claims above as though they established it would misrepresent both — it would overstate what history shows, and understate what the theological claim actually rests on.',
        },
      },
    },
  ],
};
