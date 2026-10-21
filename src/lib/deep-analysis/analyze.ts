/**
 * Deep Analysis pipeline: segment, extract deterministically, optionally read with the AI layer, verify every AI
 * quotation against the text, run the contradiction engine (deterministic layer plus AI candidates with the
 * deterministic veto), compose the final statement, seal. Pure apart from the injected AI provider.
 */
import { canonicalJson } from '@/lib/decision/canonical';
import { combineLayers, type Candidate, type CandidateSource } from '@/lib/contradiction/detect';
import type { Fact as EngineFact } from '@/lib/contradiction/normalize';
import { CANONICALIZATION } from '@/lib/passport-bundle/bundle';
import { AI_PROMPT_VERSION, NO_AI, aiPrompt, parseAiAnswer, type AiAnswer, type DeepAiProvider } from './ai';
import { TOPICS, extractDeterministic } from './extract';
import { sha256Hex, type ParsedDocument } from './parse';
import { DISCLAIMER, ENGINE_VERSION, REPORT_SCHEMA, ReportSchema, SECTIONS, SEVERITIES, type Finding, type Report, type Section, type Severity, type UnsealedReport } from './schema';
import { segmentClauses } from './segment';
import { SpanTable, locateQuote } from './spans';

export interface AnalyzeOptions {
  provider?: DeepAiProvider;
  /** Why the AI layer is not used although a provider may exist (access policy); null to use it. */
  aiBlockedReason?: string | null;
  sample?: boolean;
  now?: () => Date;
}

const sevRank: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
const SECTION_SET = new Set<string>(SECTIONS);

