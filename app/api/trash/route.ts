import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthed } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = supabaseAdmin();

  // Hard-delete anything trashed more than 7 days ago (and remove its photo).
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: expired } = await sb.from('contacts').select('id, photo_path').lt('deleted_at', cutoff);
  if (expired && expired.length) {
    const paths = expired.map(r => r.photo_path).filter(Boolean) as string[];
    if (paths.length) await sb.storage.from('badges').remove(paths);
    await sb.from('contacts').delete().in('id', expired.map(r => r.id));
  }

  const { data, error } = await sb.from('contacts')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
