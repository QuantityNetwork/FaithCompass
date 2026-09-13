import { Page, SectionTitle } from '@/components/evidence/primitives';
import {
  CERTAINTY_LEVELS,
  CERTAINTY_META,
  SOURCE_TIERS,
  SOURCE_TIER_META,
  ABSENCE_VERDICTS,
  ABSENCE_VERDICT_META,
} from '@/lib/evidence/taxonomy';

export const metadata = { title: 'Method' };

export default function MethodPage() {
  return (
    <Page narrow>
      <p className="eyebrow">Evidence Intelligence</p>
      <h1 className="display" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
        Method
      </h1>
      <p className="standfirst">
        What the figures mean, what they do not mean, and where the method stops.
      </p>

      <section style={{ marginTop: 56 }}>
        <SectionTitle>What a score is</SectionTitle>
        <div className="prose">
          <p>
            Every figure is an <strong>evidence confidence</strong>: an assessment of how strongly
            the available evidence supports one specific claim. It is not a probability that the
            claim is true, and it is not a measure of anyone&rsquo;s faith.
          </p>
          <p>
            A reasoning model never returns a score. It returns structured factor assessments — the
            relevance, directness and independence of specific cited items, and bounded penalty
            estimates — and application code computes the number from those. Two analyses run months
            apart by different providers are comparable because the arithmetic is fixed even though
            the judgement is not.
          </p>
          <p>
            Scores above 95 require multiple independent primary sources with negligible
            counter-evidence. Interpretive and theological readings are capped below the top band,
            because the text underdetermines them by nature however well attested the manuscripts
            are. A claim is never scored low merely for being supernatural.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <SectionTitle>Three dimensions, never combined</SectionTitle>
        <div className="prose">
          <p>
            Textual confidence, historical corroboration and interpretive confidence are assessed
            and displayed separately. A passage can be textually secure and historically
            uncorroborated at once; a claim can have high archaeological correspondence and low
            interpretive certainty. Collapsing them into one figure would hide the only thing worth
            knowing.
          </p>
          <p>
            Dimensions are also bounded by claim type. Archaeology cannot establish the Trinity.
            Manuscript counts cannot establish whether God exists. Attaching a dimension that cannot
            bear on a claim is treated as a category error and the evidence item is excluded, not
            merely down-weighted.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <SectionTitle>Certainty taxonomy</SectionTitle>
        <div className="ladder">
          {CERTAINTY_LEVELS.map((level) => (
            <div className="ladder__step" key={level}>
              <div className="ladder__label">{CERTAINTY_META[level].label}</div>
              <p className="small" style={{ margin: 0 }}>
                {CERTAINTY_META[level].definition}
              </p>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 18 }}>
          Note that <em>unsupported</em> and <em>contradicted</em> are different findings.
          &ldquo;Contradicted&rdquo; requires evidence that actually conflicts with the claim; weak
          support alone never produces it.
        </p>
      </section>

      <section style={{ marginTop: 56 }}>
        <SectionTitle>Source classes</SectionTitle>
        <div className="ladder">
          {SOURCE_TIERS.map((tier) => (
            <div className="ladder__step" key={tier}>
              <div className="ladder__label">Tier {tier}</div>
              <p className="small" style={{ margin: 0 }}>
                {SOURCE_TIER_META[tier].description}
              </p>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 18 }}>
          Class affects weighting; confessional standpoint does not. Denominational scholarship is
          weighted by its class like any other source, and its perspective is labelled so a reader
          can see the shape of the evidence base.
        </p>
      </section>

      <section style={{ marginTop: 56 }}>
        <SectionTitle>Absence of evidence</SectionTitle>
        <div className="ladder">
          {ABSENCE_VERDICTS.map((v) => (
            <div className="ladder__step" key={v}>
              <div className="ladder__label">{ABSENCE_VERDICT_META[v].label}</div>
              <p className="small" style={{ margin: 0 }}>
                {ABSENCE_VERDICT_META[v].definition}
              </p>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 18 }}>
          These three are routinely conflated and are not equivalent. An absence counts against a
          claim only when the evidence would plausibly survive, the region has been excavated, the
          predicted footprint is large, the dates are precise and the material culture is
          distinctive — all five, not on average.
        </p>
      </section>

      <section style={{ marginTop: 56 }}>
        <SectionTitle>Citations</SectionTitle>
        <div className="prose">
          <p>
            Every citation is resolved against a curated corpus before it can enter an analysis. A
            reference that does not resolve is dropped from the evidence ledger and recorded as a
            flag — never quietly reshaped into a plausible-looking footnote. Where a source cannot
            be independently verified, the interface says so and does not display it as
            authoritative.
          </p>
          <p>
            Sources that descend from a common original are discounted through a dependency graph:
            two chronicles copying one earlier account are one witness, not two.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <SectionTitle>Where the method stops</SectionTitle>
        <div className="prose">
          <p>
            Claims that historical and textual method cannot adjudicate — whether a text is of
            divine origin, whether an execution accomplished redemption — receive{' '}
            <strong>not directly scorable under historical method</strong> rather than a low number.
            Assigning zero to a metaphysical claim because archaeology is silent about it would be a
            category error dressed as rigour.
          </p>
          <p>
            AbrahamMoses will say that evidence is strong, that evidence is weak, and that we do not
            know. What it will not do is assign a truth percentage to a religion.
          </p>
        </div>
      </section>
    </Page>
  );
}
