import type { Metadata } from 'next';
import Link from 'next/link';
import { Intro, Section } from '../../decision-passport/content';
import { QUESTIONNAIRE } from '@/lib/trust/questionnaire';
import { sellerContact } from '@/lib/decision/product';
import { legalContact } from '@/lib/site/config';
import { TrustFooter } from '../content';

export const metadata: Metadata = {
  title: 'Security questionnaire · Trust and security',
  description: 'Short, plain answers to the questions in a typical bank or insurer vendor-risk questionnaire: data location, encryption, retention, incident notice, sub-processors, testing and certification.',
  alternates: { canonical: '/institutional/trust/questionnaire' },
};

export default function QuestionnairePage() {
  const contact = sellerContact(legalContact().general);
  return (
    <>
      <Intro kicker="Trust and security · Questionnaire" title="Security questionnaire">
        <p>
          Short answers to the questions a bank’s or insurer’s vendor-risk questionnaire usually asks, so that a review can start before the first call. Where the answer is “no”, it says no. Your own
          questionnaire is answered in full on request.
        </p>
      </Intro>

      {QUESTIONNAIRE.map((g, gi) => (
        <Section key={g.group} n={gi + 1} id={g.group.toLowerCase().replace(/[^a-z]+/g, '-')} title={g.group}>
          <ol className="tr-qa">
            {g.items.map((it) => (
              <li key={it.id} id={it.id}>
                <div>
                  <h3>{it.q}</h3>
                  <span className="tr-status tr-short">{it.short}</span>
                </div>
                <p>{it.a}</p>
              </li>
            ))}
          </ol>
        </Section>
      ))}

      <Section n={QUESTIONNAIRE.length + 1} id="contact" title="Contact">
        <p>
          Questionnaires, security questions and requests for the signed DPA: {' '}
          <a href={`mailto:${contact}`}>{contact}</a>. To discuss a pilot, see <Link href="/institutional/decision-twin#pricing">Decision Twin pricing</Link>.
        </p>
      </Section>
      <TrustFooter />
    </>
  );
}
