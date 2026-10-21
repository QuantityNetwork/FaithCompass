import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DeepAiProvider } from '@/lib/deep-analysis/ai';
import { aiAccess, aiAccessMode, aiDailyLimit, aiUserDailyLimit, resetAiLimits } from '@/lib/deep-analysis/access';
import { setWorkspaceVerifier } from '@/lib/workspace/access';
import { analyzeDocument } from '@/lib/deep-analysis/analyze';
import { buildDeepBundle, verifyBundle } from '@/lib/deep-analysis/bundle';
import { ParseError, parseDocument, MAX_UPLOAD_BYTES } from '@/lib/deep-analysis/parse';
import { SAMPLE_FILES } from '@/lib/deep-analysis/samples';
import { DISCLAIMER, ReportSchema } from '@/lib/deep-analysis/schema';
import { locateQuote, verifySpan } from '@/lib/deep-analysis/spans';
import { sha256Hex } from '@/lib/deep-analysis/parse';

const fx = (f: string) => new Uint8Array(readFileSync(`tests/fixtures/deep-analysis/${f}`));
const sample = (id: string) => {
  const s = SAMPLE_FILES.find((x) => x.id === id)!;
  return parseDocument(s.file, new Uint8Array(readFileSync(`public/deep-analysis/samples/${s.file}`)));
};
const fakeAi = (answer: unknown): DeepAiProvider => ({ id: 'fake', model: 'fake-1', configured: true, complete: async () => ({ text: JSON.stringify(answer), usage: { inputTokens: 10, outputTokens: 10, usd: 0 }, finishReason: 'stop', model: 'fake-1' }) });

