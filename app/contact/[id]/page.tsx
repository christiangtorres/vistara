import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import ContactView from './ContactView';

export const dynamic = 'force-dynamic';

export default async function ContactPage({ params }: { params: { id: string } }) {
  const sb = supabaseAdmin();
  const { data: c } = await sb.from('contacts').select('*').eq('id', Number(params.id)).single();
  if (!c) notFound();

  let photoUrl: string | null = null;
  if (c.photo_path) {
    const signed = await sb.storage.from('badges').createSignedUrl(c.photo_path, 60 * 10);
    photoUrl = signed.data?.signedUrl ?? null;
  }
  let audioUrl: string | null = null;
  if (c.audio_path) {
    const signed = await sb.storage.from('badges').createSignedUrl(c.audio_path, 60 * 10);
    audioUrl = signed.data?.signedUrl ?? null;
  }

  return (
    <>
      <header>
        <h1>Vistara</h1>
        <div className="who"><Link href="/">← Back to contacts</Link></div>
      </header>
      <div className="pane">
        <ContactView contact={c} photoUrl={photoUrl} audioUrl={audioUrl} />
      </div>
    </>
  );
}
