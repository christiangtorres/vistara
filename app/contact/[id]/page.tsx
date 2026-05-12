import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';

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

  return (
    <>
      <header>
        <h1>Vistara</h1>
        <div className="who"><Link href="/">← Back to contacts</Link></div>
      </header>
      <div className="pane">
        <h2 style={{ margin: '0 0 4px' }}>{c.name || '(no name)'}</h2>
        <div className="company" style={{ color: '#8ab4ff', fontSize: 16, marginBottom: 14 }}>{c.company}</div>

        {photoUrl && <img className="preview" src={photoUrl} alt="badge" style={{ marginBottom: 18 }} />}

        <div className="contact" style={{ marginBottom: 14 }}>
          <Field label="Email" value={c.email} />
          <Field label="What this company does" value={c.company_guess} />
          <Field label="Your notes" value={c.notes} multi />
        </div>
      </div>
    </>
  );
}

function Field({ label, value, multi }: { label: string; value: string; multi?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#9aa0ad', fontSize: 13, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, whiteSpace: multi ? 'pre-wrap' : 'normal' }}>{value}</div>
    </div>
  );
}
