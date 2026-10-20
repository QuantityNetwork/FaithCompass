'use client';

export function PrintButton() {
  return (
    <button type="button" className="am-btn am-btn--sm" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