describe('parsing', () => {
  it('reads Markdown and normalises the text', async () => {
    const d = await parseDocument('a.md', new TextEncoder().encode('Title\r\n\r\n\r\n\r\nThe Supplier shall deliver\u00a0goods.   \r\nMore text here to pass the minimum.'));
    expect(d.format).toBe('md');
    expect(d.text).toBe('Title\n\nThe Supplier shall deliver goods.\nMore text here to pass the minimum.');
    expect(d.textSha256).toBe(sha256Hex(d.text));
  });
  it('reads a DOCX', async () => {
    const d = await parseDocument('fixture.docx', fx('fixture.docx'));
    expect(d.format).toBe('docx');
    expect(d.text).toContain('within 30 days of the date of the invoice');
  });
  it('reads the text layer of a PDF', async () => {
    const d = await parseDocument('fixture.pdf', fx('fixture.pdf'));
    expect(d.format).toBe('pdf');
    expect(d.pages).toBe(1);
    expect(d.text).toContain('unlimited liability');
  });
  it('refuses a scanned PDF honestly', async () => {
    await expect(parseDocument('scan.pdf', fx('scanned.pdf'))).rejects.toMatchObject({ code: 'SCANNED_PDF' });
  });
  it('refuses unsupported, mislabelled, binary and oversized files', async () => {
    await expect(parseDocument('x.exe', new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(ParseError);
    await expect(parseDocument('x.txt', fx('fixture.pdf'))).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
    await expect(parseDocument('x.txt', new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0x02]))).rejects.toMatchObject({ code: 'UNREADABLE' });
    await expect(parseDocument('x.txt', new Uint8Array(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });
});

describe('span verification', () => {
  const text = 'The Customer shall pay each invoice\nwithin 30 days of the date of the invoice.';
  it('finds verbatim quotations, allowing only whitespace differences', () => {
    expect(locateQuote(text, 'shall pay each invoice')).toEqual({ start: 13, end: 35 });
    const at = locateQuote(text, 'each invoice within 30 days')!;
    expect(text.slice(at.start, at.end)).toBe('each invoice\nwithin 30 days');
  });
  it('rejects paraphrases, ellipses, changed numbers and too-short quotes', () => {
    expect(locateQuote(text, 'shall pay every invoice')).toBeNull();
    expect(locateQuote(text, 'The Customer shall pay... the invoice.')).toBeNull();
    expect(locateQuote(text, 'within 45 days of the date')).toBeNull();
    expect(locateQuote(text, 'invoice')).toBeNull();
  });
  it('detects a tampered span', () => {
    const s = { start: 13, end: 35, quote: 'shall pay each invoice', sha256: sha256Hex('shall pay each invoice') };
    expect(verifySpan(text, s)).toBe(true);
    expect(verifySpan(text, { ...s, quote: 'shall pay each invoicf' })).toBe(false);
    expect(verifySpan(text, { ...s, start: 12 })).toBe(false);
  });
});

describe('deterministic pipeline', () => {
  it('produces a valid, sealed report in which every cited span verifies', async () => {
    const r = await analyzeDocument(await sample('sample-service-agreement'), { sample: true });
    expect(ReportSchema.safeParse(r).success).toBe(true);
    expect(r.disclaimer).toBe(DISCLAIMER);
    expect(r.engine.ai.status).toBe('not_configured');
    expect(r.engine.ai.note).toMatch(/AI layer not configured on this deployment/);
    expect(r.findings.every((f) => f.layer === 'deterministic')).toBe(true);
    expect(r.findings.every((f) => f.spans.length > 0 || f.absence)).toBe(true);
    expect(verifyBundle(buildDeepBundle(r))).toMatchObject({ ok: true });
    expect(r.overview.parties.map((p) => p.role)).toEqual(['Provider', 'Customer']);
    expect(r.overview.governingLaw?.value).toBe('Sweden');
    expect(r.finalStatement.layer).toBe('deterministic');
    expect(r.finalStatement.confidence).toBe('low');
  });
  it('finds the planted contradictions with the contradiction engine', async () => {
    const svc = await analyzeDocument(await sample('sample-service-agreement'));
    expect(svc.findings.some((f) => f.section === 'contradiction' && f.title.includes('payment term') && f.contradictionClass === 'CONFIRMED_CONFLICT')).toBe(true);
    const nda = await analyzeDocument(await sample('sample-nda'));
    expect(nda.findings.some((f) => f.section === 'contradiction' && f.title.includes('governing law'))).toBe(true);
    const sup = await analyzeDocument(await sample('sample-supplier-contract'));
    expect(sup.findings.some((f) => f.section === 'contradiction' && f.title.includes('liability cap'))).toBe(true);
    expect(sup.findings.some((f) => f.title === 'Assignment of pre-existing IP' && f.severity === 'high')).toBe(true);
  });
  it('detects tampering with a sealed report', async () => {
    const r = await analyzeDocument(await sample('sample-nda'));
    const b = buildDeepBundle(r);
    const changed = { ...b, report: { ...b.report, finalStatement: { ...b.report.finalStatement, rating: 'acceptable' as const } } };
    expect(verifyBundle(changed).ok).toBe(false);
    const moved = { ...b, report: { ...b.report, spans: b.report.spans.map((s, i) => (i === 0 ? { ...s, start: s.start + 1 } : s)) } };
    expect(verifyBundle(moved).problems.join()).toMatch(/span S1/);
  });
});

describe('AI layer verification', () => {
  it('keeps findings whose quotations exist verbatim, drops the rest, and marks AI findings', async () => {
    const doc = await sample('sample-service-agreement');
    const r = await analyzeDocument(doc, {
      provider: fakeAi({
        findings: [
          { section: 'risk', title: 'Real', detail: 'd', severity: 'high', reasoning: 'r', quotes: ['The Provider may amend the scope of the Services at any time'] },
          { section: 'risk', title: 'Invented', detail: 'd', severity: 'high', quotes: ['The Provider may terminate at will without any notice'] },
          { section: 'risk', title: 'Elided', detail: 'd', severity: 'high', quotes: ['The Customer shall pay ... EUR 18,500'] },
          { section: 'missing', title: 'No service credits', detail: 'd', quotes: [] },
          { section: 'bogus', title: 'Unknown section', detail: 'd', quotes: ['The Provider may amend the scope'] },
        ],
        contradictions: [{ quote_a: 'payable within 45 days of receipt', quote_b: 'within 30 days of the date of the invoice', explanation: 'two payment terms' }],
        final_statement: { overall: 'Concerns.', overall_quotes: ['sole discretion'], rating: 'significant_concerns', key_concerns: [{ title: 'Scope changes', detail: 'd', severity: 'high', quotes: ['in its sole discretion'] }, { title: 'Fake', detail: 'd', quotes: ['not in the text at all'] }], recommended_actions: [{ text: 'Negotiate', quotes: [] }], confidence: 'high', confidence_reason: 'clear text' },
      }),
    });
    const ai = r.findings.filter((f) => f.layer === 'ai');
    expect(ai.map((f) => f.title)).toEqual(expect.arrayContaining(['Real', 'No service credits', 'Scope changes']));
    expect(ai.some((f) => f.title === 'Invented' || f.title === 'Elided' || f.title === 'Fake' || f.title === 'Unknown section')).toBe(false);
    expect(ai.every((f) => f.requiresHumanReview)).toBe(true);
    expect(r.engine.ai.dropped).toBeGreaterThanOrEqual(4);
    expect(r.finalStatement.layer).toBe('ai');
    expect(r.finalStatement.confidence).toBe('moderate');
    // The AI pair is the same pair the deterministic layer flagged: one finding, the deterministic one.
    expect(r.findings.filter((f) => f.section === 'contradiction')).toHaveLength(1);
    expect(r.findings.find((f) => f.section === 'contradiction')!.layer).toBe('deterministic');
    expect(verifyBundle(buildDeepBundle(r)).ok).toBe(true);
  });
  it('falls back to the rules when the AI answer is not JSON or the provider fails', async () => {
    const doc = await sample('sample-nda');
    const bad: DeepAiProvider = { ...fakeAi({}), complete: async () => ({ text: '{"findings": [', usage: null, finishReason: 'length', model: 'fake-1' }) };
    const r1 = await analyzeDocument(doc, { provider: bad });
    expect(r1.engine.ai.status).toBe('failed');
    expect(r1.engine.ai.note).toMatch(/output limit/);
    const down: DeepAiProvider = { ...fakeAi({}), complete: async () => { throw new Error('down'); } };
    expect((await analyzeDocument(doc, { provider: down })).engine.ai.status).toBe('failed');
  });
  it('does not call the provider when access is refused', async () => {
    let called = false;
    const p: DeepAiProvider = { ...fakeAi({}), complete: async () => { called = true; throw new Error('x'); } };
    const r = await analyzeDocument(await sample('sample-nda'), { provider: p, aiBlockedReason: 'not approved' });
    expect(called).toBe(false);
    expect(r.engine.ai.status).toBe('not_permitted');
  });
});

describe('large files (read in the browser, text only)', () => {
  it('the server refuses raw files over 3 MB and accepts their extracted text, re-normalised and hashed server-side', async () => {
    const { documentFromText, MAX_FILE_BYTES } = await import('@/lib/deep-analysis/parse');
    expect(MAX_FILE_BYTES).toBe(15 * 1024 * 1024);
    await expect(parseDocument('big.pdf', new Uint8Array(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({ code: 'TOO_LARGE', status: 413 });
    const text = readFileSync('public/deep-analysis/samples/sample-nda.md', 'utf8');
    const doc = documentFromText({ filename: 'big.pdf', format: 'pdf', text: text.replace(/\n/g, '\r\n') + '\u200b', pages: 8, bytes: 14_000_000, bytesSha256: 'a'.repeat(64) });
    expect(doc.extraction).toBe('browser');
    expect(doc.text).toBe((await sample('sample-nda')).text);
    expect(doc.textSha256).toBe(sha256Hex(doc.text));
    const r = await analyzeDocument(doc, {});
    expect(r.document.extraction).toBe('browser');
    expect(ReportSchema.parse(r).document.bytes).toBe(14_000_000);
    expect(() => documentFromText({ filename: 'e.pdf', format: 'pdf', text: '   ', pages: 1, bytes: 10, bytesSha256: 'a'.repeat(64) })).toThrow(ParseError);
  });
  it('the route accepts an extracted-text body without the file', async () => {
    const route = await import('@/app/api/deep-analysis/route');
    const text = readFileSync('public/deep-analysis/samples/sample-supplier-contract.md', 'utf8');
    const res = await route.POST(new Request('https://abrahammoses.test/api/deep-analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: 'large.pdf', useAi: false, extracted: { format: 'pdf', text, pages: 8, bytes: 14_474_000, bytesSha256: 'b'.repeat(64) } }) }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.report.document).toMatchObject({ filename: 'large.pdf', format: 'pdf', bytes: 14_474_000, extraction: 'browser' });
    expect(j.stored).toBe(false);
  });
});

describe('OpenAI provider requests', () => {
  it('defaults to gpt-5.6-terra through the Responses API with medium reasoning effort and a JSON answer', async () => {
    const { openAiProvider, openAiRequest, readOpenAiAnswer, DEFAULT_MODEL, AI_MAX_OUTPUT_TOKENS, reasoningEffort } = await import('@/lib/deep-analysis/ai');
    expect(DEFAULT_MODEL).toBe('gpt-5.6-terra');
    expect(openAiProvider({ OPENAI_API_KEY: 'x' }).model).toBe('gpt-5.6-terra');
    expect(openAiProvider({ OPENAI_API_KEY: 'x', DEEP_ANALYSIS_MODEL: 'gpt-5.6-luna' }).model).toBe('gpt-5.6-luna');
    expect(openAiProvider({ OPENAI_API_KEY: 'x', DEEP_ANALYSIS_MODEL: 'gpt-4.1' }).model).toBe('gpt-4.1');
    expect(reasoningEffort({})).toBe('medium');
    expect(reasoningEffort({ DEEP_ANALYSIS_REASONING_EFFORT: 'xhigh' })).toBe('xhigh');
    expect(reasoningEffort({ DEEP_ANALYSIS_REASONING_EFFORT: 'bogus' })).toBe('medium');
    const r = openAiRequest('gpt-5.6-sol', 'Analyse … JSON', 'high');
    expect(r.url).toBe('https://api.openai.com/v1/responses');
    expect(r.body).toMatchObject({ model: 'gpt-5.6-sol', store: false, reasoning: { effort: 'high' }, max_output_tokens: AI_MAX_OUTPUT_TOKENS, text: { format: { type: 'json_object' } } });
    expect(openAiRequest('gpt-4.1', 'p', 'high').url).toBe('https://api.openai.com/v1/chat/completions');
    const done = readOpenAiAnswer('gpt-5.6-sol', { model: 'gpt-5.6-sol', status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }], usage: { input_tokens: 1000, output_tokens: 2000, output_tokens_details: { reasoning_tokens: 1500 } } });
    expect(done).toMatchObject({ text: '{"a":1}', finishReason: 'stop', usage: { inputTokens: 1000, outputTokens: 2000, reasoningTokens: 1500 } });
    expect(done.usage!.usd).toBeCloseTo((1000 * 4 + 2000 * 20) / 1e6);
    expect(readOpenAiAnswer('gpt-5.6-sol', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }).finishReason).toBe('length');
  });
  it('puts the word JSON in the input, as json_object mode requires', async () => {
    const { aiPrompt } = await import('@/lib/deep-analysis/ai');
    expect(aiPrompt('Some text.', []).prompt).toMatch(/JSON/);
  });
});

describe('AI access policy', () => {
  beforeEach(() => resetAiLimits());
  const req = (auth?: string) => new Request('https://x.test/api/deep-analysis', { method: 'POST', headers: auth ? { authorization: auth } : {} });
  const tok = `Bearer ${'t'.repeat(40)}`;
  const prod = { VERCEL_ENV: 'production', DEEP_ANALYSIS_AI_ACCESS: 'signed-in' };
  const saved = { ...process.env };
  afterEach(() => {
    setWorkspaceVerifier(null);
    process.env = { ...saved };
  });
  const firebase = () => {
    process.env.AUTH_PROVIDER = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'abrahammoses-a0a26';
  };
  it('requires sign-in on production, even with the preview switch set (401 without a token)', async () => {
    expect(aiAccessMode({ VERCEL_ENV: 'production', DEEP_ANALYSIS_AI_ACCESS: 'deployment-protected' })).toBe('signed-in');
    expect(aiAccessMode({ VERCEL_ENV: 'preview' })).toBe('signed-in');
    expect(await aiAccess(req(), 'c', prod)).toMatchObject({ ok: false, status: 401, code: 'SIGN_IN_REQUIRED' });
  });
  it('refuses invalid or anonymous tokens with 401 and unverified email with 403', async () => {
    firebase();
    setWorkspaceVerifier(async () => null); // the verifier returns null for anonymous sign-ins and bad tokens
    expect(await aiAccess(req(tok), 'c', prod)).toMatchObject({ ok: false, status: 401, code: 'INVALID_TOKEN' });
    setWorkspaceVerifier(async () => ({ id: 'u1', email: 'new@example.invalid', tenants: {}, emailVerified: false }));
    expect(await aiAccess(req(tok), 'c', prod)).toMatchObject({ ok: false, status: 403, code: 'EMAIL_NOT_VERIFIED' });
  });
  it('allows any verified signed-in user, within the per-user and global daily limits', async () => {
    firebase();
    let uid = 'u1';
    setWorkspaceVerifier(async () => ({ id: uid, email: `${uid}@example.invalid`, tenants: {}, emailVerified: true }));
    const env = { ...prod, DEEP_ANALYSIS_AI_USER_DAILY_LIMIT: '2', DEEP_ANALYSIS_AI_DAILY_LIMIT: '3' };
    expect(await aiAccess(req(tok), 'a', env)).toEqual({ ok: true, uid: 'u1' });
    expect(await aiAccess(req(tok), 'b', env)).toEqual({ ok: true, uid: 'u1' });
    expect(await aiAccess(req(tok), 'c', env)).toMatchObject({ ok: false, code: 'USER_DAILY_LIMIT' });
    uid = 'u2';
    expect(await aiAccess(req(tok), 'd', env)).toEqual({ ok: true, uid: 'u2' });
    expect(await aiAccess(req(tok), 'e', env)).toMatchObject({ ok: false, code: 'DAILY_LIMIT' });
    expect(aiDailyLimit({})).toBe(300);
    expect(aiUserDailyLimit({})).toBe(10);
  });
  it('allows a protected preview, within the daily and per-client limits', async () => {
    const env = { VERCEL_ENV: 'preview', DEEP_ANALYSIS_AI_ACCESS: 'deployment-protected', DEEP_ANALYSIS_AI_DAILY_LIMIT: '8' };
    for (let i = 0; i < 6; i++) expect((await aiAccess(req(), 'a', env)).ok).toBe(true);
    expect(await aiAccess(req(), 'a', env)).toMatchObject({ ok: false, code: 'CLIENT_LIMIT' });
    expect((await aiAccess(req(), 'b', env)).ok).toBe(true);
    expect((await aiAccess(req(), 'b', env)).ok).toBe(true);
    expect(await aiAccess(req(), 'c', env)).toMatchObject({ ok: false, code: 'DAILY_LIMIT' });
  });
});

describe('recorded sample reports', () => {
  for (const s of SAMPLE_FILES) {
    it(`${s.id}: schema-valid, sealed, every span verifies, produced from the committed sample text`, async () => {
      const r = JSON.parse(readFileSync(`public/deep-analysis/samples/${s.id}.report.json`, 'utf8'));
      const check = verifyBundle(buildDeepBundle(ReportSchema.parse(r)));
      expect(check.problems).toEqual([]);
      expect(r.document.sample).toBe(true);
      expect(r.engine.ai.status).toBe('used');
      expect(r.document.textSha256).toBe((await sample(s.id)).textSha256);
    });
  }
});
