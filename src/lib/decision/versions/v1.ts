/**
 * The Private Credit Decision Twin: a fictional case.
 *
 * EVERYTHING HERE IS SYNTHETIC. The borrower, lender, figures, documents and
 * the "independent" note are invented for demonstration. No real company,
 * bank, fund, adviser or person is described or implied. The documents are
 * internally consistent except for the conflicts disclosed in
 * contradictions.ts, which are intentional.
 *
 * Amounts are USD millions unless a field says otherwise.
 *
 * ARCHIVED, IMMUTABLE: case version 1.0.0. Passports issued for this version
 * are rebuilt from this file, so it must never be edited. Its canonical
 * SHA-256 is pinned in versions/index.ts and checked before every rebuild and
 * by tests. A changed case is a new file (versions/v2.ts) and a new version.
 */

export const CASE_ID = 'DT-PC-001';
export const CASE_VERSION = '1.0.0';
export const RULESET_VERSION = 'dr-rules-1.0.0';

export const CASE = {
  id: CASE_ID,
  version: CASE_VERSION,
  title: 'Private Credit Decision Twin: $120M senior secured facility',
  borrower: 'Exemplar Industrial Holdings (fictional)',
  question: 'Should the committee approve the proposed facility under the specified conditions?',
  facility: {
    total: 120,
    tranches: [
      { name: 'Term loan', amount: 90, note: 'Five years, amortising 5% a year' },
      { name: 'Revolving credit facility', amount: 30, note: '$10M drawn at close' },
    ],
    purpose: 'Refinance existing bank debt and fund a plant expansion',
  },
  label: 'Illustrative and synthetic. Not a real borrower, lender or credit decision.',
} as const;

export interface DocField {
  key: string;
  label: string;
  value: number | string;
  unit?: '$M' | '%' | 'x' | 'date' | 'text';
  /** Reporting period the value relates to. */
  period?: string;
  /** Measurement basis or definition. */
  basis?: string;
}

export interface CaseDocument {
  id: string;
  title: string;
  kind: string;
  author: string;
  date: string;
  /** Recorded verification state in the synthetic data room. */
  verification: 'verified' | 'unverified';
  summary: string;
  fields: DocField[];
}

