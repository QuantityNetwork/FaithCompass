import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/record/ui';
import { PILOT_PAYMENT_LINK, SALES_STATUS, SELLER_LINE, TERMS_REVIEW_NOTE, VAT_NOTE, sellerContact } from '@/lib/decision/product';
import { legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Terms of Sale — Decision Twin',
  description:
    'Terms of Sale for a paid reservation of a 90-day AbrahamMoses Decision Twin pilot, sold by Sagolik, Halmstad, Sweden, to businesses and organisations. The pilot starts on a date agreed in writing.',
  alternates: { canonical: '/institutional/decision-twin/terms' },
};

const TERMS_OF_SALE_VERSION = 'Version 1.1 · 21 October 2026';

export default function DecisionTwinTermsPage() {
  const contact = sellerContact(legalContact().general);
  return (
    <main id="main" className="shell shell--narrow page">
      <PageIntro eyebrow={`Legal · ${TERMS_OF_SALE_VERSION} · In force`} title="Terms of Sale — Decision Twin" />
      <div className="prose-block">
        <p className="am-note" role="note">
          <strong>{SALES_STATUS}.</strong> {TERMS_REVIEW_NOTE} They apply to pilot reservations paid through the Stripe
          checkout linked from the pricing page. A reservation is governed by the version in force on the day you pay. To ask
          about a pilot before paying, use the contact below; an email is an enquiry, not a purchase.
        </p>

        <h2>1. Seller</h2>
        <p>
          The seller is {SELLER_LINE}. Contact:{' '}
          <a className="link" href={`mailto:${contact}`}>
            {contact}
          </a>
          . The seller is not VAT-registered. The seller’s legal name is shown on the Stripe receipt. “AbrahamMoses”,
          “Decision Twin” and “Sagolik Institutional” are names of the product.
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
          onboarding. Private workspaces are available: the evidence workspace, the Decision Room, Deep Analysis and Decision
          Passport issuing are open to the signed-in, named members of a workspace. The 90-day pilot period starts on a start
          date agreed with you in writing. The public{' '}
          <Link className="link" href="/institutional/decision-room/sample">
            Decision Room sample room
          </Link>{' '}
          shows the method on fictional data and is not part of your workspace.
        </p>

        <h2>4. Price, VAT and receipt</h2>
        <p>
          The price is €9,500, paid once. {VAT_NOTE}, so no VAT is added and the invoice carries no seller VAT number. Stripe
          issues the invoice and receipt.
        </p>

        <h2>5. Payment</h2>
        <p>
          Payment is made through Stripe on Stripe’s own checkout page (
          <a className="link" href={PILOT_PAYMENT_LINK} rel="noopener noreferrer">
            pilot reservation checkout
          </a>
          ). The seller does not receive or store card details.
        </p>

        <h2>6. Cancellation and refunds</h2>
        <ul>
          <li>You may cancel at any time before the pilot starts and receive a full refund.</li>
          <li>
            If the pilot has not started within 90 days of payment, you receive a full refund on request.
          </li>
          <li>If the seller cancels the pilot, you receive a full refund.</li>
          <li>After the pilot has started, no refund is given except where required by law.</li>
        </ul>

        <h2>7. Decision support only; liability</h2>
        <p>
          The Decision Twin is decision support. It does not make decisions, and you keep full responsibility for every decision
          you take with its help, including any credit, investment, legal or governance decision. It is not financial, legal or
          investment advice. To the extent permitted by law, the seller’s total liability under or in connection with the
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
          Private workspaces are available to the named members of your workspace (see section 3). Customer data, including
          any personal data in the documents you upload, is processed only after you and the seller have signed a data
          processing agreement under Article 28 GDPR; until it is signed, do not upload customer data. The template, the
          security description and the list of sub-processors are published under{' '}
          <Link className="link" href="/institutional/trust">Trust and security</Link>. The seller processes customer data only on
          your documented instructions and for the purpose of providing the pilot. See also the{' '}
          <Link className="link" href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>11. Governing law</h2>
        <p>These terms are governed by Swedish law.</p>

        <h2>12. Contact</h2>
        <p>
          Questions about these terms, cancellations and refund requests: {SELLER_LINE},{' '}
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
