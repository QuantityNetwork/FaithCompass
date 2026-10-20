import { NextResponse } from 'next/server';
import { publicKeysDocument } from '@/lib/decision/signing';

export const dynamic = 'force-dynamic';

/** Public keys that verify Decision Passport signatures. Empty while passports are unsigned. Never contains a private key. */
export function GET() {
  return NextResponse.json(publicKeysDocument(), {
    headers: { 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*' },
  });
}
