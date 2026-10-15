/**
 * The published Claim Ledger as it stood before the October 2026 migration.
 *
 * GENERATED from tests/fixtures/live (responses captured from
 * https://am.sagolik.com/api/public on 2026-10-14). Each entry is revision 1
 * of its claim, reproduced exactly; tests/record.test.ts checks the import
 * against the fixtures so a later edit here cannot silently rewrite history.
 */

export interface LiveClaim {
  code: string;
  statement: string;
  claim_type: string;
  topic: string;
  sources: string[];
  textual_confidence: string;
  disputed: string;
  interpretive_divergence: string;
  updated_at: string;
  provenance: Array<{ position: number; label: string; detail: string }>;
}

export const LIVE_CLAIMS: LiveClaim[] = [
  {
    "code": "AM-CLAIM-000184",
    "statement": "Hebrews identifies Jesus as High Priest according to the order of Melchizedek.",
    "claim_type": "Explicit textual proposition",
    "topic": "Priesthood",
    "sources": [
      "Hebrews 5:6",
      "Hebrews 6:20",
      "Hebrews 7:17"
    ],
    "textual_confidence": "Very high",
    "disputed": "No — regarding what Hebrews explicitly states",
    "interpretive_divergence": "Begins when determining the ecclesiological implications of the claim.",
    "updated_at": "2026-09-27T22:29:11.663827+00:00",
    "provenance": [
      {
        "position": 1,
        "label": "Finding",
        "detail": "Hebrews explicitly connects Jesus' priesthood with a changed covenantal order."
      },
      {
        "position": 2,
        "label": "Claims used",
        "detail": "Psalm 110 priesthood declaration; Hebrews Melchizedek identification."
      },
      {
        "position": 3,
        "label": "Supporting evidence",
        "detail": "Hebrews 7:11-19 argument on perfection through the Levitical priesthood."
      },
      {
        "position": 4,
        "label": "Primary source",
        "detail": "Hebrews 5:6; 6:20; 7:17 in the Greek text and early manuscript witnesses."
      },
      {
        "position": 5,
        "label": "Covenant relationships",
        "detail": "Sinai → priesthood → prophetic promise → New Covenant."
      },
      {
        "position": 6,
        "label": "Doctrine connections",
        "detail": "Priesthood → Melchizedek → Jesus → sacrifice → covenant → atonement."
      },
      {
        "position": 7,
        "label": "Interpretations",
        "detail": "Attributed readings from rabbinic, patristic, Reformed and Latter-day Saint sources."
      },
      {
        "position": 8,
        "label": "Counterviews",
        "detail": "Readings that restrict the Melchizedek motif to a literary typology."
      }
    ]
  },
  {
    "code": "AM-CLAIM-000185",
    "statement": "Jeremiah announces a new covenant that is not like the covenant made at Sinai.",
    "claim_type": "Explicit textual proposition",
    "topic": "Covenant",
    "sources": [
      "Jeremiah 31:31-34"
    ],
    "textual_confidence": "Very high",
    "disputed": "No — regarding what Jeremiah explicitly states",
    "interpretive_divergence": "Divergence concerns whether the new covenant supersedes, renews or fulfils the Sinai covenant.",
    "updated_at": "2026-09-10T01:31:57.189756+00:00",
    "provenance": [
      {
        "position": 1,
        "label": "Finding",
        "detail": "A future covenant is announced in explicitly contrastive terms with Sinai."
      },
      {
        "position": 2,
        "label": "Claims used",
        "detail": "Sinai covenant obligations; prophetic promise of internalised law."
      },
      {
        "position": 3,
        "label": "Supporting evidence",
        "detail": "Jeremiah 31:32 \"not like the covenant I made with their fathers\"."
      },
      {
        "position": 4,
        "label": "Primary source",
        "detail": "Jeremiah 31:31-34 (MT and LXX witnesses)."
      },
      {
        "position": 5,
        "label": "Covenant relationships",
        "detail": "Sinai → prophetic promise → New Covenant."
      },
      {
        "position": 6,
        "label": "Doctrine connections",
        "detail": "Covenant → law → forgiveness → mediator."
      },
      {
        "position": 7,
        "label": "Interpretations",
        "detail": "Renewal, replacement and fulfilment readings remain separately attributed."
      },
      {
        "position": 8,
        "label": "Counterviews",
        "detail": "Readings that treat the passage as restoration language only."
      }
    ]
  },
  {
    "code": "AM-CLAIM-000186",
    "statement": "Psalm 110 addresses a figure who is declared a priest forever after the order of Melchizedek.",
    "claim_type": "Explicit textual proposition",
    "topic": "Priesthood",
    "sources": [
      "Psalm 110:1",
      "Psalm 110:4"
    ],
    "textual_confidence": "Very high",
    "disputed": "No — regarding the text itself",
    "interpretive_divergence": "Identification of the addressed figure is contested between traditions.",
    "updated_at": "2026-09-10T01:31:57.189756+00:00",
    "provenance": [
      {
        "position": 1,
        "label": "Finding",
        "detail": "The psalm ascribes a perpetual, non-Levitical priesthood to its addressee."
      },
      {
        "position": 2,
        "label": "Claims used",
        "detail": "Melchizedek priesthood order; royal enthronement language."
      },
      {
        "position": 3,
        "label": "Supporting evidence",
        "detail": "Second Temple reception of Psalm 110 in Qumran and later literature."
      },
      {
        "position": 4,
        "label": "Primary source",
        "detail": "Psalm 110:1, 4."
      },
      {
        "position": 5,
        "label": "Covenant relationships",
        "detail": "David → priesthood → prophetic promise."
      },
      {
        "position": 6,
        "label": "Doctrine connections",
        "detail": "Messiah → David → priesthood → Melchizedek."
      },
      {
        "position": 7,
        "label": "Interpretations",
        "detail": "Royal, messianic and christological readings are attributed separately."
      },
      {
        "position": 8,
        "label": "Counterviews",
        "detail": "Purely royal-court readings of the psalm."
      }
    ]
  },
  {
    "code": "AM-CLAIM-000187",
    "statement": "Genesis presents an unconditional promise to Abraham of descendants, land and blessing to the nations.",
    "claim_type": "Explicit textual proposition",
    "topic": "Covenant",
    "sources": [
      "Genesis 12:1-3",
      "Genesis 15:18",
      "Genesis 17:7"
    ],
    "textual_confidence": "Very high",
    "disputed": "No",
    "interpretive_divergence": "Scope of \"blessing to the nations\" is interpreted differently across traditions.",
    "updated_at": "2026-09-10T01:31:57.189756+00:00",
    "provenance": [
      {
        "position": 1,
        "label": "Finding",
        "detail": "The Abrahamic promise is stated without conditional obligation clauses."
      },
      {
        "position": 2,
        "label": "Claims used",
        "detail": "Promise of land; promise of descendants; blessing to nations."
      },
      {
        "position": 3,
        "label": "Supporting evidence",
        "detail": "Covenant ceremony of Genesis 15 and its ancient Near Eastern parallels."
      },
      {
        "position": 4,
        "label": "Primary source",
        "detail": "Genesis 12:1-3; 15:18; 17:7."
      },
      {
        "position": 5,
        "label": "Covenant relationships",
        "detail": "Creation → Noah → Abraham → Sinai."
      },
      {
        "position": 6,
        "label": "Doctrine connections",
        "detail": "Covenant → promise → election → blessing."
      },
      {
        "position": 7,
        "label": "Interpretations",
        "detail": "Traditions differ on the ongoing scope of land and descendants."
      },
      {
        "position": 8,
        "label": "Counterviews",
        "detail": "Readings that regard Genesis 17 as introducing conditionality."
      }
    ]
  },
  {
    "code": "AM-CLAIM-000188",
    "statement": "The Sinai covenant establishes a hereditary Levitical priesthood tied to sacrificial service.",
    "claim_type": "Explicit textual proposition",
    "topic": "Priesthood",
    "sources": [
      "Exodus 28:1",
      "Leviticus 8",
      "Numbers 18:1-7"
    ],
    "textual_confidence": "High",
    "disputed": "No",
    "interpretive_divergence": "Interpretations differ on the continuity of this priesthood after the Second Temple.",
    "updated_at": "2026-10-14T03:04:08.874567+00:00",
    "provenance": [
      {
        "position": 1,
        "label": "Finding",
        "detail": "Priestly service under Sinai is hereditary and sacrificial."
      },
      {
        "position": 2,
        "label": "Claims used",
        "detail": "Aaronic appointment; Levitical duties; sacrificial calendar."
      },
      {
        "position": 3,
        "label": "Supporting evidence",
        "detail": "Priestly legislation across Exodus, Leviticus and Numbers."
      },
      {
        "position": 4,
        "label": "Primary source",
        "detail": "Exodus 28:1; Leviticus 8; Numbers 18:1-7."
      },
      {
        "position": 5,
        "label": "Covenant relationships",
        "detail": "Sinai → priesthood → sacrifice."
      },
      {
        "position": 6,
        "label": "Doctrine connections",
        "detail": "Priesthood → sacrifice → atonement → mediator."
      },
      {
        "position": 7,
        "label": "Interpretations",
        "detail": "Continuity and cessation readings remain attributed."
      },
      {
        "position": 8,
        "label": "Counterviews",
        "detail": "Readings emphasising prophetic critique of sacrificial practice."
      }
    ]
  },
  {
    "code": "AM-CLAIM-000189",
    "statement": "Hebrews reads the silence of Genesis 14 about Melchizedek's genealogy as significant: \"without father or mother… resembling the Son of God.\"",
    "claim_type": "Exegetical lemma",
    "topic": "Priesthood",
    "sources": [
      "Hebrews 7:3",
      "Genesis 14:18–20"
    ],
    "textual_confidence": "High",
    "disputed": "Partly",
    "interpretive_divergence": "Whether the argument from silence is a rhetorical device, a Second Temple exegetical convention, or a claim about Melchizedek's nature is contested.",
    "updated_at": "2026-10-02T08:15:50.999443+00:00",
    "provenance": []
  },
  {
    "code": "AM-CLAIM-000190",
    "statement": "Hebrews argues that a change of priesthood necessarily entails a change of law.",
    "claim_type": "Exegetical lemma",
    "topic": "Priesthood",
    "sources": [
      "Hebrews 7:11–12",
      "Hebrews 7:18–19"
    ],
    "textual_confidence": "Very high",
    "disputed": "No",
    "interpretive_divergence": "Traditions differ on whether \"change of law\" means abrogation, fulfilment or transformation of the Mosaic law.",
    "updated_at": "2026-10-02T08:15:50.999443+00:00",
    "provenance": []
  },
  {
    "code": "AM-CLAIM-000191",
    "statement": "The Melchizedekian priesthood of Christ supersedes the Levitical priesthood and its sacrificial order.",
    "claim_type": "Doctrinal inference",
    "topic": "Priesthood",
    "sources": [
      "Hebrews 7–10",
      "Psalm 110:4",
      "Jeremiah 31:31–34"
    ],
    "textual_confidence": "Moderate",
    "disputed": "Yes",
    "interpretive_divergence": "Accepted in most Christian traditions; framed as fulfilment rather than replacement by some; rejected by Rabbinic Judaism; qualified by dispensational and post-supersessionist readings.",
    "updated_at": "2026-10-02T08:15:50.999443+00:00",
    "provenance": []
  }
];

