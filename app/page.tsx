'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Extracted = { name?: string; company?: string; email?: string; company_guess?: string; error?: string };
type Contact = { id: number; created_at: string; name: string; company: string; email: string; company_guess: string; notes: string; owner: string };

export default function Home() {
  const [tab, setTab] = useState<'scan' | 'list'>('scan');
  const [owner, setOwner] = useState('');
  const router = useRouter();

  useEffect(() => {
    const m = document.cookie.match(/vistara_owner=([^;]+)/);
    if (m) setOwner(decodeURIComponent(m[1]));
  }, []);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <>
      <header>
        <h1>Vistara</h1>
        <div className="who">Hi, {owner} · <a href="#" onClick={e => { e.preventDefault(); logout(); }}>Sign out</a></div>
      </header>
      <nav className="tabs">
        <button className={'tab' + (tab === 'scan' ? ' active' : '')} onClick={() => setTab('scan')}>Scan</button>
        <button className={'tab' + (tab === 'list' ? ' active' : '')} onClick={() => setTab('list')}>Contacts</button>
      </nav>
      <div className="pane">
        {tab === 'scan' ? <ScanTab /> : <ListTab />}
      </div>
    </>
  );
}

function ScanTab() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [statusErr, setStatusErr] = useState(false);
  const [photoPath, setPhotoPath] = useState('');
  const [form, setForm] = useState<Extracted & { notes: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setStatus('Reading badge with AI…'); setStatusErr(false);
    setForm(null);

    const fd = new FormData();
    fd.append('photo', file);
    try {
      const r = await fetch('/api/scan', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'scan failed');
      const x: Extracted = data.extracted || {};
      if (x.error) { setStatus('AI extract failed: ' + x.error + '. Fill in manually.'); setStatusErr(true); }
      else setStatus('Got it. Review and add your notes.');
      setPhotoPath(data.photo_path);
      setForm({ name: x.name || '', company: x.company || '', email: x.email || '', company_guess: x.company_guess || '', notes: '' });
    } catch (err: any) {
      setStatus(err.message); setStatusErr(true);
      setForm({ name: '', company: '', email: '', company_guess: '', notes: '' });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const r = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, photo_path: photoPath }),
    });
    setSaving(false);
    if (!r.ok) { const d = await r.json(); setStatus(d.error || 'save failed'); setStatusErr(true); return; }
    setStatus('Saved ✓'); setStatusErr(false);
    setForm(null); setPreviewUrl(null); setPhotoPath('');
  }

  const upd = (k: keyof (Extracted & { notes: string })) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => f ? { ...f, [k]: e.target.value } : f);

  return (
    <>
      <label className="capture-btn">
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
        <span>📷 Take badge photo</span>
      </label>
      {previewUrl && <img className="preview" src={previewUrl} alt="" />}
      {status && <div className={'status' + (statusErr ? ' err' : '')}>{status}</div>}

      {form && (
        <form onSubmit={save}>
          <label>Name<input value={form.name} onChange={upd('name')} /></label>
          <label>Company<input value={form.company} onChange={upd('company')} /></label>
          <label>Email<input type="email" value={form.email} onChange={upd('email')} /></label>
          <label>What this company does (AI guess — edit as needed)
            <textarea rows={3} value={form.company_guess} onChange={upd('company_guess')} />
          </label>
          <label>Your notes
            <textarea rows={5} placeholder="Why this is interesting, follow-up needed, where you met, etc." value={form.notes} onChange={upd('notes')} />
          </label>
          <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save contact'}</button>
        </form>
      )}
    </>
  );
}

function ListTab() {
  const [rows, setRows] = useState<Contact[] | null>(null);

  async function load() {
    const r = await fetch('/api/contacts');
    setRows(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function del(id: number) {
    if (!confirm('Delete this contact?')) return;
    await fetch('/api/contacts/' + id, { method: 'DELETE' });
    load();
  }

  if (!rows) return <p style={{ color: '#9aa0ad' }}>Loading…</p>;
  return (
    <>
      <div className="list-actions">
        <a className="btn-secondary" href="/api/export">Export CSV</a>
      </div>
      {rows.length === 0 ? <p style={{ color: '#9aa0ad' }}>No contacts yet.</p> :
        rows.map(r => (
          <div key={r.id} className="contact">
            <button className="delete" onClick={() => del(r.id)}>Delete</button>
            <h3>{r.name || '(no name)'}</h3>
            <div className="company">{r.company}</div>
            <div className="meta">{r.email} · added by {r.owner} on {r.created_at.slice(0, 10)}</div>
            {r.company_guess && <div className="notes"><em>{r.company_guess}</em></div>}
            {r.notes && <div className="notes" style={{ marginTop: 8 }}>{r.notes}</div>}
          </div>
        ))
      }
    </>
  );
}
