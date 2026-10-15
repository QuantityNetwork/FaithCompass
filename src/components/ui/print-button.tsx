'use client';

export function PrintButton() {
  return (
    <button type="button" className="button button--quiet" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
