import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { contacts, formSubmissions, forms } from '@/src/server/db/schema';

export const runtime = 'nodejs';
function csvCell(value: unknown) { return '"' + String(value ?? '').replaceAll('"', '""').replaceAll('\r', ' ').replaceAll('\n', ' ') + '"'; }

export async function GET(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { formId } = await params;
    const [form] = await getDatabase().select({ id: forms.id, title: forms.title, fields: forms.fields }).from(forms).where(and(eq(forms.id, formId), eq(forms.creatorId, creator.id))).limit(1);
    if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('q')?.trim().slice(0, 100);
    const cursor = url.searchParams.get('cursor');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limit = url.searchParams.get('format') === 'csv' ? 5000 : 26;
    const conditions = [eq(formSubmissions.creatorId, creator.id), eq(formSubmissions.formId, formId)];
    if (status && ['new','read','archived'].includes(status)) conditions.push(eq(formSubmissions.status, status));
    if (cursor) conditions.push(lt(formSubmissions.id, cursor));
    if (from && !Number.isNaN(Date.parse(from))) conditions.push(gte(formSubmissions.createdAt, new Date(from)));
    if (to && !Number.isNaN(Date.parse(to))) conditions.push(lte(formSubmissions.createdAt, new Date(to + 'T23:59:59.999Z')));
    if (search) conditions.push(sql`${formSubmissions.data}::text ILIKE ${'%' + search + '%'}`);
    const rows = await getDatabase().select({ id: formSubmissions.id, status: formSubmissions.status, data: formSubmissions.data, createdAt: formSubmissions.createdAt, contact: contacts }).from(formSubmissions).leftJoin(contacts, and(eq(formSubmissions.contactId, contacts.id), eq(contacts.creatorId, creator.id))).where(and(...conditions)).orderBy(desc(formSubmissions.id)).limit(limit);
    if (url.searchParams.get('format') === 'csv') {
      const fields = Array.isArray(form.fields) ? form.fields as { id: string; label: string }[] : [];
      const header = ['Submitted at','Status','Name','Email','Phone',...fields.map((field) => field.label)];
      const lines = [header.map(csvCell).join(',')];
      for (const row of rows) {
        const values = (row.data as { values?: Record<string, unknown> } | null)?.values ?? {};
        lines.push([row.createdAt.toISOString(),row.status,row.contact?.name,row.contact?.email,row.contact?.phoneE164,...fields.map((field) => { const value = values[field.id]; return Array.isArray(value) ? value.join('; ') : value; })].map(csvCell).join(','));
      }
      return new Response(lines.join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="onselli-form-submissions.csv"', 'Cache-Control': 'private, no-store' } });
    }
    const hasMore = rows.length > 25;
    return NextResponse.json({ form: { id: form.id, title: form.title, fields: form.fields }, rows: rows.slice(0,25), nextCursor: hasMore ? rows[24]?.id ?? null : null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Form submissions load failed', error);
    return NextResponse.json({ error: 'Submissions could not be loaded.' }, { status: 503 });
  }
}
