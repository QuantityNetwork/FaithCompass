import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/record/ui';
import { SALES_STATUS, SELLER, SELLER_LINE, TERMS_REVIEW_NOTE, sellerContact } from '@/lib/decision/product';
import { legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Terms of Sale — Decision Twin Pilot',
  description:
    'Draft terms, not in force, for a future 90-day AbrahamMoses Decision Twin pilot sold by Mikael Markus Andersson (private individual, Sweden) to businesses and organisations. No sales are accepted until private workspaces exist.',
  alternates: { canonical: '/institutional/decision-twin/terms' },
};

const TERMS_OF_SALE_VERSION = 'Draft 0.2 · 20 October 2026';
const SELLER_NAME = SELLER.name;

export default function DecisionTwinTermsPage() {
  const contact = sellerContact(legalContact().general);
  return (
    <main id="main" className="shell shell--narrow page">
      <PageIntro eyebrow={`Legal · ${TERMS_OF_SALE_VERSION} · Draft, not in force`} title="Terms of Sale — Decision Twin Pilot" />
      <div className="prose-block">
        <p className="am-note" role="note">
          <strong>{SALES_STATUS}.</strong> {TERMS_REVIEW_NOTE} They are published so prospective buyers can see the intended
          terms, and they may change before they come into force. To ask about a pilot, use the contact below; a request is an
          enquiry, not a purchase.
        </p>

        <h2>1. Seller</h2>
        <p>
          The seller is {SELLER_LINE}, {SELLER.location}. The seller is a private individual, not a company: there is no
          organisation number and no VAT registration. “AbrahamMoses”, “Decision Twin” and “Sagolik Institutional” are names
          of the product, not of a legal entity.
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

        <h2>4. Price, VAT and receipt</h2>
        <p>
          The indicative price is €9,500. It is stated without VAT because the seller is not VAT-registered, so no VAT would be
          added and the seller’s invoice would carry no VAT number. When sales open, Stripe issues the invoice and receipt.
        </p>

        <h2>5. Payment</h2>
        <p>
          When sales open, payment will be made through Stripe on Stripe’s own checkout page; {SELLER_NAME} will not receive or
          store card details. No payment is currently being taken.
        </p>

        <h2>6. Cancellation and refunds</h2>
        <ul>
          <li>You may cancel at any time before the pilot starts and receive a full refund.</li>
          <li>
            If the pilot has not started within 90 days of payment, you receive a full refund on request.
          </li>
          <li>If {SELLER_NAME} cancels the pilot, you receive a full refund.</li>
          <li>After the pilot has started, no refund is given except where required by law.</li>
        </ul>

        <h2>7. Decision support only; liability</h2>
        <p>
          The Decision Twin is decision support. It does not make decisions, and you keep full responsibility for every decision
          you take with its help, including any credit, investment, legal or governance decision. It is not financial, legal or
          investment advice. To the extent permitted by law, {SELLER_NAME}’s total liability under or in connection with the
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
          {SELLER_NAME}. See also the <Link className="link" href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>11. Governing law</h2>
        <p>These terms are governed by Swedish law.</p>

        <h2>12. Contact</h2>
        <p>
          Questions about these terms, cancellations and refund requests: {SELLER_NAME},{' '}
          <a className="link" href={`mailto:${contact}`}>
            {contact}
          </a>
          .
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