export interface LiveCovenant {
  code: string;
  covenant_name: string;
  relationship_type: string;
  source_node: string;
  target_node: string;
  description: string;
  evidence: string[];
  confidence: string;
  updated_at: string;
}

export const LIVE_COVENANTS: LiveCovenant[] = [
  {
    "code": "AM-COV-0001",
    "covenant_name": "Noah",
    "relationship_type": "preserves",
    "source_node": "Creation",
    "target_node": "Noah",
    "description": "The Noahic covenant preserves the created order and establishes a universal sign.",
    "evidence": [
      "Genesis 8:20-22",
      "Genesis 9:1-17"
    ],
    "confidence": "High",
    "updated_at": "2026-09-11T01:14:34.419366+00:00"
  },
  {
    "code": "AM-COV-0002",
    "covenant_name": "Abraham",
    "relationship_type": "narrows through promise",
    "source_node": "Noah",
    "target_node": "Abraham",
    "description": "The universal human horizon narrows to a promised family through whom the nations will be blessed.",
    "evidence": [
      "Genesis 12:1-3",
      "Genesis 15:1-21",
      "Genesis 17:1-14"
    ],
    "confidence": "High",
    "updated_at": "2026-09-11T01:14:34.419366+00:00"
  },
  {
    "code": "AM-COV-0003",
    "covenant_name": "Sinai / Moses",
    "relationship_type": "administers",
    "source_node": "Abraham",
    "target_node": "Sinai / Moses",
    "description": "The descendants of Abraham are constituted as a covenant people with law, priesthood, sacrifice and land obligations.",
    "evidence": [
      "Exodus 19:3-8",
      "Exodus 24:3-8"
    ],
    "confidence": "High",
    "updated_at": "2026-09-11T01:14:34.419366+00:00"
  },
  {
    "code": "AM-COV-0004",
    "covenant_name": "David",
    "relationship_type": "royalizes",
    "source_node": "Sinai / Moses",
    "target_node": "David",
    "description": "The Davidic covenant locates enduring royal promise within Israel’s covenantal history.",
    "evidence": [
      "2 Samuel 7:8-16",
      "Psalm 89:3-4"
    ],
    "confidence": "High",
    "updated_at": "2026-09-11T01:14:34.419366+00:00"
  },
  {
    "code": "AM-COV-0005",
    "covenant_name": "Prophetic promise",
    "relationship_type": "anticipates renewal",
    "source_node": "Sinai / Moses",
    "target_node": "Prophetic promise",
    "description": "The prophets anticipate covenant renewal, internalized instruction and restored relationship.",
    "evidence": [
      "Jeremiah 31:31-34",
      "Ezekiel 36:24-28"
    ],
    "confidence": "High",
    "updated_at": "2026-09-11T01:14:34.419366+00:00"
  },
  {
    "code": "AM-COV-0006",
    "covenant_name": "New Covenant",
    "relationship_type": "claims fulfillment",
    "source_node": "Prophetic promise",
    "target_node": "New Covenant",
    "description": "New Testament texts identify the death and priestly ministry of Jesus with the promised new covenant.",
    "evidence": [
      "Luke 22:20",
      "Hebrews 8:6-13",
      "Hebrews 9:15"
    ],
    "confidence": "High",
    "updated_at": "2026-09-11T01:14:34.419366+00:00"
  },
  {
    "code": "AM-COV-0007",
    "covenant_name": "Kingdom / Consummation",
    "relationship_type": "extends toward consummation",
    "source_node": "New Covenant",
    "target_node": "Kingdom / Consummation",
    "description": "The covenantal sequence is presented as moving toward final kingdom, renewal and divine presence.",
    "evidence": [
      "1 Corinthians 15:24-28",
      "Revelation 21:1-5"
    ],
    "confidence": "Interpretive",
    "updated_at": "2026-09-11T01:14:34.419366+00:00"
  }
];

