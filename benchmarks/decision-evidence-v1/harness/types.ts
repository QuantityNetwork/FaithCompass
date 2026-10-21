/** Shared types for the decision-evidence-v1 harness. */
export type GoldClass = 'CONFIRMED_CONFLICT' | 'POTENTIAL_CONFLICT' | 'DIFFERENT_REPORTING_BASIS' | 'MISSING_EVIDENCE' | 'UNRESOLVED_INTERPRETATION' | 'NONE';

export interface BenchCase {
  id: string;
  domain: string;
  split: 'dev' | 'eval';
  fictional: true;
  title: string;
  entity: string;
  documents: { id: string; title: string; text: string }[];
  spans: { id: string; doc: string; start: number; end: number; text: string }[];
  facts: ({ id: string } & Record<string, unknown>)[];
  conclusions: { id: string; text: string }[];
  gold: {
    pairs: { facts: [string, string]; class: GoldClass; plant: string; note: string }[];
    inputs: Record<string, { input: string; acceptable: string[] }[]>;
    dependencies: Record<string, string[]>;
  };
}

/** What a system returns for one case. Omitted parts mean the system does not produce them (not applicable). */
export interface SystemOutput {
  findings: { facts: [string, string]; class: Exclude<GoldClass, 'NONE'> }[];
  citations?: Record<string, string[]>;
  dependencies?: Record<string, string[]>;
  /** Wall time for this case, ms; and API spend, USD (0 when no paid API is called). */
  ms: number;
  usd: number;
}

export type Availability = { status: 'READY' } | { status: 'BLOCKED'; reason: string };

export interface Baseline {
  id: 'A' | 'B' | 'C' | 'D';
  name: string;
  /** Which per-case outputs the system can produce at all. */
  produces: { findings: boolean; citations: boolean; dependencies: boolean };
  availability(): Availability;
  run(c: BenchCase): Promise<SystemOutput>;
}
