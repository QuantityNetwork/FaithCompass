/** The fictional sample documents (public/deep-analysis/samples), written for demonstration and labelled as such. */
export const SAMPLE_FILES = [
  { id: 'sample-service-agreement', file: 'sample-service-agreement.md', title: 'Service agreement (fictional sample)' },
  { id: 'sample-nda', file: 'sample-nda.md', title: 'Mutual NDA (fictional sample)' },
  { id: 'sample-supplier-contract', file: 'sample-supplier-contract.md', title: 'Supply agreement (fictional sample)' },
] as const;
export type SampleId = (typeof SAMPLE_FILES)[number]['id'];
