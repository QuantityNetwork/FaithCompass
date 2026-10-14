/**
 * Covenant Map and Doctrine Graph.
 *
 * The published edges are imported unchanged from live-import.ts. What is new
 * is attribution: every covenant edge now records whose reading of covenantal
 * history it belongs to, and the map gains the Jewish, Islamic and Latter-day
 * Saint readings beside the Christian one, sharing the nodes they share. The
 * Doctrine Graph gains nodes outside Christology and no longer has a default
 * centre.
 */

import type { CovenantEdge, CovenantNode, DoctrineEdge, DoctrineNode, MapLink } from '../schema';
import type { TraditionFamily } from '../taxonomy';
import { refs } from './corpus';
import { LIVE_COVENANTS, LIVE_DOCTRINE, LIVE_MAP_LINKS } from './live-import';

const MIGRATED = '2026-10-14T12:00:00Z';
const BIBLICAL: TraditionFamily[] = ['jewish', 'christian', 'latter-day-saint'];

/* ------------------------------------------------------------------ *
 * Covenant Map
 * ------------------------------------------------------------------ */

export const COVENANT_NODES: CovenantNode[] = [
  { id: 'primordial-covenant', label: 'Primordial covenant', order: 0.5, families: ['islamic'], summary: 'The covenant drawn from all the children of Adam, who acknowledge God as their Lord (Q 7:172).' },
  { id: 'creation', label: 'Creation', order: 1, families: BIBLICAL, summary: 'The created order the covenants presuppose.' },
  { id: 'covenant-of-the-prophets', label: 'Covenant of the prophets', order: 1.5, families: ['islamic'], summary: 'The covenant taken from the prophets, Nūḥ, Ibrāhīm, Mūsā and ʿĪsā among them (Q 33:7; 3:81).' },
  { id: 'noah', label: 'Noah', order: 2, families: [...BIBLICAL, 'islamic'], summary: 'The covenant with Noah and the sign of the bow (Genesis 9).' },
  { id: 'noahide-commandments', label: 'Noahide commandments', order: 2.5, families: ['jewish'], summary: 'Rabbinic tradition’s seven commandments binding all humanity (b. Sanhedrin 56a).' },
  { id: 'abraham', label: 'Abraham', order: 3, families: [...BIBLICAL, 'islamic'], summary: 'Abraham / Ibrāhīm: promise, covenant and the question of who his heirs are.' },
  { id: 'sinai', label: 'Sinai / Moses', order: 4, families: [...BIBLICAL, 'islamic'], summary: 'The covenant with Israel at Sinai: law, priesthood, sacrifice and land.' },
  { id: 'david', label: 'David', order: 5, families: BIBLICAL, summary: 'The dynastic covenant with David (2 Samuel 7).' },
  { id: 'prophetic-promise', label: 'Prophetic promise', order: 6, families: BIBLICAL, summary: 'The prophets’ promises of renewal and restoration (Jeremiah 31; Ezekiel 36–37).' },
  { id: 'messianic-restoration', label: 'Messianic restoration', order: 7, families: ['jewish'], summary: 'Israel restored under a Davidic king, its covenant as fixed as the order of creation.' },
  { id: 'new-covenant', label: 'New Covenant', order: 7, families: ['christian', 'latter-day-saint'], summary: 'The covenant New Testament texts identify with the death and priestly ministry of Jesus.' },
  { id: 'seal-of-the-prophets', label: 'Seal of the prophets', order: 7.5, families: ['islamic'], summary: 'Muhammad, the messenger who comes confirming what the prophets had (Q 3:81; 33:40).' },
  { id: 'restoration', label: 'Restoration', order: 8, families: ['latter-day-saint'], summary: 'The restoration of the “new and everlasting covenant” and of the gospel of Abraham.' },
  { id: 'kingdom', label: 'Kingdom / Consummation', order: 9, families: ['christian', 'latter-day-saint'], summary: 'Final kingdom, renewal and divine presence.' },
];

const COVENANT_NODE_BY_LABEL = new Map(COVENANT_NODES.map((n) => [n.label, n.id]));

function covenantNodeId(label: string): string {
  const id = COVENANT_NODE_BY_LABEL.get(label);
  if (!id) throw new Error(`Unknown covenant node "${label}"`);
  return id;
}

