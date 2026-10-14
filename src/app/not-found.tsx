import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="shell shell--narrow page">
      <p className="eyebrow">Not found</p>
      <h1 className="display">There is no record at this address.</h1>
      <p className="lede">
        Claim codes look like AM-CLAIM-000184. If you followed a citation, the claim may be listed under a different code in
        the ledger.
      </p>
      <div className="button-row">
        <Link className="button" href="/claims">
          Claim Ledger
        </Link>
        <Link className="button button--quiet" href="/research">
          Search the record
        </Link>
      </div>
    </main>
  );
}
