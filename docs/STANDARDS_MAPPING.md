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