/** Whose reading each published edge belongs to. Added in the migration. */
const LIVE_COVENANT_READINGS: Record<string, TraditionFamily[]> = {
  'AM-COV-0001': BIBLICAL,
  'AM-COV-0002': BIBLICAL,
  'AM-COV-0003': BIBLICAL,
  'AM-COV-0004': BIBLICAL,
  'AM-COV-0005': BIBLICAL,
  'AM-COV-0006': ['christian', 'latter-day-saint'],
  'AM-COV-0007': ['christian', 'latter-day-saint'],
};

const importedCovenants: CovenantEdge[] = LIVE_COVENANTS.map((c) => ({
  code: c.code,
  covenantName: c.covenant_name,
  relationshipType: c.relationship_type,
  source: covenantNodeId(c.source_node),
  target: covenantNodeId(c.target_node),
  description: c.description,
  evidence: refs(...c.evidence),
  confidence: c.confidence as CovenantEdge['confidence'],
  readings: LIVE_COVENANT_READINGS[c.code],
  updatedAt: c.updated_at,
  status: 'published',
}));

function covenant(input: Omit<CovenantEdge, 'evidence' | 'updatedAt' | 'status'> & { evidence: string[] }): CovenantEdge {
  return { ...input, evidence: refs(...input.evidence), updatedAt: MIGRATED, status: 'provisional' };
}

export const COVENANTS: CovenantEdge[] = [
  ...importedCovenants,
  covenant({
    code: 'AM-COV-0008',
    covenantName: 'Messianic restoration',
    relationshipType: 'anticipates restoration',
    source: 'prophetic-promise',
    target: 'messianic-restoration',
    description:
      'The prophets promise Israel’s restoration under a Davidic king, with Israel’s standing before God as fixed as the order of creation.',
    evidence: ['Jeremiah 31:35–37', 'Ezekiel 37:24–28', 'Jeremiah 33:17–18'],
    confidence: 'High',
    readings: ['jewish'],
  }),
  covenant({
    code: 'AM-COV-0009',
    covenantName: 'Noahide commandments',
    relationshipType: 'binds the nations',
    source: 'noah',
    target: 'noahide-commandments',
    description: 'Rabbinic tradition reads the covenant with Noah as binding all humanity to seven commandments.',
    evidence: ['Genesis 9:1–7', 'b. Sanhedrin 56a'],
    confidence: 'Interpretive',
    readings: ['jewish'],
  }),
  covenant({
    code: 'AM-COV-0010',
    covenantName: 'Covenant of the prophets',
    relationshipType: 'is followed by',
    source: 'primordial-covenant',
    target: 'covenant-of-the-prophets',
    description:
      'The Qurʾān speaks of a covenant drawn from all the children of Adam, who acknowledge God as their Lord, and of a covenant taken from the prophets.',
    evidence: ['Q 7:172', 'Q 33:7'],
    confidence: 'Interpretive',
    readings: ['islamic'],
  }),
  covenant({
    code: 'AM-COV-0011',
    covenantName: 'Ibrāhīm',
    relationshipType: 'includes',
    source: 'covenant-of-the-prophets',
    target: 'abraham',
    description:
      'The covenant of the prophets names Ibrāhīm with Nūḥ, Mūsā and ʿĪsā; God’s covenant with Ibrāhīm does not extend to wrongdoers among his descendants.',
    evidence: ['Q 33:7', 'Q 2:124'],
    confidence: 'High',
    readings: ['islamic'],
  }),
  covenant({
    code: 'AM-COV-0012',
    covenantName: 'Banū Isrāʾīl',
    relationshipType: 'continues with the Children of Israel',
    source: 'abraham',
    target: 'sinai',
    description: 'God takes a covenant from the Children of Israel and appoints twelve leaders among them.',
    evidence: ['Q 2:83', 'Q 5:12'],
    confidence: 'High',
    readings: ['islamic'],
  }),
  covenant({
    code: 'AM-COV-0013',
    covenantName: 'Seal of the prophets',
    relationshipType: 'anticipates a confirming messenger',
    source: 'covenant-of-the-prophets',
    target: 'seal-of-the-prophets',
    description:
      'The prophets pledge to believe in and support a messenger who comes confirming what they have; Muslim exegesis identifies him with Muhammad, the seal of the prophets.',
    evidence: ['Q 3:81', 'Q 33:40'],
    confidence: 'Interpretive',
    readings: ['islamic'],
  }),
  covenant({
    code: 'AM-COV-0014',
    covenantName: 'Restoration',
    relationshipType: 'claims restoration of',
    source: 'new-covenant',
    target: 'restoration',
    description: 'Latter-day Saint scripture speaks of the “new and everlasting covenant” as restored in the last days.',
    evidence: ['D&C 1:22', 'D&C 22:1', 'D&C 66:2'],
    confidence: 'Interpretive',
    readings: ['latter-day-saint'],
  }),
  covenant({
    code: 'AM-COV-0015',
    covenantName: 'Gospel of Abraham',
    relationshipType: 'renews',
    source: 'abraham',
    target: 'restoration',
    description:
      'Latter-day Saint scripture records the restoration of “the dispensation of the gospel of Abraham” and promises that all who receive the gospel are counted as his seed.',
    evidence: ['D&C 110:12', 'Abraham 2:9–11'],
    confidence: 'High',
    readings: ['latter-day-saint'],
  }),
];

