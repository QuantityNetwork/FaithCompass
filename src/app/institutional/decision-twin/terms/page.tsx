import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/record/ui';
import { PILOT_PAYMENT_LINK } from '@/lib/decision/product';
import { OPERATOR, legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Terms of Sale — Decision Twin Pilot',
  description:
    'Draft terms on which Sagolik sells a reservation for a 90-day AbrahamMoses Decision Twin pilot to businesses and organisations. Pending legal review.',
  alternates: { canonical: '/institutional/decision-twin/terms' },
};

const TERMS_OF_SALE_VERSION = 'Draft 0.1 · 20 October 2026';

export default function DecisionTwinTermsPage() {
  const contact = legalContact().general;
  return (
    <main id="main" className="shell shell--narrow page">
      <PageIntro eyebrow={`Legal · ${TERMS_OF_SALE_VERSION} · Draft pending legal review`} title="Terms of Sale — Decision Twin Pilot" />
      <div className="prose-block">
        <p className="am-note" role="note">
          <strong>Draft pending legal review.</strong> These terms have not yet been reviewed by a lawyer and may change before
          they are final. A reservation made while they are in draft is governed by the version shown on this page at the time
          of payment.
        </p>

        <h2>1. Seller</h2>
        <p>
          The seller is {OPERATOR.name}. Legal entity details (registered name, organisation number, registered address and VAT
          number) are to be published.
        </p>

        <h2>2. Buyers: businesses and organisations only</h2>
        <p>
          The pilot is sold only to businesses, public bodies and other organisations acting in the course of their business or
          activity. It is not offered to consumers. By reserving, you confirm that you are buying on behalf of such an
          organisation and that you are authorized to bind it.
        </p>

        <h2>3. What you buy</h2>
        <p>
          A reservation for a 90-day pilot of the AbrahamMoses Decision Twin: one private workspace, for up to 10 users, with
          onboarding. Private institutional workspaces have not yet been released. The 90-day pilot period starts only when they
          are released and on a start date agreed with you in writing. Until then, the public demonstration (the{' '}
          <Link className="link" href="/institutional/decision-room">
            Decision Room
          </Link>
          ) is the only part of the product available.
        </p>

        <h2>4. Price, VAT and invoice</h2>
        <p>
          The price is €9,500 excluding VAT. VAT is charged, or the reverse-charge mechanism applied, according to your location
          and VAT identification number. The invoice is issued through Stripe.
        </p>

        <h2>5. Payment</h2>
        <p>
          Payment is made by Stripe on Stripe’s own checkout page (
          <a className="link" href={PILOT_PAYMENT_LINK} rel="noopener noreferrer">
            pilot reservation
          </a>
          ). {OPERATOR.name} does not receive or store your card details.
        </p>

        <h2>6. Cancellation and refunds</h2>
        <ul>
          <li>You may cancel at any time before the pilot starts and receive a full refund.</li>
          <li>
            If the pilot has not started within 90 days of payment, you receive a full refund on request.
          </li>
          <li>If {OPERATOR.name} cancels the pilot, you receive a full refund.</li>
          <li>After the pilot has started, no refund is given except where required by law.</li>
        </ul>

        <h2>7. Decision support only; liability</h2>
        <p>
          The Decision Twin is decision support. It does not make decisions, and you keep full responsibility for every decision
          you take with its help, including any credit, investment, legal or governance decision. It is not financial, legal or
          investment advice. To the extent permitted by law, {OPERATOR.name}’s total liability under or in connection with the
          pilot is limited to the fees you have paid for it. This does not limit liability that cannot lawfully be limited.
        </p>

        <h2>8. The Decision Passport</h2>
        <p>
          A Decision Passport is an evidentiary and governance record of how a decision was reasoned. It is not a binding
          decision, an audit opinion, a regulatory approval or a certification. Its integrity hash shows that the record has
          not changed since it was generated, not that its content is correct.
        </p>

        <h2>9. No regulatory approval</h2>
        <p>
          The Decision Twin has no regulatory approval or certification, and no assessment under DORA or any other regulation is
          claimed. Any regulated buyer remains responsible for its own outsourcing, ICT third-party risk and compliance
          assessments.
        </p>

        <h2>10. Your data</h2>
        <p>
          No customer data is accepted until private workspaces are authorized and released. Before you upload any customer data,
          the processing of personal data will be governed by a separate data processing agreement between you and{' '}
          {OPERATOR.name}. See also the <Link className="link" href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>11. Governing law</h2>
        <p>These terms are governed by Swedish law.</p>

        <h2>12. Contact</h2>
        <p>
          {contact ? (
            <>
              Questions about these terms: <a className="link" href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            'Contact details will be published.'
          )}
        </p>

        <p>
          <Link className="link" href="/institutional/decision-twin#pricing">
            Back to Decision Twin pricing
          </Link>
        </p>
      </div>
    </main>
  );
}
