import { freshAuthHeader } from '@/lib/firebase/client';

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const auth = await freshAuthHeader();
  if (!auth) throw new Error('Sign in first.');
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: { ...auth, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status}).`);
  return data as T;
}

export interface DraftSummary {
  id: string;
  title: string;
  reportSha256: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'issued' | 'revoked';
  createdBy: string;
  createdByEmail: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  issuedAt: string | null;
  passportSha256: string | null;
  kid: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  supersedes: string | null;
  policyVersion: string;
}