/* ------------------------------------------------------------------ *
 * Doctrine Graph
 * ------------------------------------------------------------------ */

const ALL: TraditionFamily[] = ['jewish', 'christian', 'islamic', 'latter-day-saint'];
const CHRISTIANISH: TraditionFamily[] = ['christian', 'latter-day-saint'];

export const DOCTRINE_NODES: DoctrineNode[] = [
  { id: 'abraham', label: 'Abraham', aka: ['Ibrāhīm'], families: ALL },
  { id: 'moses', label: 'Moses', aka: ['Mūsā'], families: ALL },
  { id: 'david', label: 'David', aka: ['Dāwūd'], families: ALL },
  { id: 'melchizedek', label: 'Melchizedek', aka: [], families: ['jewish', ...CHRISTIANISH] },
  { id: 'isaac', label: 'Isaac', aka: ['Isḥāq'], families: ALL },
  { id: 'ishmael', label: 'Ishmael', aka: ['Ismāʿīl'], families: ALL },
  { id: 'prophethood', label: 'Prophethood', aka: ['nubuwwa'], families: ALL },
  { id: 'revelation', label: 'Revelation', aka: ['waḥy'], families: ALL },
  { id: 'covenant', label: 'Covenant', aka: ['brit', 'mīthāq'], families: ALL },
  { id: 'priesthood', label: 'Priesthood', aka: ['kehunnah'], families: ['jewish', ...CHRISTIANISH] },
  { id: 'torah', label: 'Torah', aka: ['Tawrāt'], families: ALL },
  { id: 'oral-torah', label: 'Oral Torah', aka: ['Torah she-beʿal peh'], families: ['jewish'] },
  { id: 'kaaba', label: 'Kaʿba', aka: ['the House'], families: ['islamic'] },
  { id: 'hanif', label: 'Ḥanīf', aka: [], families: ['islamic'] },
  { id: 'seal-of-the-prophets', label: 'Seal of the prophets', aka: ['khātam al-nabiyyīn'], families: ['islamic'] },
  { id: 'confirmation-of-scripture', label: 'Confirmation of prior scripture', aka: ['taṣdīq', 'muhaymin'], families: ['islamic'] },
  { id: 'jesus-christ', label: 'Jesus Christ', aka: ['ʿĪsā al-Masīḥ'], families: [...CHRISTIANISH, 'islamic'] },
  { id: 'messiah', label: 'Messiah', aka: ['mashiaḥ', 'al-Masīḥ'], families: ALL },
  { id: 'son-of-god', label: 'Son of God', aka: [], families: CHRISTIANISH },
  { id: 'high-priest', label: 'High Priest', aka: [], families: ['jewish', ...CHRISTIANISH] },
  { id: 'mediator', label: 'Mediator', aka: [], families: ['jewish', ...CHRISTIANISH] },
  { id: 'sacrifice', label: 'Sacrifice', aka: ['korban'], families: ALL },
  { id: 'atonement', label: 'Atonement', aka: ['kippur'], families: ['jewish', ...CHRISTIANISH] },
  { id: 'resurrection', label: 'Resurrection', aka: ['qiyāma'], families: ALL },
  { id: 'kingdom', label: 'Kingdom', aka: [], families: ['jewish', ...CHRISTIANISH] },
  { id: 'melchizedek-priesthood', label: 'Melchizedek Priesthood', aka: [], families: ['latter-day-saint'] },
  { id: 'restoration', label: 'Restoration', aka: [], families: ['latter-day-saint'] },
  { id: 'apostolic-succession', label: 'Apostolic succession', aka: [], families: ['christian'] },
  { id: 'priesthood-of-believers', label: 'Priesthood of all believers', aka: ['common priesthood'], families: ['christian'] },
];

