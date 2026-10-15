import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canPersist, getStore, setStore, SupabaseConfigError } from '@/lib/evidence/store';
import { MemoryEvidenceStore } from '@/lib/evidence/store/memory-store';
import { SupabaseEvidenceStore } from '@/lib/evidence/store/supabase-store';
import { JsonEvidenceStore } from '@/lib/evidence/store/json-store';

const KEYS = [
  'EVIDENCE_STORE',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  setStore(null);
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
  setStore(null);
});

describe('store selection', () => {
  it('uses Supabase automatically once it is configured', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    expect(getStore()).toBeInstanceOf(SupabaseEvidenceStore);
  });

  it('accepts the NEXT_PUBLIC url with a server-side service key', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    expect(getStore()).toBeInstanceOf(SupabaseEvidenceStore);
  });

  it('falls back to the file store only when Supabase is not configured', () => {
    expect(getStore()).toBeInstanceOf(JsonEvidenceStore);
  });

  it('honours an explicit request for the file store', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.EVIDENCE_STORE = 'json';
    expect(getStore()).toBeInstanceOf(JsonEvidenceStore);
  });

  it('serves demonstrations from memory when asked, and reports that nothing persists', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.EVIDENCE_STORE = 'memory';
    expect(getStore()).toBeInstanceOf(MemoryEvidenceStore);
    expect(canPersist()).toBe(false);

    const { POST: challenge } = await import('@/app/api/evidence/claims/[id]/challenge/route');
    const res = await challenge(new Request('http://localhost/api/evidence/claims/x/challenge', { method: 'POST' }), {
      params: Promise.resolve({ id: 'x' }),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/no database/);

    const { POST: analyze } = await import('@/app/api/evidence/analyze/route');
    const res2 = await analyze(new Request('http://localhost/api/evidence/analyze', { method: 'POST', body: '{"query":"Daniel 12:1"}' }));
    expect(res2.status).toBe(503);
  });

  it('persists with every other store', () => {
    expect(canPersist()).toBe(true);
  });

  it('raises rather than silently degrading when Supabase is asked for but unconfigured', () => {
    // The failure mode this prevents: a deployment that looks healthy until the
    // first cold start quietly loses everything written since the last one.
    process.env.EVIDENCE_STORE = 'supabase';
    expect(() => getStore()).toThrow(SupabaseConfigError);
    expect(() => getStore()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('names every missing variable, not just the first', () => {
    process.env.EVIDENCE_STORE = 'supabase';
    try {
      getStore();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('SUPABASE_URL');
      expect((err as Error).message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });
});
