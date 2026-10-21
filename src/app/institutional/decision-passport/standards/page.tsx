import type { Metadata } from 'next';
import { MAPPING, MAPPING_NOTICE } from '@/lib/passport/standards';
import { Disclaimer, Intro, Section } from '../content';

export const metadata: Metadata = {
  title: 'Standards mapping · Decision Passport',
  description: 'How Decision Passport mechanisms relate to eIDAS concepts, ISO/IEC 27001 controls, EU AI Act record-keeping and transparency articles and SOC 2 criteria. A mapping, not a certification.',
  alternates: { canonical: '/institutional/decision-passport/standards' },
};

export default function StandardsPage() {
  const frameworks = [...new Set(MAPPING.map((m) => m.framework.split(' (')[0]))];
  return (
    <>
      <Intro kicker="Decision Passport · 8" title="Standards mapping">
        <p className="dp-notice"><strong>{MAPPING_NOTICE}</strong></p>
        <p>The &ldquo;gap&rdquo; column states plainly where a passport falls short of what the framework describes.</p>
      </Intro>
      {frameworks.map((f, i) => (
        <Section key={f} n={i + 1} id={`f${i + 1}`} title={f}>
          <div className="dp-scroll">
            <table className="dp-table">
              <thead><tr><th scope="col">Reference</th><th scope="col">Concept</th><th scope="col">Passport mechanism</th><th scope="col">Gap / limit</th></tr></thead>
              <tbody>
                {MAPPING.filter((m) => m.framework.split(' (')[0] === f).map((m) => (
                  <tr key={m.reference}><th scope="row">{m.reference}</th><td>{m.concept}</td><td>{m.mechanism}</td><td>{m.gap}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}
      <Section n={frameworks.length + 1} id="data" title="Data formats">
        <p>Bundle formats and canonicalisation relate to RFC 8785 (JSON canonicalisation), W3C PROV-O, W3C Verifiable Credentials 2.0, in-toto and OpenLineage, as set out in docs/STANDARDS_MAPPING.md. No conformance certification is claimed.</p>
      </Section>
      <Disclaimer />
    </>
  );
}
