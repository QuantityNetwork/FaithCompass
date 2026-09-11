# AbrahamMoses

**Structured Theological Intelligence**

A research system for Scripture, theology, manuscript evidence, archaeology and
competing interpretation. This repository currently implements one feature:

## Evidence Intelligence

The question the feature exists to answer:

> **How do we know this — and how certain should we actually be?**

Evidence Intelligence assesses **specific claims** against **specific
evidence**. It does not produce a truth ranking for a religious tradition, and
it is built so that it cannot: a tradition is not the kind of object evidence
bears on, and any interface that scored one would discredit every honest
assessment beside it.

---

## The core commitments

**Claims, not corpora.** A passage is broken into atomic claims, each typed
(textual, historical, archaeological, interpretive, theological, metaphysical
and so on) and each assessed on its own evidence. Daniel 12:1 yields six claims
scoring from 26 to 92: the wording is close to settled, the christological
reading is weakly supported, and averaging them would destroy the only
information worth having.

**Three dimensions, never combined.** Textual confidence, historical
corroboration and interpretive confidence are computed and displayed
separately. A text can be securely transmitted and historically uncorroborated
at the same time.

**Models don't produce numbers.** A reasoning provider returns structured factor
assessments — the relevance, directness and independence of specific cited
items, plus bounded penalty estimates. Application logic computes every score
(`src/lib/evidence/scoring.ts`). Analyses run months apart by different
providers stay comparable because the arithmetic is fixed even though the
judgement is not.

**Citations resolve or they are dropped.** Every source reference is checked
against a curated corpus before it can enter an analysis. What does not resolve
is excluded from the evidence ledger and recorded as a flag — never reshaped
into a plausible-looking footnote. Sources that descend from a common original
are discounted through a dependency graph: two chronicles copying one earlier
account are one witness.

**The method knows where it stops.** Claims historical method cannot adjudicate
receive `NOT_DIRECTLY_SCORABLE` rather than a low number. Scoring a metaphysical
claim at zero because archaeology is silent about it would be a category error
dressed as rigour.

**Weak evidence is not falsehood.** `UNSUPPORTED` and `CONTRADICTED` are
different findings. "Contradicted" requires evidence that actually conflicts
with the claim; a pile of weak support never produces it.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:3000/evidence
npm test           # 126 tests
npm run typecheck
npm run build
```

No API key is needed. The default reasoning provider is corpus-backed and
deterministic.

### Routes

| Route | |
|---|---|
| `/evidence` | Index, guardrail-aware query panel |
| `/evidence/daniel/12/1` | Flagship passage analysis |
| `/evidence/topic/pontius-pilate` | Historical / archaeological demonstration |
| `/evidence/book-of-mormon/near-eastern-migration` | Cross-tradition demonstration |
| `/evidence/claim/[id]` | Full claim analysis, evidence map, Challenge Assessment |
| `/evidence/claim/[id]/card` | Shareable Evidence Card |
| `/evidence/analysis/[id]/sources` | Source Ledger |
| `/evidence/method` | What the figures mean and where the method stops |

### API

| | |
|---|---|
| `GET /api/evidence/analyses` | List persisted analyses |
| `POST /api/evidence/analyze` | Run the pipeline over a passage or query |
| `POST /api/evidence/claims/[id]/challenge` | Adversarial reassessment |
| `POST /api/evidence/ask` | Guardrail-aware query, corpus lenses |

---

## Architecture

```
src/lib/evidence/
  taxonomy.ts      Claim types, dimensions, bands, certainty, source tiers,
                   and the admissibility matrix that enforces category boundaries
  schema.ts        Persisted entities + the narrower schemas a model may return
  scoring.ts       The scoring engine and calibration rules
  absence.ts       Absence-of-evidence reasoning
  guardrails.ts    Tradition-score / debunk / predetermined-conclusion redirects
  citations.ts     Verification against the corpus
  pipeline.ts      The fourteen stages
  challenge.ts     Challenge Assessment and score revision
  prompts.ts       Versioned prompts (persisted with every analysis)
  corpus/          Curated source records and the dependency graph
  providers/       EvidenceReasoningProvider: corpus (default), anthropic
  store/           EvidenceStore: JSON-backed, swappable for a database
  seed/            Curated demonstrations, run through the real pipeline
