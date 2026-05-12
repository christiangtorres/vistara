import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthed, getOwner } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('contacts').select('*').order('id', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const row = {
    name: body.name || '',
    company: body.company || '',
    title: body.title || '',
    email: body.email || '',
    phone: body.phone || '',
    company_guess: body.company_guess || '',
    notes: body.notes || '',
    photo_path: body.photo_path || '',
    owner: getOwner(),
  };
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('contacts').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
