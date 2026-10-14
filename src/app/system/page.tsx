import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeLink, PageIntro, Refs } from '@/components/record/ui';
import { claimSummary } from '@/lib/api/views';
import { getRecord } from '@/lib/record/record';
import { CORPUS_CATEGORY_META } from '@/lib/record/taxonomy';

export const metadata: Metadata = {
  title: 'The AbrahamMoses System',
  description:
    'The structure beneath theological understanding: the twelve chapters that set out the AbrahamMoses method, each linked to the working part of the system it describes.',
  alternates: { canonical: '/system' },
};

function Chapter({ n, kicker, title, children }: { n: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="section" aria-labelledby={`ch-${n}`}>
      <p className="chapter-number">
        Ch. {n} — {kicker}
      </p>
      <h2 className="section-heading" id={`ch-${n}`}>
        {title}
      </h2>
      <div className="prose-block">{children}</div>
    </section>
  );
}

export default function SystemPage() {
  const record = getRecord();
  const c184 = claimSummary(record, record.claim('AM-CLAIM-000184')!);
  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Research infrastructure · Vol. I"
        title={
          <>
            The structure beneath <em style={{ color: 'var(--gold-bright)' }}>theological understanding.</em>
          </>
        }
        lede="AbrahamMoses connects Scripture, historical sources, covenantal context, doctrine, interpretation and evidence in one structured system. Every important conclusion remains traceable to its source. These twelve chapters set out the method; each links to the part of the system that does what it describes."
      />

      <Chapter n="01" kicker="The problem" title="Answers are easy. Knowing why they are true is harder.">
        <p>
          Modern AI can generate theological answers in seconds. The problem is that answers often blur together: Scripture,
          interpretation, tradition, historical context, scholarly opinion and machine analysis. AbrahamMoses separates them —
          source, claim, interpretation, analysis — and never silently merges them.
        </p>
      </Chapter>

      <Chapter n="01·B" kicker="Proof inspector" title="Don’t trust a conclusion. Try to break it.">
        <p>
          Every claim in the record rests on texts, lemmas and a tradition’s reading principles. Reject any of them and the
          inspector traces which conclusions break, which weaken and which map connections lose their grounding — now with
          exact AND/OR logic, so a conclusion with two independent arguments survives the loss of one.{' '}
          <Link className="link" href="/hermeneutics#console">
            Open the console
          </Link>{' '}
          or the{' '}
          <Link className="link" href="/hermeneutics#explorer">
            visual explorer
          </Link>
          .
        </p>
      </Chapter>

      <Chapter n="02" kicker="The system" title="One theological question. Six connected layers.">
        <p>
          Corpus — the sources. Claim Ledger — what the evidence establishes. Covenant Map — where it sits in the larger story.
          Doctrine Graph — how theological ideas connect. Tradition Layer — how communities understand it. Research Engine —
          evidence-based retrieval, comparison and the dependency model. Each layer takes a structured record as input and
          produces traceable output.
        </p>
      </Chapter>

      <Chapter n="03" kicker="Corpus" title="Start with the sources.">
        <p>AbrahamMoses begins with texts, not generated conclusions.</p>
        <ul>
          {Object.values(CORPUS_CATEGORY_META).map((c) => (
            <li key={c.ordinal}>
              <strong>
                {c.ordinal} {c.label}
              </strong>{' '}
              — {c.includes.join(', ')}.
            </li>
          ))}
        </ul>
        <p>
          Sources are classified by provenance and epistemic level, and their status is never silently altered.{' '}
          <Link className="link" href="/corpus">
            Corpus and coverage
          </Link>
        </p>
      </Chapter>

      <Chapter n="04" kicker="Claim ledger" title="Every conclusion becomes auditable.">
        <div className="claim-card" style={{ fontFamily: 'var(--serif)' }}>
          <div className="claim-card__head">
            <CodeLink code={c184.code} />
            <span>{c184.classification_label}</span>
          </div>
          <p className="claim-card__statement">{c184.statement}</p>
          <p className="claim-card__witnesses">
            <Refs refs={c184.witnesses} /> · Disputed: {c184.disputed}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Interpretive divergence: {c184.interpretive_divergence}
          </p>
        </div>
        <p>
          The explicit textual proposition stays stable. Later theological conclusions are linked, attributed and open to
          review — and every revision of every claim is preserved.{' '}
          <Link className="link" href="/claims">
            The Claim Ledger
          </Link>
        </p>
      </Chapter>

      <Chapter n="05" kicker="Covenant map" title="See where a passage sits in the bigger story.">
        <p>
          The Covenant Map does not force contested theology into a single conclusion — or into a single storyline. Jewish,
          Christian, Islamic and Latter-day Saint readings of covenantal history are kept side by side, sharing the covenants
          they share, each relationship attributed to the readings it belongs to.{' '}
          <Link className="link" href="/covenants">
            Open the Covenant Map
          </Link>
        </p>
      </Chapter>

      <Chapter n="06" kicker="Doctrine graph" title="Doctrine is a network, not a list.">
        <p>
          Every edge has evidence, a classification and a tradition status; affirmation and dispute are attributed separately.
          The graph has no fixed centre and opens on Abraham, the figure every tradition in the record shares.{' '}
          <Link className="link" href="/doctrine">
            Open the Doctrine Graph
          </Link>
        </p>
      </Chapter>

      <Chapter n="07" kicker="Worked example" title="Ask one question. See the whole chain.">
        <p>
          <em>What happens to priesthood under the New Covenant?</em> Primary sources: Psalm 110, Jeremiah 31, Hebrews 7–10.
          Claim: Hebrews presents Jesus as High Priest according to the order of Melchizedek. Covenant context: Sinai →
          priesthood → prophetic promise → New Covenant. Tradition views are attributed at every contested step. Textual
          certainty is very high; interpretive certainty varies by each later theological claim.
        </p>
        <p>
          Certainty decreases exactly where interpretation begins. The same treatment now covers four questions — one each in
          Jewish, Christian, Islamic and Latter-day Saint studies.{' '}
          <Link className="link" href="/research">
            The research cases
          </Link>
        </p>
      </Chapter>

      <Chapter n="08" kicker="Traditions" title="Different traditions. Clearly attributed.">
        <p>
          AbrahamMoses does not flatten traditions into one artificial consensus. Interpretations are stored with attribution,
          context and evidence; if two traditions disagree, the system shows the disagreement — and if they are asking different
          questions, it says that instead.{' '}
          <Link className="link" href="/traditions">
            The Tradition Layer
          </Link>
        </p>
      </Chapter>

      <Chapter n="09" kicker="Provenance" title="Why does AbrahamMoses say this?">
        <p>
          Finding, claims used, supporting evidence, primary source, covenant relationships, doctrine connections,
          interpretations, counterviews. The reasoning chain stays visible — no invisible leap from source to answer — and every
          claim now has one.
        </p>
      </Chapter>

      <Chapter n="10" kicker="MCP" title="Built to be used by other intelligence systems.">
        <p>
          AbrahamMoses exposes structured theological research through the Model Context Protocol and a REST API: evidence,
          claims, covenant relationships, doctrine connections, counterviews, provenance and rejection analysis — without
          turning AbrahamMoses into a generic text API.{' '}
          <Link className="link" href="/developers">
            Machine access
          </Link>
        </p>
      </Chapter>

      <Chapter n="11" kicker="Partnership" title="AbrahamMoses × Doctrine Lab">
        <p>
          AbrahamMoses supplies the evidence architecture: corpus, claim ledger, covenant map, doctrine graph and tradition
          layer, through its public interfaces. Doctrine Lab works with it — research, studies, analysis and comparative
          doctrine.{' '}
          <Link className="link" href="/about#relationships">
            How the organisations relate
          </Link>
        </p>
      </Chapter>

      <Chapter n="12" kicker="Principles" title="Four rules govern the system.">
        <ol>
          <li>Scripture is the source.</li>
          <li>Interpretation is attributed.</li>
          <li>Analysis is identified.</li>
          <li>Provenance is preserved.</li>
        </ol>
        <p>
          <strong>The text stays the text.</strong> Everything built upon it remains traceable.
        </p>
      </Chapter>
    </main>
  );
}
