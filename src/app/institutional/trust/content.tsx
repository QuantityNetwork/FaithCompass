/** Shared parts of the Trust pages. */
import Link from 'next/link';
import { TRUST_CHECKED, TRUST_VERSION } from '@/lib/trust/facts';

export const TRUST_NOTE =
  'This section describes what is in place today, checked against the code and the production configuration. It is not a certification, an audit report or the result of an external test, and AbrahamMoses has not been validated by any bank or other institution.';

export function TrustFooter() {
  return (
    <p className="dp-disclaimer">
      <strong>Status.</strong> {TRUST_NOTE} Version {TRUST_VERSION}, checked {TRUST_CHECKED}. Questions:{' '}
      <Link href="/institutional/trust/questionnaire#contact">contact</Link>.
    </p>
  );
}
