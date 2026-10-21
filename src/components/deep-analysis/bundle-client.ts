/** Bundle wrapper for a recorded report opened in the browser (the report already carries its seal). */
import type { Report } from '@/lib/deep-analysis/schema';

export function buildDeepBundleClient(report: Report) {
  return {
    bundle: 'abrahammoses-deep-analysis-bundle',
    schema_version: '1.0.0',
    report,
    integrity: {
      algorithm: 'SHA-256',
      canonicalization: report.seal.canonicalization,
      report_sha256: report.seal.reportSha256,
      text_sha256: report.document.textSha256,
      file_sha256: report.document.bytesSha256,
      signed: false,
      how_to_verify: 'Remove report.seal, serialise the rest of the report as canonical JSON and hash it with SHA-256: it must equal report_sha256. Each span: report.text.slice(start, end) must equal quote, and SHA-256(quote) must equal sha256.',
    },
  };
}