/** The neutral starting point: the one figure every tradition in the record shares. */
export const DOCTRINE_START_NODE = 'abraham';

const DOCTRINE_NODE_BY_LABEL = new Map(DOCTRINE_NODES.map((n) => [n.label, n.id]));

function doctrineNodeId(label: string): string {
  const id = DOCTRINE_NODE_BY_LABEL.get(label);
  if (!id) throw new Error(`Unknown doctrine node "${label}"`);
  return id;
}

/** Published edges whose textual basis Jewish tradition shares. Added in the migration. */
const LIVE_DOCTRINE_FAMILIES: Record<string, TraditionFamily[]> = {
  'AM-DOC-0005': ['jewish', ...CHRISTIANISH],
  'AM-DOC-0006': ['jewish', ...CHRISTIANISH],
  'AM-DOC-0007': ['jewish', ...CHRISTIANISH],
  'AM-DOC-0008': ['jewish', ...CHRISTIANISH],
  'AM-DOC-0014': ['jewish', ...CHRISTIANISH],
};

const importedDoctrine: DoctrineEdge[] = LIVE_DOCTRINE.map((d) => ({
  code: d.code,
  source: doctrineNodeId(d.source_node),
  target: doctrineNodeId(d.target_node),
  relationshipType: d.relationship_type,
  description: d.description,
  evidence: refs(...d.evidence),
  classification: d.classification as DoctrineEdge['classification'],
  traditionStatus: d.tradition_status,
  confidence: d.confidence as DoctrineEdge['confidence'],
  topic: d.topic,
  families: LIVE_DOCTRINE_FAMILIES[d.code] ?? CHRISTIANISH,
  updatedAt: d.updated_at,
  status: 'published',
}));

function doctrine(
  input: Omit<DoctrineEdge, 'evidence' | 'updatedAt' | 'status'> & { evidence: string[] },
): DoctrineEdge {
  return { ...input, evidence: refs(...input.evidence), updatedAt: MIGRATED, status: 'provisional' };
}

