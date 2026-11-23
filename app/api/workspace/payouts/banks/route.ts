import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getBachsBanks, resolveBachsBankAccount } from '@/lib/payments/bachs-payouts';

export const runtime = 'nodejs';
const bankCountries = new Set(['NG','GH','KE','TZ','UG']);

export async function GET(request: Request) {
  try {
    await requireCreator();
    const country = new URL(request.url).searchParams.get('country_code')?.toUpperCase() ?? 'NG';
    if (!bankCountries.has(country)) return NextResponse.json({ error: 'Choose a supported bank country.' }, { status: 400 });
    const result = await getBachsBanks(country);
    return NextResponse.json({ country, banks: result.banks ?? [] }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Nigerian bank directory unavailable');
    return NextResponse.json({ error: 'The bank list is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    await requireCreator();
    const parsed = z.object({ bankCode: z.string().trim().min(2).max(20), accountNumber: z.string().regex(/^\d{10}$/) }).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Choose a bank and enter its 10-digit account number.' }, { status: 400 });
    const result = await resolveBachsBankAccount({ accountNumber: parsed.data.accountNumber, bankCode: parsed.data.bankCode, country: 'NG' });
    if (!result.resolved || !result.account_name) return NextResponse.json({ error: result.message || 'We could not verify those account details.' }, { status: 422 });
    return NextResponse.json({ accountName: result.account_name, accountNumber: result.account_number }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Bank account verification failed', { errorType: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ error: 'Could not verify this bank account right now.' }, { status: 503 });
  }
}
