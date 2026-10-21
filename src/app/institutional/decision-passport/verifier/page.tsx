import type { Metadata } from 'next';
import { Disclaimer, GITHUB, GITHUB_TREE, Intro, Section } from '../content';

export const metadata: Metadata = {
  title: 'Offline verifier · Decision Passport',
  description: 'Download and run the independent Go verifier for Decision Passport bundles: standard library only, no network access, with pinned keys, engines and revocation lists.',
  alternates: { canonical: '/institutional/decision-passport/verifier' },
};

export default function VerifierPage() {
  return (
    <>
      <Intro kicker="Decision Passport · 6" title="Offline verifier">
        <p>
          <code>decision-verifier</code> is a second, independent implementation of the specification, in Go with the standard library only. It shares no code with this website, needs no network
          access and no account, and is run in CI against the same conformance fixtures as the website&apos;s own verifier.
        </p>
        <p className="dp-row">
          <a className="dp-btn dp-btn--primary" href={`${GITHUB_TREE}/packages/decision-verifier`}>Source on GitHub</a>
          <a className="dp-btn" href="/decision-passport/production-keys.json" download>production-keys.json</a>
          <a className="dp-btn" href="/decision-passport/engines.json" download>engines.json</a>
          <a className="dp-btn" href="/api/passport/revocations">revocations.json</a>
        </p>
      </Intro>
      <Section n={1} id="build" title="Build" lede="Requires Go 1.22 or later. No modules are downloaded.">
        <pre className="dp-pre" tabIndex={0}>{`git clone https://github.com/QuantityNetwork/FaithCompass.git
cd FaithCompass/packages/decision-verifier
GOPROXY=off go build -o decision-verifier .
./decision-verifier --conformance conformance      # every shared fixture must pass (exit 0)`}</pre>
      </Section>
      <Section n={2} id="run" title="Verify a passport">
        <pre className="dp-pre" tabIndex={0}>{`./decision-verifier \\
  --keys production-keys.json \\
  --engines engines.json \\
  [--expected-sha256 <hash you obtained independently>] \\
  [--revocations revocations.json] \\
  passport.bundle.json`}</pre>
        <div className="dp-scroll">
          <table className="dp-table">
            <thead><tr><th scope="col">Exit code</th><th scope="col">Meaning</th></tr></thead>
            <tbody>
              <tr><th scope="row">0</th><td>VALID</td></tr>
              <tr><th scope="row">1</th><td>INVALID (a check failed, including revocation when a list is given)</td></tr>
              <tr><th scope="row">2</th><td>UNSUPPORTED (unknown schema or engine)</td></tr>
              <tr><th scope="row">3</th><td>Usage or I/O error</td></tr>
            </tbody>
          </table>
        </div>
        <p>The output is a JSON report with every check, its status (pass, fail, uncheckable) and a detail line, identical in structure to the verdict of the online portal.</p>
      </Section>
      <Section n={3} id="trust" title="What to trust">
        <ol>
          <li>Obtain <code>production-keys.json</code> once over a trusted channel and compare it with the pinned file in the repository and the live key document. Verifiers never trust keys carried in a bundle.</li>
          <li><code>engines.json</code> lists the frozen engines by source hash. A bundle from an unknown engine is UNSUPPORTED, not VALID.</li>
          <li>A revocation list is accepted only when signed by a pinned key; otherwise the revocation check is &ldquo;uncheckable&rdquo;.</li>
          <li>For a Deep Analysis passport, re-check the bound report with its own bundle: the report seal must equal <code>subject.report_sha256</code>.</li>
        </ol>
        <p className="dp-muted">Details: <a href={`${GITHUB}/docs/INDEPENDENT_VERIFICATION.md`}>docs/INDEPENDENT_VERIFICATION.md</a>.</p>
      </Section>
      <Disclaimer />
    </>
  );
}
