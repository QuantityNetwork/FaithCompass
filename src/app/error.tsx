'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** No page is left in an unresolved state: a failure says so and offers a retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="shell shell--narrow page">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="display">This page could not be rendered.</h1>
      <p className="lede">
        Nothing in the record was changed. You can try again, or check the service status.
        {error.digest ? ` Reference: ${error.digest}.` : ''}
      </p>
      <div className="button-row">
        <button type="button" className="button" onClick={reset}>
          Try again
        </button>
        <Link className="button button--quiet" href="/status">
          Service status
        </Link>
      </div>
    </main>
  );
}
