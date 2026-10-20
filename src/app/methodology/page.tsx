import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, Section } from '@/components/record/ui';
import { getRecord } from '@/lib/record/record';
import {
  ACCEPTANCE_META,
  AXIOM_STANCE_META,
  AXIS_META,
  CASE_RESPONSE_META,
  CLASSIFICATION_META,
  CONFIDENCE_AXES,
  MACHINE_META,
  STATUS_META,
  type AxisLevel,
} from '@/lib/record/taxonomy';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'How the AbrahamMoses record is built: claim metadata, confidence criteria, dependency semantics, publication states, editorial standards, corrections and limitations.',
  alternates: { canonical: '/methodology' },
};

const COMPONENTS: Array<[string, string, string]> = [
  ['Stable identifier', 'Permanent claim code and revision number', 'code, revision'],
  ['Primary witness', 'Book, chapter and verse, folio or section of the text the claim reports', 'witnesses'],
  ['Textual edition', 'The critical or standard edition each witness is cited from', 'editions'],
  ['Translation', 'Translator, publication, edition and licence for any quoted wording', 'quotations[].translation'],
  ['Claim classification', 'Quotation, textual proposition, exegetical lemma, philological or historical claim, inference, or doctrinal interpretation', 'classification'],
  ['Evidence', 'Exact references, with notes, and any relevant textual variants', 'evidence, variants'],
  ['Confidence', 'Four axes with written criteria, plus per-tradition acceptance — never one score', 'confidence, acceptance'],
  ['Tradition', 'Explicit attribution to a tradition, or to scholarship, or none for a textual report', 'attribution'],
  ['Counterviews', 'Rival readings with their evidence and the principles they rely on or deny', 'counter_models'],
  ['Editorial history', 'Author, reviewers and dates, change note for every revision', 'editorial, revisions'],
  ['Machine involvement', 'Whether AI contributed, how, and whether an editor has verified the result', 'machine_involvement'],
];