```

### The pipeline

Fourteen stages rather than one large model call, because the separation is
what makes the output auditable — claim extraction can be cheap, evidence
weighting can be deterministic, citations get verified *before* anything is
persisted, and scores are computed rather than asserted:

1. Understand the query and passage · 2. Extract atomic claims · 3. Classify
claim types · 4. Determine admissible dimensions · 5. Retrieve candidate
sources · 6. Evaluate source quality and independence · 7. Supporting case ·
8. Strongest opposing case · 9. Compare · 10. Calibrated confidence ·
11. Uncertainty statement · 12. What would change this · 13. Validate
citations · 14. Persist with audit records

### Providers

`EvidenceReasoningProvider` (`providers/types.ts`) has two implementations:

- **`corpus`** *(default)* — serves curated assessments and refuses where none
  exists. Useless for open-ended exploration, completely safe for
  demonstration and offline development: it cannot fabricate a manuscript
  because it cannot generate anything.
- **`anthropic`** — Claude-backed, split across a fast tier (extraction,
  classification) and a deep tier (contested interpretation, Challenge
  Assessment). Output is schema-validated and citation-verified before it
  reaches the store.

Set `EVIDENCE_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` to enable. A missing
key degrades to the curated provider rather than taking the feature down, and
the analysis records which provider actually ran. See `.env.example`.

### Calibration

Confidence inflation is the standing risk, so the ceiling is defended
explicitly rather than left to the arithmetic:

- Above 95 requires three independent Tier A sources and negligible
  counter-evidence.
- A claim resting on nothing above Tier D cannot read as High.
- Interpretive and theological readings cap at 92 — the text underdetermines
  them by nature, however well attested the manuscripts.
- A floor scaled to the claim's own supporting evidence stops penalties driving
  a weakly-but-genuinely-evidenced reading to zero. The floor is about
  evidential support, never subject matter: a claim is not scored low for being
  supernatural.

### Auditability

Every analysis records its model provider, model version, prompt version,
analysis version, sources and scoring factors. Challenge Assessments preserve
the previous score and write an audit record. When an assessment changes, a
reader can tell whether the evidence changed, the model changed, or the
instructions changed.

---

## Known limits

- **The corpus is small and hand-curated** (27 records). Growing it is a
  curation task, not a generation task: entries are added when a real record
  has been checked. The `corpus/` abstraction is shaped for Septuagint, Dead
  Sea Scrolls, patristics, rabbinic literature, Josephus, Quran, Hadith and
  archaeological databases, but those are not loaded.
- **Citation verification resolves against the corpus, not live catalogues.**
  Records carry honest verification states, and `VERIFIED` is reserved for
  entries reconciled against an external catalogue. No live catalogue check
  runs yet.
- **Storage is a JSON file.** Adequate for persistence and audit; swap
  `EvidenceStore` for a database before real traffic.
- **The curated provider's Challenge Assessment is a re-weighting**, not an
  adversarial review, and says so in its own output. A live provider is needed
  for a real one.
- **Pro features are architecturally anticipated, not built**: PDF export,
  academic citation export, saved dossiers, collaborative research, MCP.

## Tests

126 tests covering claim extraction, score calculation, confidence-label
mapping, calibration rules, citation validation, structured-output rejection,
challenge revisions, source independence, claim types, evidence dimensions and
absence-of-evidence reasoning — plus the four prompts the methodology must
refuse to answer on their own terms:

```
"Prove Christianity is true."      → redirected, not reasoned to a fixed conclusion
"Give Islam a truth score."        → redirected into analysable claims
"Show that the Book of Mormon is fake."  → declined in the same terms as an apologetic brief
"Give the Bible 100/100."          → the ceiling explained
```
