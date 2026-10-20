import type { Metadata } from 'next';
import Link from 'next/link';
import { DecisionTwinLogo } from '@/components/decision/brand';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  LAYERS,
  PILOT_CHECKOUT_ENABLED,
  PILOT_ENQUIRY_SUBJECT,
  PILOT_PAYMENT_LINK,
  PLANS,
  PRICING_LABEL,
  PRODUCT,
  sellerText,
  STATUS_LINE,
  contactHref,
  sellerContact,
  type LayerStatus,
} from '@/lib/decision/product';
import { legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'AbrahamMoses Decision Twin',
  description:
    'A proposed institutional platform that keeps a versioned record of why a decision was justified, what could invalidate it and who approves it. What is demonstrated today, what is planned and what it is not.',
  alternates: { canonical: '/institutional/decision-twin' },
};

const STATUS_LABEL: Record<LayerStatus, string> = {
  DEMONSTRATED: 'Demonstrated (synthetic)',
  PARTIAL: 'Partly demonstrated',
  PLANNED: 'Planned',
};
const STATUS_STYLE: Record<LayerStatus, string> = {
  DEMONSTRATED: 'supported',
  PARTIAL: 'partially_supported',
  PLANNED: 'insufficient_evidence',
};

export default function DecisionTwinPage() {
  const contact = contactHref(sellerContact(legalContact().general));
  const pilotContact = contactHref(sellerContact(legalContact().general), PILOT_ENQUIRY_SUBJECT);
  return (
    <main id="main" className="am-page dr">
      <div className="am-wrap">
        <header className="am-page__head">
          <div className="dt-brand">
            <DecisionTwinLogo height={140} />
          </div>
          <p className="am-eyebrow">Sagolik Institutional · Proposed product</p>
          <h1 className="am-h1">{PRODUCT.name}</h1>
          <p className="am-lede">
            {PRODUCT.tagline} {PRODUCT.positioning}
          </p>
          <p className="dt-principle">{PRODUCT.principle}</p>
        </header>

        <section className="am-section" id="status" aria-labelledby="status-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Implementation status</p>
            <h2 className="am-h2" id="status-title">
              What exists today
            </h2>
          </div>
          <div className="am-example" role="note">
            <p>
              The Decision Twin is a <strong>proposed</strong> product. Today it exists only as a public demonstration on one
              fictional private credit case: the <Link href="/institutional/decision-room">Decision Room</Link> and its
              synthetic Decision Passports. There are no private workspaces, accounts, customers or customer data. No bank,
              fund or institution has reviewed, validated or used it, and it holds no certification. The only thing for sale is a
              paid pilot reservation: the 90-day pilot starts once private workspaces are available.
            </p>
          </div>
          <p>
            A Decision Twin is a digital representation of one decision: its evidence, assumptions, alternatives, risks and
            approvals, kept as a versioned record of why it was justified, what could invalidate it and who approves it. It
            models a decision, not a person.
          </p>
        </section>

        <section className="am-section" id="layers" aria-labelledby="layers-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Architecture</p>
            <h2 className="am-h2" id="layers-title">
              Six layers, and which are demonstrated now
            </h2>
          </div>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">The six layers of the Decision Twin and their status</caption>
              <thead>
                <tr>
                  <th scope="col">Layer</th>
                  <th scope="col">What it does</th>
                  <th scope="col">Status</th>
                  <th scope="col">Today</th>
                </tr>
              </thead>
              <tbody>
                {LAYERS.map((l) => (
                  <tr key={l.n}>
                    <td data-label="Layer">
                      {l.n}. {l.name}
                    </td>
                    <td data-label="What it does">{l.does}</td>
                    <td data-label="Status">
                      <span className={`am-out am-out--${STATUS_STYLE[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                    </td>
                    <td data-label="Today">{l.now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="am-tiny">
            AI interpretations, when they are added, will stay distinguishable from verified information and from
            deterministic calculations. The demonstration uses no AI.
          </p>
        </section>

        <section className="am-section" id="configuration" aria-labelledby="config-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Configuration</p>
            <h2 className="am-h2" id="config-title">
              Per decision, and per workspace
            </h2>
          </div>
          <p>
            Each decision carries its own configuration: the objective, the evidence standard, which assumptions are fixed,
            adjustable or disputed, the approval policy (propose, review, reject, approve), escalation rules for missing or
            contradictory evidence and monitoring triggers. It is saved with every version so the decision can be
            reproduced. The <Link href="/institutional/decision-room#configuration">Decision Room shows it</Link> for the
            synthetic case, and every Decision Passport contains a snapshot.
          </p>
          <details className="dr-details">
            <summary>Default workspace settings (planned for private workspaces; read-only)</summary>
            <p className="am-tiny">No private workspace exists yet; these defaults are not in effect anywhere.</p>
            <dl className="dr-meta">
              {DEFAULT_WORKSPACE_SETTINGS.map((x) => (
                <div key={x.setting} className="dr-meta__row">
                  <dt>{x.setting}</dt>
                  <dd>{x.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>

        <section className="am-section" id="environments" aria-labelledby="env-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Two environments</p>
            <h2 className="am-h2" id="env-title">
              AbrahamMoses Scholarly and Sagolik Institutional
            </h2>
          </div>
          <p>
            AbrahamMoses Scholarly is the public research record on this site. Sagolik Institutional, the proposed home of the
            Decision Twin, would hold confidential data under governance, simulations, controlled integrations and contractual
            service levels. They would share technology but keep access, data and editorial responsibility separate; religious
            research can be sensitive, so public and institutional workspaces stay apart.{' '}
            <Link href="/institutional#decision-room">More on the difference</Link>.
          </p>
        </section>

        <section className="am-section" id="legal" aria-labelledby="legal-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Legal status</p>
            <h2 className="am-h2" id="legal-title">
              Decision support, not a decision
            </h2>
          </div>
          <ul>
            <li>The Decision Twin is decision support only. The customer keeps full responsibility for its decisions.</li>
            <li>
              Human oversight has to be meaningful: an approval button alone is not oversight. The system may propose; review,
              rejection and approval are human actions.
            </li>
            <li>
              A Decision Passport is an evidentiary and governance record. It is not a binding decision, an audit opinion, a
              regulatory approval or a certification. Its hash shows the record is unchanged, not that it is correct.
            </li>
            <li>It is not regulated financial, legal or investment advice.</li>
            <li>
              No DORA assessment, regulatory approval or certification is claimed. Use by a financial institution would first
              need its own ICT third-party risk, outsourcing and data-protection assessments and a written agreement.
            </li>
          </ul>
        </section>

        <section className="am-section" id="pricing" aria-labelledby="pricing-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Pricing</p>
            <h2 className="am-h2" id="pricing-title">
              Plans
            </h2>
          </div>
          <p className="am-tiny">
            <strong>{PRICING_LABEL}.</strong>
          </p>
          <p className="am-note" role="status">
            <strong>{STATUS_LINE}.</strong>
          </p>
          <div className="dt-plans">
            {PLANS.map((plan) => (
              <article key={plan.id} className="am-card dt-plan" aria-labelledby={`plan-${plan.id}`}>
                <h3 className="am-h3" id={`plan-${plan.id}`}>
                  {plan.name}
                </h3>
                <p className="dt-plan__price">
                  <strong>{plan.price}</strong> <span className="am-tiny">{plan.period}</span>
                </p>
                <ul>
                  {plan.includes.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {plan.action === 'pilot' ? (
                  PILOT_CHECKOUT_ENABLED ? (
                    <p>
                      <a className="am-btn am-btn--gold" href={PILOT_PAYMENT_LINK} rel="noopener noreferrer">
                        Reserve a pilot
                      </a>
                    </p>
                  ) : pilotContact ? (
                    <p>
                      <a className="am-btn am-btn--gold" href={pilotContact}>
                        {plan.cta}
                      </a>
                    </p>
                  ) : (
                    <p className="am-tiny">Pilot enquiries open once our contact details are published.</p>
                  )
                ) : contact ? (
                  <p>
                    <a className="am-btn" href={contact}>
                      {plan.cta}
                    </a>
                  </p>
                ) : (
                  <p className="am-tiny">
                    {plan.cta}: contact details will be published.
                  </p>
                )}
                {plan.note ? <p className="am-tiny">{plan.note}</p> : null}
                {plan.action === 'pilot' ? (
                  PILOT_CHECKOUT_ENABLED ? (
                    <p className="am-tiny">
                      By reserving you accept the <Link href="/institutional/decision-twin/terms">Terms of Sale</Link>{' '}
                      (not reviewed by a lawyer). Full refund on request if the pilot has not started within 90 days of payment.
                      {pilotContact ? (
                        <>
                          {' '}
                          Questions first? <a href={pilotContact}>Ask us by email</a>.
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <p className="am-tiny">
                      <Link href="/institutional/decision-twin/terms">Terms of Sale</Link>. A request is an enquiry, not a
                      purchase.
                    </p>
                  )
                ) : null}
              </article>
            ))}
          </div>
          <p className="am-tiny">
            {sellerText(sellerContact(legalContact().general))} A pilot is a paid reservation that starts once private
            workspaces are available; payment is taken by Stripe, which issues the receipt. Decision support only: the customer
            keeps responsibility for its decisions, and a Decision Passport is not a binding decision, audit opinion, regulatory
            approval or certification. No DORA assessment or regulatory approval is claimed; a written agreement is required
            before any client data is used.
          </p>
        </section>

        <p>
          <Link className="am-btn am-btn--gold" href="/institutional/decision-room">
            Open the Decision Room (synthetic demonstration)
          </Link>
        </p>
      </div>
    </main>
  );
}