export const DOCTRINE: DoctrineEdge[] = [
  ...importedDoctrine,
  doctrine({
    code: 'AM-DOC-0015',
    source: 'abraham',
    target: 'isaac',
    relationshipType: 'Covenant heir',
    description: 'Genesis establishes the covenant with Isaac; the Qurʾān names Isḥāq and Yaʿqūb as gifts to Ibrāhīm without a covenant-line distinction.',
    evidence: ['Genesis 17:19–21', 'Genesis 21:12', 'Q 6:84'],
    classification: 'Explicit connection',
    traditionStatus: 'Covenant line central in Jewish and Christian readings; not a category of the Qurʾānic portrait.',
    confidence: 'Very high',
    topic: 'Covenant',
    families: ALL,
  }),
  doctrine({
    code: 'AM-DOC-0016',
    source: 'abraham',
    target: 'ishmael',
    relationshipType: 'Son and co-founder',
    description: 'Genesis blesses Ishmael outside the covenant line; the Qurʾān presents Ismāʿīl raising the House with Ibrāhīm.',
    evidence: ['Genesis 17:20', 'Genesis 21:13', 'Q 2:127'],
    classification: 'Explicit connection',
    traditionStatus: 'Shared figure, weighted very differently: blessed son in Genesis, co-founder of the House in the Qurʾān.',
    confidence: 'Very high',
    topic: 'Abraham',
    families: ALL,
  }),
  doctrine({
    code: 'AM-DOC-0017',
    source: 'abraham',
    target: 'kaaba',
    relationshipType: 'Foundation',
    description: 'Ibrāhīm and Ismāʿīl raise the foundations of the House, the first established for humankind.',
    evidence: ['Q 2:125–127', 'Q 3:96–97'],
    classification: 'Explicit connection',
    traditionStatus: 'Qurʾānic; no parallel in Genesis.',
    confidence: 'Very high',
    topic: 'Abraham',
    families: ['islamic'],
  }),
  doctrine({
    code: 'AM-DOC-0018',
    source: 'abraham',
    target: 'hanif',
    relationshipType: 'Characterisation',
    description: 'Ibrāhīm is a ḥanīf, neither Jew nor Christian, whose religion the Prophet is told to follow.',
    evidence: ['Q 3:67', 'Q 16:120', 'Q 16:123'],
    classification: 'Explicit connection',
    traditionStatus: 'Foundational in Islamic tradition; Jewish and Christian traditions do not accept the characterisation.',
    confidence: 'Very high',
    topic: 'Abraham',
    families: ['islamic'],
  }),
  doctrine({
    code: 'AM-DOC-0019',
    source: 'prophethood',
    target: 'seal-of-the-prophets',
    relationshipType: 'Culmination',
    description: 'The Qurʾān names Muhammad the seal of the prophets.',
    evidence: ['Q 33:40'],
    classification: 'Explicit connection',
    traditionStatus: 'Finality affirmed in Sunni and Shiʿi Islam; read as attestation by the Ahmadiyya.',
    confidence: 'Very high',
    topic: 'Prophethood',
    families: ['islamic'],
  }),
  doctrine({
    code: 'AM-DOC-0020',
    source: 'revelation',
    target: 'confirmation-of-scripture',
    relationshipType: 'Relation to earlier scripture',
    description: 'The Qurʾān describes itself as confirming the scripture before it and as muhaymin over it.',
    evidence: ['Q 5:48', 'Q 3:3'],
    classification: 'Explicit connection',
    traditionStatus: 'The strength of muhaymin is debated; Jewish and Christian traditions do not accept the Qurʾān’s authority over their scriptures.',
    confidence: 'Very high',
    topic: 'Revelation',
    families: ['islamic'],
  }),
  doctrine({
    code: 'AM-DOC-0021',
    source: 'moses',
    target: 'torah',
    relationshipType: 'Mediation of revelation',
    description: 'The Torah is given through Moses at Sinai; the Qurʾān also says God sent down the Torah, with guidance and light.',
    evidence: ['Exodus 24:12', 'Deuteronomy 31:9', 'Q 5:44'],
    classification: 'Explicit connection',
    traditionStatus: 'Shared affirmation; its present authority is weighted differently by each tradition.',
    confidence: 'Very high',
    topic: 'Torah',
    families: ALL,
  }),
  doctrine({
    code: 'AM-DOC-0022',
    source: 'torah',
    target: 'oral-torah',
    relationshipType: 'Interpretive transmission',
    description: 'Rabbinic tradition holds that the Written Torah was given with an Oral Torah transmitted from Moses through the sages.',
    evidence: ['m. Avot 1:1', 'b. Shabbat 31a', 'b. Gittin 60b'],
    classification: 'Interpretive connection',
    traditionStatus: 'Foundational in Rabbinic Judaism; rejected by Karaite Judaism and outside the rabbinic tradition.',
    confidence: 'High',
    topic: 'Torah',
    families: ['jewish'],
  }),
  doctrine({
    code: 'AM-DOC-0023',
    source: 'torah',
    target: 'covenant',
    relationshipType: 'Covenant document',
    description: 'At Sinai the people answer the “book of the covenant” and accept its words.',
    evidence: ['Exodus 24:7', 'Exodus 34:27'],
    classification: 'Explicit connection',
    traditionStatus: 'Shared textual basis; the covenant’s continuing terms are disputed.',
    confidence: 'Very high',
    topic: 'Covenant',
    families: ['jewish', ...CHRISTIANISH],
  }),
  doctrine({
    code: 'AM-DOC-0024',
    source: 'melchizedek',
    target: 'melchizedek-priesthood',
    relationshipType: 'Office named after',
    description: 'Latter-day Saint scripture names the higher priesthood after Melchizedek and describes men ordained to his order.',
    evidence: ['D&C 107:2–4', 'Alma 13:14–19'],
    classification: 'Explicit connection',
    traditionStatus: 'Latter-day Saint; Protestant readings of Hebrews 7:24 limit the order to Christ.',
    confidence: 'Very high',
    topic: 'Priesthood',
    families: ['latter-day-saint'],
  }),
  doctrine({
    code: 'AM-DOC-0025',
    source: 'priesthood',
    target: 'restoration',
    relationshipType: 'Restored authority',
    description: 'Latter-day Saint scripture records priesthood and its keys restored by heavenly messengers.',
    evidence: ['D&C 13:1', 'D&C 27:12', 'D&C 110:11–16'],
    classification: 'Explicit connection',
    traditionStatus: 'Latter-day Saint; other Christian traditions deny the loss the restoration presupposes or locate authority elsewhere.',
    confidence: 'Very high',
    topic: 'Authority',
    families: ['latter-day-saint'],
  }),
  doctrine({
    code: 'AM-DOC-0026',
    source: 'priesthood',
    target: 'apostolic-succession',
    relationshipType: 'Transmission',
    description: 'Catholic and Orthodox teaching holds that apostolic authority passes through the succession of bishops.',
    evidence: ['1 Clement 42–44', 'Irenaeus, Against Heresies 3.3.1–3', 'Lumen Gentium 20'],
    classification: 'Interpretive connection',
    traditionStatus: 'Catholic and Orthodox; rejected in most Protestant and in Latter-day Saint teaching.',
    confidence: 'High',
    topic: 'Authority',
    families: ['christian'],
  }),
  doctrine({
    code: 'AM-DOC-0027',
    source: 'priesthood',
    target: 'priesthood-of-believers',
    relationshipType: 'Common priesthood',
    description: 'The community of believers is called a royal priesthood.',
    evidence: ['1 Peter 2:5', '1 Peter 2:9', 'Revelation 1:6'],
    classification: 'Explicit connection',
    traditionStatus: 'Affirmed across Christian traditions; whether it excludes a ministerial priesthood is disputed.',
    confidence: 'Very high',
    topic: 'Priesthood',
    families: ['christian'],
  }),
  doctrine({
    code: 'AM-DOC-0028',
    source: 'prophethood',
    target: 'abraham',
    relationshipType: 'Prophetic office',
    description: 'Both Genesis and the Qurʾān call Abraham a prophet.',
    evidence: ['Genesis 20:7', 'Q 19:41'],
    classification: 'Explicit connection',
    traditionStatus: 'Shared designation across traditions.',
    confidence: 'Very high',
    topic: 'Prophethood',
    families: ALL,
  }),
  doctrine({
    code: 'AM-DOC-0029',
    source: 'prophethood',
    target: 'moses',
    relationshipType: 'Paradigm prophet',
    description: 'Moses is the prophet like whom no other arose, and a messenger and prophet in the Qurʾān.',
    evidence: ['Deuteronomy 18:15–18', 'Deuteronomy 34:10', 'Q 19:51'],
    classification: 'Explicit connection',
    traditionStatus: 'Shared; the identity of “a prophet like Moses” (Deuteronomy 18:15) is disputed between traditions.',
    confidence: 'Very high',
    topic: 'Prophethood',
    families: ALL,
  }),
];