export default function MethodologyPage() {
  const record = getRecord();
  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Methodology"
        title="How the record is built"
        lede="AbrahamMoses is a structured record, not a commentary. This page sets out what every claim records, what each confidence level requires, how dependencies are evaluated, and the editorial rules that govern publication and correction."
      />

      <Section id="claim-metadata" title="What every claim records" eyebrow="Reproducibility">
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">What is recorded</th>
                <th scope="col">API field</th>
              </tr>
            </thead>
            <tbody>
              {COMPONENTS.map(([c, what, field]) => (
                <tr key={c}>
                  <td data-label="Component">{c}</td>
                  <td data-label="What is recorded">{what}</td>
                  <td data-label="API field">
                    <code className="code-inline">{field}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="classification" title="Claim classification">
        <div className="grid-2">
          {Object.entries(CLASSIFICATION_META).map(([id, m]) => (
            <div key={id} className="card">
              <h3 className="card__title">{m.label}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {m.definition}
              </p>
              <p className="small faint" style={{ margin: '6px 0 0' }}>
                Grounding: {m.grounding === 'derived' ? 'derived from other claims' : m.grounding === 'witness' ? 'its witness' : 'its evidence'}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="confidence"
        title="Confidence: separate axes, written criteria"
        eyebrow="Never one score"
        intro="A claim can be textually secure and contested between traditions at once. The axes are recorded and shown separately and are never combined into a single figure; each level has a criterion a reader can check."
      >
        {CONFIDENCE_AXES.map((axis) => (
          <div key={axis} className="section--tight">
            <h3 className="subheading">
              {AXIS_META[axis].label} <span className="faint small">— {AXIS_META[axis].question}</span>
            </h3>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {([5, 4, 3, 2, 1] as AxisLevel[]).map((l) => (
                    <tr key={l}>
                      <th scope="row" style={{ width: '22%' }}>
                        {l} · {AXIS_META[axis].levels[l].label}
                      </th>
                      <td>{AXIS_META[axis].levels[l].criterion}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Not applicable</th>
                    <td>{AXIS_META[axis].notApplicable}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <div className="section--tight">
          <h3 className="subheading">
            Traditional acceptance <span className="faint small">— which traditions accept or dispute the claim</span>
          </h3>
          <ul className="reasons-plain" style={{ fontSize: 14 }}>
            {Object.entries(ACCEPTANCE_META).map(([k, m]) => (
              <li key={k}>
                <strong>{m.label}</strong> — {m.definition}
              </li>
            ))}
          </ul>
          <p className="small muted">
            Acceptance is a matrix, never a percentage. A report of what a text says is not disputed between traditions as a
            report; disagreement is recorded on the readings built on it.
          </p>
        </div>
      </Section>

      <Section id="dependencies" title="Dependency semantics">
        <p className="prose-block" style={{ marginTop: 0 }}>
          Every conclusion records its derivations — independent ways of arriving at it — and each derivation records its
          necessary and supporting premises and the reading principles it requires or is strengthened by. A conclusion is not
          established under the selected assumptions only when no derivation survives; a textual report keeps its standing
          when the reading built on it is set aside;
          circular support establishes nothing. The full rules, and the explorer that applies them, are on the{' '}
          <Link className="link" href="/hermeneutics#semantics">
            Hermeneutics page
          </Link>
          .
        </p>
        <ul className="reasons-plain" style={{ fontSize: 14 }}>
          {Object.entries(AXIOM_STANCE_META).map(([k, m]) => (
            <li key={k}>
              Axiom stance <strong>{m.label}</strong> — {m.definition}
            </li>
          ))}
          {Object.entries(CASE_RESPONSE_META).map(([k, m]) => (
            <li key={k}>
              Case response <strong>{m.label}</strong> — {m.definition}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="publication" title="Publication states and immutable revisions">
        <div className="grid-2">
          {Object.entries(STATUS_META).map(([k, m]) => (
            <div key={k} className="card">
              <h3 className="card__title">{m.label}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {m.definition}
              </p>
              <p className="small faint" style={{ margin: '6px 0 0' }}>
                {m.public ? 'Public' : 'Never public'}
              </p>
            </div>
          ))}
        </div>
        <div className="prose-block section--tight">
          <p>
            A public revision never changes. Correcting one means appending a new revision with a change note; the earlier
            revision stays readable at its own address, so a citation always resolves to what was cited. Every public revision’s
            content hash is pinned in the repository, and a build that alters one fails. Drafts are never served by the site,
            the API or the MCP server.
          </p>
          <p>
            <strong>Published means a named reviewer.</strong> A revision is published only when the editor who verified it is
            recorded, with the date, in its editorial history; the integrity check fails the build otherwise. In the review
            sequence Draft → Source-validated → Editorially reviewed → Externally reviewed, a provisional revision is a public
            draft awaiting source validation and editorial review. Records carried over from the earlier Claim Ledger, where
            no reviewer was recorded, are provisional for that reason. Their one status correction (2026-10-20) is listed on the{' '}
            <Link className="link" href="/changelog#status-corrections">
              changelog
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section id="editorial" title="Editorial standards">
        <div className="prose-block">
          <h3>Governing rules</h3>
          <ul>
            <li>
              <strong>Scripture is the source.</strong> Primary text is recorded as text. Nothing is rewritten to fit a
              conclusion.
            </li>
            <li>
              <strong>Interpretation is attributed.</strong> Every reading names the tradition, author or source that holds it.
            </li>
            <li>
              <strong>Analysis is identified.</strong> Machine or editorial analysis is labelled as analysis, never as source
              material.
            </li>
            <li>
              <strong>Provenance is preserved.</strong> A finding that cannot show its chain does not enter the record.
            </li>
            <li>
              <strong>Dispute stays visible.</strong> Counterviews and divergence are recorded beside the claim, not hidden
              behind it.
            </li>
            <li>
              <strong>Questions are asked in their own terms.</strong> A tradition is not made to answer another tradition’s
              question; where the questions differ, the record says so.
            </li>
          </ul>
          <h3>Review</h3>
          <p>
            A revision is <em>published</em> when an AbrahamMoses editor has checked its references against the cited editions,
            its quotations against their translations, and its confidence levels against the written criteria. It is{' '}
            <em>externally reviewed</em> when a scholar outside the editorial team, named in the editorial history, has reviewed
            it. Research cases are to be reviewed by scholars of the tradition whose question they ask before they leave
            provisional status.
          </p>
          <h3>Machine involvement</h3>
          <p>
            Every revision discloses machine involvement: {Object.values(MACHINE_META).map((m) => m.label.toLowerCase()).join('; ')}.
            AI assistance may draft structure and metadata; it never publishes. A revision drafted with assistance stays
            provisional until an editor verifies it. Evidence assessments under{' '}
            <Link className="link" href="/evidence">
              Evidence Intelligence
            </Link>{' '}
            record the model, prompt version and provider that produced them.
          </p>
          <h3>Corrections</h3>
          <p>
            Anyone may report an error with a reference to the claim code. A correction is made by appending a revision whose
            change note says what changed and why; withdrawn claims stay resolvable with their reason. The{' '}
            <Link className="link" href="/changelog">
              changelog
            </Link>{' '}
            lists every revision.
          </p>
        </div>
      </Section>

      <Section id="limitations" title="Limitations">
        <ul className="prose-block">
          <li>
            The record holds {record.data.claims.length} claims in four research cases. It is a demonstration of method at scale
            small enough to verify, not a comprehensive theology.
          </li>
          <li>
            Revisions added in October 2026 — including every new case — were drafted with AI assistance and are provisional
            until an editor verifies them. Named editors and external reviewers have not yet been published.
          </li>
          <li>Tradition stances on reading principles summarise mainstream positions; internal diversity is noted where recorded.</li>
          <li>
            A tradition lens removes only the principles a tradition is recorded as rejecting; it is a simulation, not a statement
            of the tradition’s view on every claim.
          </li>
          <li>
            Coverage gaps are listed on the{' '}
            <Link className="link" href="/corpus#gaps">
              corpus page
            </Link>
            .
          </li>
        </ul>
      </Section>
    </main>
  );
}
