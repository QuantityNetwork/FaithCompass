# Standards Mapping – Decision Passport and SDEP

Classification: **implemented** = in code and tested; **adapter** = a field-by-field mapping is documented here but no
converter exists yet; **unsupported** = not provided. No conformance certification is claimed for any standard.

| Standard | Class | What exists | Gap |
|---|---|---|---|
| RFC 8785 JSON Canonicalization Scheme (JCS) | **Implemented (subset)** | `canonical-json/1` is byte-identical to JCS for passport values: UTF-16 key order, ECMAScript number and string serialization. 25 shared vectors pass in TypeScript and Go | Lone surrogates not rejected; not tested against the RFC's full test suite; the name `canonical-json/1` is used, not "JCS" |
| W3C PROV-O | **Adapter** | SDEP 0.1 nodes and edges map onto PROV (below) | No PROV-O/Turtle/JSON-LD serializer |
| W3C Verifiable Credentials Data Model 2.0 | **Unsupported** | Ed25519 signature over a custom message, `kid`, `issued_at`, key states | Not a VC: no `@context`, `issuer` DID/URL, `credentialSubject`, Data Integrity proof or status list. Closest path: the `eddsa-jcs-2022` cryptosuite, which also uses JCS + Ed25519 |
| in-toto Attestation Framework (Statement v1, DSSE) | **Adapter** | The bundle integrity manifest and engine release give `subject` digests (below) | No in-toto Statement, no DSSE envelope, no predicate type registered |
| OpenLineage | **Adapter** | A passport issuance is a run with source documents as inputs and the passport as output (below) | No OpenLineage events are emitted; no facets defined |

## PROV-O mapping (adapter)

| SDEP 0.1 / passport | PROV-O |
|---|---|
| `SourceDocument`, `SourceVersion`, `EvidenceSpan` nodes | `prov:Entity` (`SourceVersion` `prov:specializationOf` `SourceDocument`) |
| `ExtractedClaim`/`VerifiedClaim`/`DisputedClaim`, `Assumption`, `Calculation`, `DecisionCondition`, `Conclusion`, `DecisionSnapshot` nodes | `prov:Entity` |
| `ReviewAction`, `HumanAttestation` nodes | `prov:Activity` by a `prov:Person` |
| `DerivedFrom` / `DependsOn` edges | `prov:wasDerivedFrom` |
| Engine evaluation producing a passport | `prov:Activity` with `prov:used` (inputs) and `prov:wasGeneratedBy` |
| Engine release (`dt-engine-1.1.0` + sha256) | `prov:SoftwareAgent`, `prov:wasAssociatedWith` |
| Human reviewer (none for the synthetic case) | `prov:Person`, `prov:wasAttributedTo` |
| `Supports`, `Refutes`, `Qualifies`, contradiction edges | no PROV equivalent (would need an extension vocabulary) |
| `generated_at` | `prov:generatedAtTime` |

## in-toto mapping (adapter)

```jsonc
{ "_type": "https://in-toto.io/Statement/v1",
  "subject": [ { "name": "<passport_id>", "digest": { "sha256": "<integrity.passport_sha256>" } } ],
  "predicateType": "<to be defined>",
  "predicate": { "engine": { "version": "dt-engine-1.1.0", "sha256": "cc226a98…" }, "ruleset": "dr-rules-1.0.0",
                 "materials": [ { "uri": "<source id>", "digest": { "sha256": "<inventory sha256>" } } ] } }
```

## OpenLineage mapping (adapter)

`RunEvent(eventType=COMPLETE)`: `job.name = "decision-passport-issuance"`, `run.runId` = UUID derived from the passport
hash, `inputs` = source inventory entries (dataset name = source id, a facet carrying the sha256), `outputs` = the
passport (dataset name = passport ID), `producer` = the engine release.

<!-- passport-mapping:begin (generated from src/lib/passport/standards.ts) -->
## Decision Passport: framework mapping (mapping, not certification)

> Mapping, not certification. This table relates passport mechanisms to concepts and controls of the frameworks named. No audit, assessment or certification against any of them has taken place, and no compliance, legal effect or regulatory approval is claimed.

