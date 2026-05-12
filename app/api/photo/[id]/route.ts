import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthed } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from('contacts')
    .select('photo_path')
    .eq('id', Number(params.id))
    .single();
  if (error || !row?.photo_path) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const signed = await sb.storage.from('badges').createSignedUrl(row.photo_path, 60 * 10);
  if (signed.error || !signed.data) return NextResponse.json({ error: signed.error?.message }, { status: 500 });
  return NextResponse.redirect(signed.data.signedUrl);
}
