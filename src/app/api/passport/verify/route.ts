import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logServerError } from '@/lib/security/audit-log';
import { guardWrite } from '@/lib/security/write-guard';
import { verifyPassportInput } from '@/lib/passport/verify-service';

export const dynamic = 'force-dynamic';
const noStore = { 'cache-control': 'no-store' };

const Body = z
  .object({
    bundle: z.unknown().optional(),
    id: z.string().min(8).max(8192).optional(),
    sha256: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    deepAnalysis: z.unknown().optional(),
  })
  .strict()
  .refine((b) => b.bundle !== undefined || b.id !== undefined || b.sha256 !== undefined, 'give a bundle, an id or a sha256');

/**
 * Verify a Decision Passport: a bundle (every hash recomputed, signature checked against the pinned keys), or an ID or
 * hash looked up in the public registry, plus revocation. Nothing is stored. Public, rate-limited.
 */
export async function POST(request: Request) {
  const gate = await guardWrite(request, { permission: 'record.read', action: 'passport.verify', maxBytes: 4_400_000, perMinute: 20, perDay: 5000 });
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(gate.body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request: give a bundle, an id or a sha256.', code: 'INVALID_REQUEST' }, { status: 400, headers: noStore });
  try {
    return NextResponse.json(await verifyPassportInput(parsed.data), { headers: noStore });
  } catch (e) {
    logServerError('passport_verify', e);
    return NextResponse.json({ error: 'Verification failed unexpectedly.', code: 'FAILED' }, { status: 500, headers: noStore });
  }
}
