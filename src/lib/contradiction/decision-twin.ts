/**
 * Facts for the deterministic layer from the Decision Twin's archived documents. The concept of a field is its key
 * with the period suffix removed and an `adj_` prefix read as definition "adjusted"; period, unit and basis come from
 * the field itself.
 */
import { CASE, DOCUMENTS } from '@/lib/decision/engines/v1/case';
import type { Fact } from './normalize';

export function conceptOf(key: string): { concept: string; definition: string | null } {
  let k = key;
  let definition: string | null = null;
  if (k.startsWith('adj_')) {
    definition = 'adjusted';
    k = k.slice(4);
  }
  k = k.replace(/_(fy\d{4}|ltm|q[1-4]_?\d{4})$/, '');
  return { concept: k, definition };
}

export function decisionTwinFacts(): Fact[] {
  return DOCUMENTS.flatMap((d) =>
    d.fields.map((f) => {
      const { concept, definition } = conceptOf(f.key);
      return { id: `span:${d.id}#${f.key}`, entity: CASE.borrower, concept, value: f.value, unit: f.unit ?? null, period: f.period ?? null, basis: f.basis ?? null, definition };
    }),
  );
}
