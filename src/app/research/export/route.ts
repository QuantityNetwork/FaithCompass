/**
 * GET /research/export?(case|dossier|q)=…&format=json|md — a dossier as a file, with its
 * reproducibility manifest. Same assembly as the workspace page: published records only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { buildDossier, exportDossier, exportMarkdown, parseFilters, parseOff } from '@/lib/research/dossier';
import { getRecord } from '@/lib/record/record';

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const record = getRecord();
  const c = sp.get('case');
  const dossier = sp.get('dossier');
  const q = (sp.get('q') ?? '').slice(0, 500);
  if (!c && !dossier && !q) return NextResponse.json({ error: 'Name a case, dossier or q.' }, { status: 400 });
  if (c && !record.researchCase(c)) return NextResponse.json({ error: `No research case ${c}.` }, { status: 404 });
  const d = buildDossier(record, c ? { case: c } : dossier ? { dossier } : { q });
  const filters = parseFilters((k) => sp.get(k) ?? undefined);
  const off = parseOff(record, sp.getAll('off').join(','));
  const name = `abrahammoses-${d.mode === 'case' || d.mode === 'vision' ? d.id : 'search'}-${record.version}`;
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (sp.get('format') === 'md') {
    return new NextResponse(exportMarkdown(record, d, off, filters), {
      headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.md"` },
    });
  }
  return new NextResponse(JSON.stringify(exportDossier(record, d, off, filters), null, 2), {
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.json"` },
  });
}
