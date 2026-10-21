import type { Metadata } from 'next';
import { Intro, Section } from '../../decision-passport/content';
import { NOT_SUBPROCESSORS, SUBPROCESSORS } from '@/lib/trust/subprocessors';
import { TRUST_CHECKED } from '@/lib/trust/facts';
import { TrustFooter } from '../content';

export const metadata: Metadata = {
  title: 'Sub-processors · Trust and security',
  description: 'The third parties that process data for AbrahamMoses: purpose, data, location, transfer safeguard and each provider’s own data processing terms.',
  alternates: { canonical: '/institutional/trust/subprocessors' },
};

export default function SubprocessorsPage() {
  return (
    <>
      <Intro kicker="Trust and security · Sub-processors" title="Sub-processors">
        <p>
          Every third party that processes personal data or customer content for AbrahamMoses, taken from the code and the production configuration on {TRUST_CHECKED}. Customers with a signed Data
          Processing Agreement are told at least 30 days before a sub-processor is added or replaced and may object.
        </p>
      </Intro>

      <Section n={1} id="summary" title="Summary">
        <div className="dp-scroll">
          <table className="dp-table tr-stack">
            <thead><tr><th scope="col">Sub-processor</th><th scope="col">Purpose</th><th scope="col">Location</th><th scope="col">Used</th></tr></thead>
            <tbody>
              {SUBPROCESSORS.map((s) => (
                <tr key={s.id}><th scope="row"><a href={`#${s.id}`}>{s.name}</a></th><td data-label="Purpose">{s.purpose}</td><td data-label="Location">{s.location}</td><td data-label="Used">{s.when}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={2} id="details" title="Details">
        <ol className="tr-cards">
          {SUBPROCESSORS.map((s) => (
            <li key={s.id} id={s.id}>
              <div>
                <h3>{s.name}</h3>
                <p className="tr-entity">{s.entity}</p>
              </div>
              <dl>
                <dt>Purpose</dt><dd>{s.purpose}</dd>
                <dt>Data</dt><dd>{s.data}</dd>
                <dt>Location</dt><dd>{s.location}</dd>
                <dt>When</dt><dd>{s.when}</dd>
                <dt>Safeguard</dt><dd>{s.safeguard}</dd>
                <dt>Their terms</dt>
                <dd className="tr-links">{s.links.map((l) => <a key={l.href} href={l.href} rel="noopener noreferrer">{l.label}</a>)}</dd>
              </dl>
            </li>
          ))}
        </ol>
      </Section>

      <Section n={3} id="not-used" title="Not sub-processors" lede="Providers that appear in the code or the toolchain but process no customer data today.">
        <table className="dp-table tr-kv">
          <tbody>{NOT_SUBPROCESSORS.map((n) => <tr key={n.name}><th scope="row">{n.name}</th><td>{n.why}</td></tr>)}</tbody>
        </table>
      </Section>
      <TrustFooter />
    </>
  );
}