/* ------------------------------------------------------------------ *
 * Map grounding — which claims ground or illustrate which edges
 * ------------------------------------------------------------------ */

const importedLinks: MapLink[] = LIVE_MAP_LINKS.map((l) => ({
  mapKind: l.map_kind,
  code: l.relationship_code,
  role: l.link_role,
  claim: l.claim,
  note: l.note,
}));

const link = (mapKind: MapLink['mapKind'], code: string, role: MapLink['role'], claim: string, note: string): MapLink => ({
  mapKind,
  code,
  role,
  claim,
  note,
});

export const MAP_LINKS: MapLink[] = [
  ...importedLinks,
  link('covenant', 'AM-COV-0006', 'grounds', 'AM-CLAIM-000192', 'Hebrews 8:13 on the first covenant growing old.'),
  link('covenant', 'AM-COV-0008', 'grounds', 'AM-CLAIM-000195', 'Jeremiah 33:17–18 (Masoretic Text).'),
  link('covenant', 'AM-COV-0008', 'illustrates', 'AM-CLAIM-000197', 'The Levitical order suspended, not superseded.'),
  link('covenant', 'AM-COV-0011', 'grounds', 'AM-CLAIM-000234', 'The covenant does not extend to wrongdoers.'),
  link('covenant', 'AM-COV-0013', 'illustrates', 'AM-CLAIM-000249', 'Finality of prophethood.'),
  link('covenant', 'AM-COV-0014', 'illustrates', 'AM-CLAIM-000270', 'Restoration by angelic conferral.'),
  link('covenant', 'AM-COV-0015', 'grounds', 'AM-CLAIM-000267', 'Abraham’s seed counted by reception of the gospel.'),
  link('doctrine', 'AM-DOC-0015', 'grounds', 'AM-CLAIM-000242', 'Genesis 17:19–21.'),
  link('doctrine', 'AM-DOC-0016', 'grounds', 'AM-CLAIM-000231', 'Ibrāhīm and Ismāʿīl at the House.'),
  link('doctrine', 'AM-DOC-0016', 'grounds', 'AM-CLAIM-000242', 'Ishmael blessed (Genesis 17:20).'),
  link('doctrine', 'AM-DOC-0017', 'grounds', 'AM-CLAIM-000231', 'Raising the foundations of the House.'),
  link('doctrine', 'AM-DOC-0018', 'grounds', 'AM-CLAIM-000230', 'Neither Jew nor Christian, but a ḥanīf.'),
  link('doctrine', 'AM-DOC-0018', 'grounds', 'AM-CLAIM-000232', 'Follow the milla of Ibrāhīm.'),
  link('doctrine', 'AM-DOC-0019', 'grounds', 'AM-CLAIM-000238', 'khātam al-nabiyyīn.'),
  link('doctrine', 'AM-DOC-0019', 'illustrates', 'AM-CLAIM-000249', 'Finality of prophethood.'),
  link('doctrine', 'AM-DOC-0020', 'grounds', 'AM-CLAIM-000236', 'Confirming and muhaymin.'),
  link('doctrine', 'AM-DOC-0020', 'illustrates', 'AM-CLAIM-000237', 'The senses of muhaymin.'),
  link('doctrine', 'AM-DOC-0021', 'grounds', 'AM-CLAIM-000210', 'The commandments Moses gives may not be altered.'),
  link('doctrine', 'AM-DOC-0022', 'grounds', 'AM-CLAIM-000213', '“It is not in heaven.”'),
  link('doctrine', 'AM-DOC-0022', 'grounds', 'AM-CLAIM-000214', 'No prophet may innovate.'),
  link('doctrine', 'AM-DOC-0022', 'illustrates', 'AM-CLAIM-000219', 'Torah permanence through rabbinic interpretation.'),
  link('doctrine', 'AM-DOC-0024', 'grounds', 'AM-CLAIM-000264', 'D&C 107:1–4.'),
  link('doctrine', 'AM-DOC-0024', 'grounds', 'AM-CLAIM-000266', 'Alma 13.'),
  link('doctrine', 'AM-DOC-0025', 'grounds', 'AM-CLAIM-000260', 'D&C 13.'),
  link('doctrine', 'AM-DOC-0025', 'grounds', 'AM-CLAIM-000261', 'D&C 27:12.'),
  link('doctrine', 'AM-DOC-0025', 'illustrates', 'AM-CLAIM-000270', 'Restoration by angelic conferral.'),
  link('doctrine', 'AM-DOC-0026', 'grounds', 'AM-CLAIM-000272', '1 Clement 42–44.'),
  link('doctrine', 'AM-DOC-0026', 'grounds', 'AM-CLAIM-000273', 'Irenaeus, Against Heresies 3.3.'),
  link('doctrine', 'AM-DOC-0026', 'illustrates', 'AM-CLAIM-000274', 'No general apostasy.'),
  link('doctrine', 'AM-DOC-0027', 'grounds', 'AM-CLAIM-000200', 'A royal priesthood.'),
  link('doctrine', 'AM-DOC-0027', 'illustrates', 'AM-CLAIM-000202', 'The priesthood of all believers.'),
];