export interface LiveDoctrine {
  code: string;
  source_node: string;
  target_node: string;
  relationship_type: string;
  description: string;
  evidence: string[];
  classification: string;
  tradition_status: string;
  confidence: string;
  topic: string;
  updated_at: string;
}

export const LIVE_DOCTRINE: LiveDoctrine[] = [
  {
    "code": "AM-DOC-0001",
    "source_node": "Jesus Christ",
    "target_node": "Messiah",
    "relationship_type": "Identification",
    "description": "New Testament writings identify Jesus as the promised Messiah of Israel.",
    "evidence": [
      "Matthew 16:16",
      "John 4:25-26",
      "Acts 2:36"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Affirmed across Christian traditions; not affirmed in Rabbinic Judaism or Islam.",
    "confidence": "Very high",
    "topic": "Christology",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0002",
    "source_node": "Jesus Christ",
    "target_node": "Son of God",
    "relationship_type": "Identification",
    "description": "The title Son of God is applied to Jesus in the Gospels and epistles.",
    "evidence": [
      "Mark 1:1",
      "Romans 1:4",
      "Hebrews 1:2-5"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Affirmed in Christian traditions; rejected in Islamic and Rabbinic readings.",
    "confidence": "Very high",
    "topic": "Christology",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0003",
    "source_node": "Jesus Christ",
    "target_node": "High Priest",
    "relationship_type": "Identification",
    "description": "Hebrews presents Jesus as High Priest who intercedes on behalf of his people.",
    "evidence": [
      "Hebrews 4:14",
      "Hebrews 5:5-6",
      "Hebrews 7:26"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Affirmed broadly; ecclesiological implications disputed.",
    "confidence": "Very high",
    "topic": "Priesthood",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0004",
    "source_node": "High Priest",
    "target_node": "Melchizedek",
    "relationship_type": "Ordering",
    "description": "Jesus' priesthood is described as according to the order of Melchizedek rather than Levi.",
    "evidence": [
      "Psalm 110:4",
      "Hebrews 5:6",
      "Hebrews 7:17"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Textual claim undisputed; typological reading varies.",
    "confidence": "Very high",
    "topic": "Priesthood",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0005",
    "source_node": "Melchizedek",
    "target_node": "Abraham",
    "relationship_type": "Narrative precedent",
    "description": "Melchizedek blesses Abram and receives a tithe, grounding the later priestly argument.",
    "evidence": [
      "Genesis 14:18-20",
      "Hebrews 7:1-10"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Shared textual basis; significance weighted differently.",
    "confidence": "High",
    "topic": "Priesthood",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0006",
    "source_node": "Priesthood",
    "target_node": "Covenant",
    "relationship_type": "Structural dependency",
    "description": "Priestly service is defined by the covenant under which it operates.",
    "evidence": [
      "Exodus 28-29",
      "Numbers 18",
      "Hebrews 7:11-12"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Broad agreement on dependency; consequences disputed.",
    "confidence": "High",
    "topic": "Covenant",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0007",
    "source_node": "Covenant",
    "target_node": "Sacrifice",
    "relationship_type": "Instituting sign",
    "description": "Covenants in the biblical record are inaugurated and maintained through sacrifice.",
    "evidence": [
      "Genesis 15:9-18",
      "Exodus 24:5-8",
      "Hebrews 9:18-22"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Widely affirmed; sacramental application varies.",
    "confidence": "High",
    "topic": "Covenant",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0008",
    "source_node": "Sacrifice",
    "target_node": "Atonement",
    "relationship_type": "Purpose relation",
    "description": "Sacrificial offering is presented as the means of atonement for sin.",
    "evidence": [
      "Leviticus 16",
      "Isaiah 53:10",
      "Hebrews 9:26"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Mechanism of atonement is a major interpretive divergence.",
    "confidence": "High",
    "topic": "Atonement",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0009",
    "source_node": "Jesus Christ",
    "target_node": "Sacrifice",
    "relationship_type": "Identification",
    "description": "The death of Jesus is presented as a single definitive sacrificial offering.",
    "evidence": [
      "Hebrews 9:26",
      "Hebrews 10:10",
      "1 Peter 3:18"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Affirmed in Christian traditions; theories of application differ.",
    "confidence": "Very high",
    "topic": "Atonement",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0010",
    "source_node": "Jesus Christ",
    "target_node": "Resurrection",
    "relationship_type": "Event attribution",
    "description": "The resurrection of Jesus is presented as the vindication of his identity and office.",
    "evidence": [
      "Romans 1:4",
      "1 Corinthians 15:3-8",
      "Acts 2:24"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Affirmed in Christian traditions; historical assessment disputed in modern scholarship.",
    "confidence": "Very high",
    "topic": "Christology",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0011",
    "source_node": "Resurrection",
    "target_node": "Kingdom",
    "relationship_type": "Inauguration",
    "description": "Resurrection and exaltation are linked to the present reign and the coming kingdom.",
    "evidence": [
      "Acts 2:30-36",
      "1 Corinthians 15:24-25",
      "Revelation 11:15"
    ],
    "classification": "Interpretive connection",
    "tradition_status": "Eschatological timing is substantially disputed.",
    "confidence": "Medium",
    "topic": "Eschatology",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0012",
    "source_node": "Kingdom",
    "target_node": "David",
    "relationship_type": "Promise lineage",
    "description": "The kingdom promise is anchored in the dynastic covenant made with David.",
    "evidence": [
      "2 Samuel 7:12-16",
      "Psalm 89:3-4",
      "Luke 1:32-33"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Fulfilment claims diverge between traditions.",
    "confidence": "High",
    "topic": "Covenant",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0013",
    "source_node": "Jesus Christ",
    "target_node": "Mediator",
    "relationship_type": "Office attribution",
    "description": "Jesus is named mediator of a new covenant between God and humanity.",
    "evidence": [
      "1 Timothy 2:5",
      "Hebrews 8:6",
      "Hebrews 12:24"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Affirmed broadly; mediatorial structures of the church differ.",
    "confidence": "Very high",
    "topic": "Covenant",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  },
  {
    "code": "AM-DOC-0014",
    "source_node": "Moses",
    "target_node": "Mediator",
    "relationship_type": "Office precedent",
    "description": "Moses functions as covenant mediator at Sinai, the pattern Hebrews compares with.",
    "evidence": [
      "Exodus 24:1-8",
      "Deuteronomy 5:5",
      "Hebrews 3:1-6"
    ],
    "classification": "Explicit connection",
    "tradition_status": "Comparison accepted; evaluative weighting differs.",
    "confidence": "High",
    "topic": "Covenant",
    "updated_at": "2026-09-14T01:46:42.255599+00:00"
  }
];

export interface LiveMapLink {
  map_kind: 'covenant' | 'doctrine';
  relationship_code: string;
  link_role: 'grounds' | 'illustrates';
  note: string;
  claim: string;
}

export const LIVE_MAP_LINKS: LiveMapLink[] = [
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0013",
    "link_role": "grounds",
    "note": "Mediator of a better covenant.",
    "claim": "AM-CLAIM-000185"
  },
  {
    "map_kind": "covenant",
    "relationship_code": "AM-COV-0006",
    "link_role": "grounds",
    "note": "Jeremiah's new covenant.",
    "claim": "AM-CLAIM-000185"
  },
  {
    "map_kind": "covenant",
    "relationship_code": "AM-COV-0005",
    "link_role": "grounds",
    "note": "Prophetic promise of a new covenant.",
    "claim": "AM-CLAIM-000185"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0004",
    "link_role": "grounds",
    "note": "Psalm 110:4.",
    "claim": "AM-CLAIM-000186"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0005",
    "link_role": "grounds",
    "note": "Genesis 14 within the Abraham narrative.",
    "claim": "AM-CLAIM-000187"
  },
  {
    "map_kind": "covenant",
    "relationship_code": "AM-COV-0003",
    "link_role": "grounds",
    "note": "Sinai follows the promise.",
    "claim": "AM-CLAIM-000187"
  },
  {
    "map_kind": "covenant",
    "relationship_code": "AM-COV-0002",
    "link_role": "grounds",
    "note": "The Abrahamic promise.",
    "claim": "AM-CLAIM-000187"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0014",
    "link_role": "grounds",
    "note": "Moses as mediator at Sinai.",
    "claim": "AM-CLAIM-000188"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0007",
    "link_role": "grounds",
    "note": "Sinai sacrificial order.",
    "claim": "AM-CLAIM-000188"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0006",
    "link_role": "grounds",
    "note": "Levitical priesthood at Sinai.",
    "claim": "AM-CLAIM-000188"
  },
  {
    "map_kind": "covenant",
    "relationship_code": "AM-COV-0003",
    "link_role": "grounds",
    "note": "Sinai institutes the Levitical order.",
    "claim": "AM-CLAIM-000188"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0003",
    "link_role": "grounds",
    "note": "Jesus as High Priest.",
    "claim": "AM-CLAIM-000184"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0004",
    "link_role": "grounds",
    "note": "The Melchizedek likeness lemma.",
    "claim": "AM-CLAIM-000189"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0006",
    "link_role": "grounds",
    "note": "Priesthood bound to law and covenant.",
    "claim": "AM-CLAIM-000190"
  },
  {
    "map_kind": "doctrine",
    "relationship_code": "AM-DOC-0003",
    "link_role": "illustrates",
    "note": "Priesthood supersession.",
    "claim": "AM-CLAIM-000191"
  },
  {
    "map_kind": "covenant",
    "relationship_code": "AM-COV-0006",
    "link_role": "illustrates",
    "note": "Hebrews' reading of the new covenant as superseding the Levitical order.",
    "claim": "AM-CLAIM-000191"
  }
];