| Framework | Reference | Concept | Passport mechanism | Gap / limit |
|---|---|---|---|---|
| eIDAS (Reg. (EU) No 910/2014, as amended) | Art. 3 definitions; Arts. 25–26, 35–36 | Electronic signature / seal; advanced signature requirements (linked to signatory, detects changes) | Ed25519 signature over the passport hash, key id and issue time; any change breaks hash and signature | Not a qualified signature or seal; no qualified certificate, no QSCD, no trust service provider; the operator is not supervised. Art. 25(1) only prevents denial of legal effect solely because a signature is electronic; no further effect is claimed. |
| eIDAS | Art. 3(33)–(34), Art. 41–42 | Electronic time stamp | Issue time recorded in the signed message and in the registry | Not a qualified time stamp; the time is the operator’s server clock. |
| eIDAS | Art. 3 (validation), Arts. 32–33 | Validation of signatures | Two independent verifiers (TypeScript, Go) with pinned keys and published conformance fixtures | Not a qualified validation service. |
| ISO/IEC 27001:2022 Annex A | A.8.24 Use of cryptography | Rules for the effective use of cryptography, including key management | Ed25519 signing; key ids derived from public keys; Policy §7 key management (rotation, retirement, compromise) | Key held as a deployment environment secret, not in an HSM. |
| ISO/IEC 27001:2022 Annex A | A.8.15 Logging; A.5.28 Collection of evidence | Logs that record activities; preserving evidence | Append-only workspace audit (rules forbid update/delete), written atomically with each step; audit included in the signed passport | Logs live in the same database project as the data; no external log sealing. |
| ISO/IEC 27001:2022 Annex A | A.5.3 Segregation of duties; A.5.15 Access control; A.8.3 Information access restriction | Conflicting duties separated; access by role | Two-person rule (proposer ≠ reviewer, reviewer must be an editor), enforced by server and database rules; tenant isolation | Roles are assigned by the project owner; no periodic access review process is documented yet. |
| ISO/IEC 27001:2022 Annex A | A.5.24–A.5.27 Incident management | Planning, assessing, responding to and learning from incidents | Policy §8 incident process; revocation with reason key-compromise | Not exercised; no incident has occurred. |
| ISO/IEC 27001:2022 Annex A | A.8.32 Change management; A.8.25 Secure development | Controlled changes to systems | Frozen, hash-pinned engines; CI runs both verifiers and the rules emulator on every change | — |
| EU AI Act (Reg. (EU) 2024/1689) | Art. 12 Record-keeping | Automatic logging of events over a system’s lifetime (obligation for high-risk systems) | Every passport records engine version, AI provider, model and prompt version, and the audit trail of the review | Deep Analysis is not assessed as a high-risk system; the mapping shows a comparable practice, not that Art. 12 applies or is met. |
| EU AI Act | Art. 13 Transparency and provision of information to deployers | Information on capabilities, limitations and output interpretation | Each finding labelled deterministic or AI; attests / does-not-attest and limits written into each passport | As for Art. 12. |
| EU AI Act | Art. 14 Human oversight | Natural persons can oversee, interpret and override output | No passport without a human proposer and a different human reviewer; reviewer note recorded | As for Art. 12. |
| EU AI Act | Art. 50 Transparency obligations | Disclosure that content is AI-generated | AI-layer findings marked as such in the report and the passport, with the model named | Mapping only; no assessment of which Art. 50 obligations apply. |
| SOC 2 (AICPA Trust Services Criteria 2017, rev. 2022) | CC6.1–CC6.3 | Logical access: restricted, role-based, authorised | Signed-in, verified accounts; workspace roles; database rules deny by default | No SOC 2 examination has been performed. |
| SOC 2 | CC7.2–CC7.4 | Monitoring, evaluating and responding to security events | Structured security events for every write; incident process; revocation | As above. |
| SOC 2 | CC8.1 | Change management | Frozen engines, pinned hashes, CI gates | As above. |
| SOC 2 | PI1.1–PI1.5 Processing integrity | Complete, valid, accurate, timely and authorised processing | Re-verification of the report seal and every span at drafting; deterministic rebuild of the passport from the stored record; hash and signature checks | As above. |
<!-- passport-mapping:end -->
