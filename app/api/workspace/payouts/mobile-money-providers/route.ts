import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getMobileMoneyProviders, mobileMoneyCountries } from '@/lib/payments/bachs-payouts';

export const runtime = 'nodejs';
const countrySchema = z.enum(mobileMoneyCountries);
export async function GET(request: Request) {
  try {
    await requireCreator();
    const parsed = countrySchema.safeParse(new URL(request.url).searchParams.get('country_code'));
    if (!parsed.success) return NextResponse.json({ error: 'Choose GH, KE, or TZ for mobile money.' }, { status: 400 });
    const result = await getMobileMoneyProviders(parsed.data);
    return NextResponse.json({ country: parsed.data, providers: (result.providers ?? []).map((provider) => ({ name: provider.name, country: provider.country ?? parsed.data })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Mobile money provider lookup failed', error);
    return NextResponse.json({ error: 'Mobile money providers are temporarily unavailable.' }, { status: 503 });
  }
}
