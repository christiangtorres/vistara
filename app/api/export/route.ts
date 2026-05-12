import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthed } from '@/lib/auth';

export const runtime = 'nodejs';

function csvCell(v: any) {
  const s = (v ?? '').toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('contacts').select('*').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const cols = ['id','created_at','name','company','title','email','phone','company_guess','notes','owner'];
  const lines = [cols.join(',')];
  for (const r of data || []) lines.push(cols.map(c => csvCell((r as any)[c])).join(','));
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="vistara_contacts.csv"',
    },
  });
}