export const DOCUMENTS: CaseDocument[] = [
  {
    id: 'DOC-01',
    title: 'Audited financial statements FY2025',
    kind: 'Financial statements',
    author: 'Borrower, audited (synthetic)',
    date: '2026-03-15',
    verification: 'verified',
    summary: 'Reported results for the year to 31 December 2025, with FY2024 comparatives.',
    fields: [
      { key: 'revenue_fy2024', label: 'Revenue FY2024', value: 250.0, unit: '$M', period: 'FY2024', basis: 'Reported' },
      { key: 'revenue_fy2025', label: 'Revenue FY2025', value: 260.0, unit: '$M', period: 'FY2025', basis: 'Reported' },
      { key: 'ebitda_fy2025', label: 'EBITDA FY2025', value: 41.6, unit: '$M', period: 'FY2025', basis: 'Reported (no add-backs)' },
      { key: 'ebitda_margin_fy2025', label: 'EBITDA margin FY2025', value: 16.0, unit: '%', period: 'FY2025', basis: 'Reported' },
      { key: 'cash_fy2025', label: 'Cash at year end', value: 18.0, unit: '$M', period: '31 Dec 2025', basis: 'Reported' },
    ],
  },
  {
    id: 'DOC-02',
    title: 'Management forecast FY2026',
    kind: 'Forecast',
    author: 'Borrower management (synthetic)',
    date: '2026-05-02',
    verification: 'unverified',
    summary: 'Management case for FY2026. Assumes the top customer grows volumes 15% and renews on current terms.',
    fields: [
      { key: 'revenue_growth_fy2026', label: 'Revenue growth FY2026', value: 12.0, unit: '%', period: 'FY2026', basis: 'Management case' },
      { key: 'ebitda_margin_fy2026', label: 'EBITDA margin FY2026', value: 17.5, unit: '%', period: 'FY2026', basis: 'Management case, adjusted' },
      { key: 'top_customer_volume_growth', label: 'Top customer volume growth', value: 15.0, unit: '%', period: 'FY2026', basis: 'Management case' },
    ],
  },
  {
    id: 'DOC-03',
    title: 'Pro forma debt schedule at close',
    kind: 'Debt schedule',
    author: 'Borrower finance team (synthetic)',
    date: '2026-06-30',
    verification: 'unverified',
    summary: 'All borrowings at close, including leases and the seller note from the 2024 acquisition.',
    fields: [
      { key: 'term_loan', label: 'Term loan', value: 90.0, unit: '$M', period: 'At close', basis: 'Face value' },
      { key: 'rcf_drawn', label: 'Revolver drawn', value: 10.0, unit: '$M', period: 'At close', basis: 'Face value' },
      { key: 'leases', label: 'Equipment leases', value: 8.0, unit: '$M', period: 'At close', basis: 'Face value' },
      { key: 'seller_note', label: 'Seller note', value: 16.0, unit: '$M', period: 'At close', basis: 'Face value' },
      { key: 'total_debt', label: 'Total debt', value: 124.0, unit: '$M', period: 'At close', basis: 'Total debt incl. leases and seller note' },
      { key: 'interest_expense', label: 'Pro forma annual interest expense', value: 10.5, unit: '$M', period: 'First 12 months', basis: 'Contractual rates at close' },
      { key: 'cash_at_close', label: 'Cash at close', value: 15.0, unit: '$M', period: 'At close', basis: 'Estimated' },
      { key: 'rcf_undrawn', label: 'Revolver undrawn', value: 20.0, unit: '$M', period: 'At close', basis: 'Commitment less drawn' },
    ],
  },
  {
    id: 'DOC-04',
    title: 'Credit memo (draft for committee)',
    kind: 'Credit memo',
    author: 'Deal team (synthetic)',
    date: '2026-07-08',
    verification: 'unverified',
    summary: 'Recommends approval subject to conditions. Uses LTM adjusted EBITDA. States bank policy on concentration.',
    fields: [
      { key: 'total_debt', label: 'Total debt', value: 118.0, unit: '$M', period: 'At close', basis: 'Total debt incl. leases and seller note' },
      { key: 'adj_ebitda_ltm', label: 'Adjusted EBITDA LTM', value: 46.8, unit: '$M', period: 'LTM to 30 Jun 2026', basis: 'Adjusted (incl. $3.2M add-backs)' },
      { key: 'concentration_policy', label: 'Single-customer concentration policy limit', value: 25.0, unit: '%', basis: 'Synthetic bank policy' },
      { key: 'stress_ebitda_decline', label: 'Committee stress case: EBITDA decline', value: 20.0, unit: '%', basis: 'Synthetic bank policy' },
    ],
  },
  {
    id: 'DOC-05',
    title: 'Draft loan agreement (financial covenants)',
    kind: 'Loan agreement (draft)',
    author: 'Lender counsel (synthetic)',
    date: '2026-07-01',
    verification: 'unverified',
    summary: 'Draft clause 22. "Consolidated EBITDA" adds back non-recurring charges without a cap.',
    fields: [
      { key: 'max_leverage', label: 'Maximum total leverage', value: 3.5, unit: 'x', basis: 'Total debt / Consolidated EBITDA' },
      { key: 'min_interest_cover', label: 'Minimum interest cover', value: 3.0, unit: 'x', basis: 'Consolidated EBITDA / interest expense' },
      { key: 'min_liquidity', label: 'Minimum liquidity', value: 10.0, unit: '$M', basis: 'Cash plus undrawn revolver' },
      { key: 'addback_cap', label: 'Cap on non-recurring add-backs', value: 'None', unit: 'text', basis: 'Clause 22.1 definition' },
    ],
  },
  {
    id: 'DOC-06',
    title: 'Covenant definitions schedule (term sheet)',
    kind: 'Term sheet schedule',
    author: 'Deal team (synthetic)',
    date: '2026-05-20',
    verification: 'unverified',
    summary: 'Agreed commercial terms. Caps add-backs at 10% of EBITDA.',
    fields: [
      { key: 'max_leverage', label: 'Maximum total leverage', value: 3.5, unit: 'x', basis: 'Total debt / Covenant EBITDA' },
      { key: 'addback_cap', label: 'Cap on non-recurring add-backs', value: '10% of EBITDA', unit: 'text', basis: 'Term sheet' },
    ],
  },
  {
    id: 'DOC-07',
    title: 'Customer concentration report',
    kind: 'Analysis',
    author: 'Borrower, reviewed by deal team (synthetic)',
    date: '2026-06-12',
    verification: 'unverified',
    summary: 'Top customer is 22% of FY2025 revenue; its contract renews in Q1 2027 and it has said it intends to dual-source.',
    fields: [
      { key: 'top_customer_share', label: 'Top customer share of revenue', value: 22.0, unit: '%', period: 'FY2025', basis: 'Reported revenue' },
      { key: 'renewal_date', label: 'Top customer contract renewal', value: 'Q1 2027', unit: 'date' },
      { key: 'renewal_risk', label: 'Stated intent', value: 'Dual-sourcing under consideration', unit: 'text' },
    ],
  },
  {
    id: 'DOC-08',
    title: 'Collateral summary',
    kind: 'Collateral',
    author: 'Deal team (synthetic)',
    date: '2026-06-28',
    verification: 'unverified',
    summary: 'Receivables, inventory and plant. PP&E value cites appraisal A-2026-03, which is not in the data room.',
    fields: [
      { key: 'receivables', label: 'Eligible receivables', value: 38.0, unit: '$M', period: '30 Jun 2026', basis: 'Book value' },
      { key: 'inventory', label: 'Inventory', value: 30.0, unit: '$M', period: '30 Jun 2026', basis: 'Book value' },
      { key: 'ppe_olv', label: 'PP&E orderly liquidation value', value: 52.0, unit: '$M', basis: 'Per appraisal A-2026-03 (not provided)' },
    ],
  },
  {
    id: 'DOC-09',
    title: 'Independent assessment note',
    kind: 'Third-party note',
    author: 'Synthetic adviser (no real firm)',
    date: '2026-06-20',
    verification: 'unverified',
    summary: 'Sector outlook. Confirms FY2025 reported EBITDA and notes margins are sensitive to input costs.',
    fields: [
      { key: 'ebitda_fy2025', label: 'EBITDA FY2025', value: 41.6, unit: '$M', period: 'FY2025', basis: 'Reported (no add-backs)' },
      { key: 'sector_growth', label: 'Sector growth outlook', value: 4.5, unit: '%', period: 'FY2026', basis: 'Adviser estimate' },
    ],
  },
  {
    id: 'DOC-10',
    title: 'Risk committee questions',
    kind: 'Questions',
    author: 'Risk committee secretary (synthetic)',
    date: '2026-07-10',
    verification: 'verified',
    summary: 'Questions the committee asked the deal team to answer before the meeting.',
    fields: [
      { key: 'q1', label: 'Q1', value: 'Reconcile total debt between the memo and the debt schedule.', unit: 'text' },
      { key: 'q2', label: 'Q2', value: 'Which EBITDA definition will the covenant use?', unit: 'text' },
      { key: 'q3', label: 'Q3', value: 'Provide the PP&E appraisal.', unit: 'text' },
      { key: 'q4', label: 'Q4', value: 'What happens if the top customer dual-sources?', unit: 'text' },
    ],
  },
];