export async function analyzeDocument(doc: ParsedDocument, opts: AnalyzeOptions = {}): Promise<Report> {
  const provider = opts.provider ?? NO_AI;
  const text = doc.text;
  const raw = segmentClauses(text);
  const clauseAt = (o: number) => raw.find((c) => o >= c.start && o < c.end)?.id ?? null;
  const table = new SpanTable(text, clauseAt);
  const det = extractDeterministic(text, raw, table, doc.textSha256);

  /* ---------------------------------------------------------------- AI layer */
  let ai: Report['engine']['ai'] = {
    status: provider.configured ? (opts.aiBlockedReason ? 'not_permitted' : 'used') : 'not_configured',
    note: !provider.configured ? 'AI layer not configured on this deployment: deterministic rules only.' : opts.aiBlockedReason ?? '',
    provider: provider.configured ? provider.id : null,
    model: provider.configured ? provider.model : null,
    promptVersion: provider.configured ? AI_PROMPT_VERSION : null,
    proposed: 0, dropped: 0, vetoed: 0, droppedExamples: [], usage: null, truncated: false,
  };
  let answer: AiAnswer | null = null;
  if (ai.status === 'used') {
    const { prompt, truncated } = aiPrompt(text, raw);
    try {
      const out = await provider.complete(prompt);
      answer = parseAiAnswer(out.text);
      ai = { ...ai, model: out.model, usage: out.usage, truncated };
      if (!answer) ai = { ...ai, status: 'failed', note: `The AI answer was not valid JSON${out.finishReason === 'length' ? ' (it hit the output limit)' : ''}; deterministic rules only.` };
      else ai.note = `AI layer used (${out.model}). Every AI finding was checked: each quotation must occur in the document verbatim, otherwise the finding was dropped.${truncated ? ' The document was longer than the AI input limit; the AI read only its first part.' : ''}${out.finishReason === 'length' ? ' The AI answer hit the output limit and may be incomplete.' : ''}`;
    } catch (e) {
      // Only the provider's HTTP status is shown (never request details or the key).
      const status = /returned (\d{3})/.exec(e instanceof Error ? e.message : '')?.[1];
      ai = { ...ai, status: 'failed', note: `The AI provider could not be reached${status ? ` (HTTP ${status})` : ''}; deterministic rules only.` };
    }
  }

  const findings: Omit<Finding, 'id'>[] = [...det.findings];
  const clauseSummaries = new Map<string, { text: string; spans: string[] }>();
  const aiParties: Report['overview']['parties'] = [];
  let aiType: Report['overview']['type'] = null;
  let aiFinal: AiAnswer['finalStatement'] = null;
  const aiPairs: Candidate[] = [];
  const aiPairNotes = new Map<string, string>();
  const placeholderFacts: EngineFact[] = [];

  if (answer) {
    const drop = (what: string) => {
      ai.dropped++;
      if (ai.droppedExamples.length < 5) ai.droppedExamples.push(what.slice(0, 160));
    };
    const cite = (quotes: string[], near?: string | null): string[] | null => {
      const within = near ? raw.find((c) => c.id === near) : undefined;
      const found = quotes.map((q) => locateQuote(text, q, within));
      // All quotations must be found, or none is recorded (no orphan spans from a dropped finding).
      if (!found.length || found.some((x) => !x)) return null;
      return [...new Set(found.map((at) => table.add(at!.start, at!.end).id))];
    };
    if (answer.documentType) {
      ai.proposed++;
      const ids = cite([answer.documentType.quote]);
      if (ids) aiType = { value: answer.documentType.value, spans: ids, layer: 'ai' };
      else drop(`document type: ${answer.documentType.quote}`);
    }
    for (const p of answer.parties) {
      ai.proposed++;
      const ids = cite([p.quote]);
      if (ids) aiParties.push({ name: p.name, role: p.role, spans: ids, layer: 'ai' });
      else drop(`party: ${p.quote}`);
    }
    for (const c of answer.clauses) {
      ai.proposed++;
      if (!raw.some((r) => r.id === c.clause)) { drop(`clause summary for unknown clause ${c.clause}`); continue; }
      const ids = cite([c.quote], c.clause);
      if (ids) clauseSummaries.set(c.clause, { text: c.summary, spans: ids });
      else drop(`clause ${c.clause}: ${c.quote}`);
    }
    for (const f of answer.findings) {
      ai.proposed++;
      if (f.section === 'contradiction' && f.quotes.length >= 2) {
        answer.contradictions.push({ quoteA: f.quotes[0], quoteB: f.quotes[1], explanation: f.detail });
        ai.proposed--;
        continue;
      }
      const section = SECTION_SET.has(f.section) && f.section !== 'contradiction' && f.section !== 'concern' ? (f.section as Section) : null;
      if (!section) { drop(`unknown section "${f.section}": ${f.title}`); continue; }
      const severity = SEVERITIES.includes(f.severity as Severity) ? (f.severity as Severity) : undefined;
      const base = { section, layer: 'ai' as const, title: f.title, detail: f.detail, requiresHumanReview: true, ...(severity ? { severity } : {}), ...(f.reasoning ? { reasoning: f.reasoning } : {}), ...(f.party ? { party: f.party } : {}) };
      if (!f.quotes.length) {
        if (section === 'missing') findings.push({ ...base, spans: [], absence: { searched: 'AI reading of the whole document (not verifiable by quotation)', textSha256: doc.textSha256 } });
        else drop(`no quotation: ${f.title}`);
        continue;
      }
      const ids = cite(f.quotes);
      if (ids) findings.push({ ...base, spans: ids });
      else drop(`${f.title}: ${f.quotes.join(' / ')}`);
    }
    for (const c of answer.contradictions) {
      ai.proposed++;
      const a = cite([c.quoteA]), b = cite([c.quoteB]);
      if (!a || !b) { drop(`contradiction: ${c.quoteA} / ${c.quoteB}`); continue; }
      // A quotation inside a passage the rules already read as an engine fact is that fact, so the engine can
      // deduplicate the pair or veto it.
      const asFact = (id: string) => {
        const q = table.spans.find((x) => x.id === id)!;
        return det.facts.find((f) => { const fs = table.spans.find((x) => x.id === f.id); return fs && fs.start <= q.start && fs.end >= q.end; })?.id ?? id;
      };
      a[0] = asFact(a[0]);
      b[0] = asFact(b[0]);
      if (a[0] === b[0]) { drop(`contradiction within one passage: ${c.quoteA}`); continue; }
      aiPairs.push({ class: 'POTENTIAL_CONFLICT', facts: [a[0], b[0]], rationale: c.explanation || 'proposed by the AI layer' });
      aiPairNotes.set([a[0], b[0]].sort().join('|'), c.explanation);
      for (const id of [a[0], b[0]]) if (!det.facts.some((f) => f.id === id) && !placeholderFacts.some((f) => f.id === id)) placeholderFacts.push({ id, entity: 'agreement', concept: `ai_statement_${id}`, value: null });
    }
    aiFinal = answer.finalStatement;
    if (aiFinal) ai.proposed++;
  }

  /* ---------------------------------------------------- contradiction engine */
  const source: CandidateSource = { id: `deep-analysis-ai:${provider.id}`, configured: aiPairs.length > 0, propose: async () => aiPairs };
  const layered = await combineLayers([...det.facts, ...placeholderFacts], source);
  const spanById = new Map(table.spans.map((s) => [s.id, s]));
  const quoteOf = (id: string) => spanById.get(id)?.quote ?? id;
  const short = (s: string) => (s.length > 90 ? s.slice(0, 87) + '…' : s);
  for (const f of layered.deterministic) {
    if (f.class === 'MISSING_EVIDENCE') continue;
    const concept = det.facts.find((x) => x.id === f.facts[0])?.concept ?? '';
    findings.push({ section: 'contradiction', layer: 'deterministic', title: `${f.class === 'CONFIRMED_CONFLICT' ? 'Conflict' : 'Possible conflict'}: ${concept.replace(/_/g, ' ')}`, detail: `“${short(quoteOf(f.facts[0]))}” against “${short(quoteOf(f.facts[1]))}”.`, contradictionClass: f.class, rule: f.rule, severity: f.class === 'CONFIRMED_CONFLICT' ? 'high' : 'medium', reasoning: 'Two passages of the same document state different values for the same term; which one applies is unclear.', spans: [...f.facts], requiresHumanReview: true });
  }
  for (const c of layered.candidates) {
    findings.push({ section: 'contradiction', layer: 'ai', title: 'Possible internal inconsistency', detail: aiPairNotes.get([...c.facts].sort().join('|')) || c.rationale, contradictionClass: c.class, rule: 'AI candidate, capped at POTENTIAL_CONFLICT; not vetoed by the deterministic layer', severity: 'medium', spans: [...c.facts], requiresHumanReview: true });
  }
  ai.vetoed = layered.vetoed.length;

  /* ------------------------------------------------------ number findings */
  const order = (f: Omit<Finding, 'id'>) => SECTIONS.indexOf(f.section) * 10 + sevRank[f.severity ?? 'info'];
  const numbered: Finding[] = findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => order(a.f) - order(b.f) || a.i - b.i)
    .map(({ f }, i) => ({ id: `F${i + 1}`, ...f }));

  /* ------------------------------------------------------ final statement */
  let finalStatement: Report['finalStatement'];
  const risks = numbered.filter((f) => (f.section === 'risk' || f.section === 'unusual' || f.section === 'contradiction' || f.section === 'missing') && f.severity);
  const high = risks.filter((f) => f.severity === 'high');
  const medium = risks.filter((f) => f.severity === 'medium');
  const limitations = [
    DISCLAIMER,
    'A preview: no confidential client documents. Nothing is stored; the analysis runs in memory and is discarded.',
    doc.format === 'pdf' ? 'PDF text comes from the text layer only; tables, images and scanned pages are not read.' : null,
    ai.status === 'used' ? 'AI findings are proposals: their quotations are verified to exist verbatim, but their reading of what the passages mean is not. They need human review.' : 'Without the AI layer the analysis is pattern-based: it finds standard wording and misses terms phrased differently. Clause summaries, open questions and a reasoned assessment need the AI layer.',
    doc.extraction === 'browser' ? 'This large file was read in your browser and only its text was sent; the file size and file hash are as your browser reported them.' : null,
    ai.truncated ? 'The AI layer read only the first part of this long document.' : null,
    'Absence findings mean no passage matched; the term may exist under other wording or in another document.',
  ].filter(Boolean) as string[];

  if (aiFinal && aiFinal.overall) {
    const cite = (qs: string[]) => qs.map((q) => locateQuote(text, q)).filter(Boolean).map((at) => table.add(at!.start, at!.end).id);
    const concernIds: string[] = [];
    for (const k of aiFinal.keyConcerns) {
      const ids = k.quotes.map((q) => locateQuote(text, q));
      if (!k.quotes.length || ids.some((x) => !x)) { ai.dropped++; continue; }
      const id = `F${numbered.length + 1}`;
      numbered.push({ id, section: 'concern', layer: 'ai', title: k.title, detail: k.detail, ...(SEVERITIES.includes(k.severity as Severity) ? { severity: k.severity as Severity } : {}), spans: [...new Set(ids.map((at) => table.add(at!.start, at!.end).id))], requiresHumanReview: true });
      concernIds.push(id);
    }
    const rating = (['acceptable', 'acceptable_with_changes', 'significant_concerns', 'insufficient_information'] as const).find((r) => r === aiFinal!.rating) ?? 'insufficient_information';
    const confidence = (['high', 'moderate', 'low'] as const).find((c) => c === aiFinal!.confidence) ?? 'low';
    finalStatement = {
      overall: aiFinal.overall,
      overallSpans: [...new Set(cite(aiFinal.overallQuotes))],
      rating,
      keyConcerns: concernIds,
      recommendedActions: aiFinal.recommendedActions.map((a) => ({ text: a.text, spans: [...new Set(cite(a.quotes))] })),
      // An AI statement is never rated above moderate confidence: no lawyer has reviewed it.
      confidence: confidence === 'high' ? 'moderate' : confidence,
      confidenceReason: `${aiFinal.confidenceReason}${confidence === 'high' ? ' (Capped at moderate: no human or lawyer has reviewed this statement.)' : ''}`,
      limitations,
      layer: 'ai',
    };
  } else {
    const missing = numbered.filter((f) => f.section === 'missing');
    const rating = high.length ? 'significant_concerns' : medium.length || missing.length ? 'acceptable_with_changes' : raw.length < 3 ? 'insufficient_information' : 'acceptable';
    const kind = det.type?.value.toLowerCase() ?? 'document';
    finalStatement = {
      overall: [
        `Rule-based reading of a ${kind} of ${raw.length} clause${raw.length === 1 ? '' : 's'}${det.parties.length ? ` between ${det.parties.map((p) => `${p.name} (${p.role})`).join(' and ')}` : ''}.`,
        `The rules flag ${high.length} high and ${medium.length} medium item${medium.length === 1 ? '' : 's'}, ${numbered.filter((f) => f.section === 'contradiction').length} internal inconsistenc${numbered.filter((f) => f.section === 'contradiction').length === 1 ? 'y' : 'ies'} and ${missing.length} standard term${missing.length === 1 ? '' : 's'} not found.`,
        high.length ? `The most serious: ${high.slice(0, 3).map((f) => f.title.toLowerCase()).join('; ')}.` : 'No high-rated pattern was found.',
        'This is a checklist reading, not a judgement of the bargain: it cannot weigh commercial context.',
      ].join(' '),
      overallSpans: det.type ? [det.type.span.id] : [],
      rating,
      keyConcerns: [...high, ...medium].slice(0, 6).map((f) => f.id),
      recommendedActions: [...high, ...medium].slice(0, 6).map((f) => ({ text: `Review ${f.title.toLowerCase()}${f.spans.length ? '' : ''} and agree the wording with the other party.`, spans: f.spans })),
      confidence: 'low',
      confidenceReason: 'Deterministic patterns only; no AI reading and no human review.',
      limitations,
      layer: 'deterministic',
    };
  }

  /* -------------------------------------------------------------- assemble */
  const clauses: Report['clauses'] = raw.map((c) => ({
    id: c.id, number: c.number, heading: c.heading, start: c.start, end: c.end, sha256: c.sha256,
    topics: (det.clauseTopics.get(c.id) ?? []).map((t) => TOPICS[t].label),
    keyTerms: det.clauseTerms.get(c.id) ?? [],
    summary: clauseSummaries.get(c.id) ?? null,
  }));
  const fact = (f: { value: string; span: { id: string } }) => ({ value: f.value, spans: [f.span.id], layer: 'deterministic' as const });
  const parties: Report['overview']['parties'] = det.parties.map((p) => ({ name: p.name, role: p.role, spans: [p.span.id], layer: 'deterministic' }));
  for (const p of aiParties) if (!parties.some((q) => q.name.toLowerCase() === p.name.toLowerCase() || (p.role && q.role?.toLowerCase() === p.role.toLowerCase()))) parties.push(p);

  const unsealed: UnsealedReport = {
    schema: REPORT_SCHEMA,
    disclaimer: DISCLAIMER,
    generatedAt: (opts.now ?? (() => new Date()))().toISOString(),
    document: { filename: doc.filename, format: doc.format, bytes: doc.bytes, bytesSha256: doc.bytesSha256, textSha256: doc.textSha256, chars: text.length, pages: doc.pages, sample: !!opts.sample, ...(doc.extraction === 'browser' ? { extraction: 'browser' as const } : {}) },
    text,
    engine: { version: ENGINE_VERSION, ai },
    overview: {
      title: det.title,
      type: det.type ? fact(det.type) : aiType,
      parties,
      dates: det.dates.map(fact),
      amounts: det.amounts.map(fact),
      durations: det.durations.map(fact),
      governingLaw: det.governingLaw ? fact(det.governingLaw) : null,
    },
    clauses,
    spans: table.spans,
    findings: numbered,
    finalStatement,
  };
  return seal(unsealed);
}

export function reportDigest(r: UnsealedReport): string {
  return sha256Hex(canonicalJson(r));
}

export function seal(r: UnsealedReport): Report {
  return ReportSchema.parse({ ...r, seal: { algorithm: 'SHA-256', canonicalization: CANONICALIZATION, reportSha256: reportDigest(r) } });
}
