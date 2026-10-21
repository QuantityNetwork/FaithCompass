/**
 * Sealed export of a Deep Analysis report: the report (which carries the analysed text) plus its digests. Anyone can
 * re-check it offline with `verifyBundle`: the report digest is recomputed over canonical JSON and every span is
 * checked against the text by offset and by hash. Not signed: the passport signing key is reserved for Decision
 * Passports, and a digest proves only that the report is unchanged, not who produced it.
 */
import { CANONICALIZATION } from '@/lib/passport-bundle/bundle';
import { reportDigest } from './analyze';
import { ReportSchema, type Report } from './schema';
import { verifySpan } from './spans';

export const DEEP_BUNDLE_KIND = 'abrahammoses-deep-analysis-bundle';
export const DEEP_BUNDLE_VERSION = '1.0.0';

export function buildDeepBundle(report: Report) {
  return {
    bundle: DEEP_BUNDLE_KIND,
    schema_version: DEEP_BUNDLE_VERSION,
    report,
    integrity: {
      algorithm: 'SHA-256' as const,
      canonicalization: CANONICALIZATION,
      report_sha256: report.seal.reportSha256,
      text_sha256: report.document.textSha256,
      file_sha256: report.document.bytesSha256,
      signed: false,
      how_to_verify: 'Remove report.seal, serialise the rest of the report as canonical JSON and hash it with SHA-256: it must equal report_sha256. Each span: report.text.slice(start, end) must equal quote, and SHA-256(quote) must equal sha256.',
    },
  };
}
export type DeepBundle = ReturnType<typeof buildDeepBundle>;

export interface BundleCheck { ok: boolean; problems: string[]; spansChecked: number }

export function verifyBundle(b: unknown): BundleCheck {
  const problems: string[] = [];
  const parsed = ReportSchema.safeParse((b as DeepBundle)?.report);
  if (!parsed.success) return { ok: false, problems: ['report does not match schema ' + parsed.error.issues[0]?.message], spansChecked: 0 };
  const r = parsed.data;
  const { seal, ...rest } = r;
  if (reportDigest(rest) !== seal.reportSha256) problems.push('report digest does not match: the report was changed after sealing');
  if ((b as DeepBundle).integrity?.report_sha256 !== seal.reportSha256) problems.push('bundle integrity digest differs from the report seal');
  const ids = new Set(r.spans.map((s) => s.id));
  for (const s of r.spans) if (!verifySpan(r.text, s)) problems.push(`span ${s.id} does not match the text`);
  const cited = [...r.findings.flatMap((f) => f.spans), ...r.clauses.flatMap((c) => c.summary?.spans ?? []), ...r.finalStatement.overallSpans, ...r.finalStatement.recommendedActions.flatMap((a) => a.spans)];
  for (const id of cited) if (!ids.has(id)) problems.push(`cited span ${id} is missing`);
  return { ok: problems.length === 0, problems, spansChecked: r.spans.length };
}

export const bundleFileName = (r: Report) => `deep-analysis-${r.seal.reportSha256.slice(0, 12)}.bundle.json`;
