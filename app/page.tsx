'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', quality)
  );
}

type Extracted = { name?: string; company?: string; email?: string; state?: string; company_guess?: string; error?: string };
type Contact = { id: number; created_at: string; name: string; company: string; email: string; state: string; company_guess: string; notes: string; owner: string; photo_path: string };

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

type DraftContact = Extracted & { notes: string; state: string };

function ScanTab() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [statusErr, setStatusErr] = useState(false);
  const [photoPath, setPhotoPath] = useState('');
  const [draft, setDraft] = useState<DraftContact | null>(null);
  const [step, setStep] = useState<null | 'email' | 'notes'>(null);
  const [saving, setSaving] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setStatus('Compressing photo…'); setStatusErr(false);
    setDraft(null); setStep(null);

    let upload: Blob = file;
    try { upload = await compressImage(file, 1600, 0.85); } catch {}

    setStatus('Reading badge with AI…');
    const fd = new FormData();
    fd.append('photo', upload, 'badge.jpg');
    try {
      const r = await fetch('/api/scan', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'scan failed');
      const x: Extracted = data.extracted || {};
      setPhotoPath(data.photo_path);
      const d: DraftContact = { name: x.name || '', company: x.company || '', email: x.email || '', state: '', company_guess: x.company_guess || '', notes: '' };
      setDraft(d);
      if (x.error) { setStatus('AI extract failed — enter details manually.'); setStatusErr(true); }
      else setStatus(`${x.name || ''}${x.company ? ' · ' + x.company : ''}`.trim() || 'Badge scanned.');
      setStep('email');
    } catch (err: any) {
      setStatus(err.message); setStatusErr(true);
    }
  }

  async function save(final: DraftContact) {
    setSaving(true);
    const r = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...final, photo_path: photoPath }),
    });
    setSaving(false);
    if (!r.ok) { const d = await r.json(); setStatus(d.error || 'save failed'); setStatusErr(true); return; }
    setStatus('Saved ✓'); setStatusErr(false);
    setDraft(null); setPreviewUrl(null); setPhotoPath(''); setStep(null);
  }

  return (
    <>
      <label className="capture-btn">
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
        <span>📷 Take badge photo</span>
      </label>
      {previewUrl && <img className="preview" src={previewUrl} alt="" />}
      {status && <div className={'status' + (statusErr ? ' err' : '')}>{status}</div>}

      {draft && step === 'email' && (
        <Modal title="Confirm email" subtitle={draft.name ? `For ${draft.name}${draft.company ? ` · ${draft.company}` : ''}` : undefined}>
          <label>Email
            <input type="email" autoFocus value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="name@company.com" />
          </label>
          <label>State (optional)
            <input value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })} placeholder="e.g. CA" />
          </label>
          <button className="primary" onClick={() => setStep('notes')}>Next</button>
        </Modal>
      )}

      {draft && step === 'notes' && (
        <Modal title="Your notes" subtitle="What do you want to remember about this person?">
          <label>Notes
            <textarea autoFocus rows={6} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Why this is interesting, follow-up needed, where you met, etc." />
          </label>
          {draft.company_guess && (
            <div style={{ color: '#9aa0ad', fontSize: 12, fontStyle: 'italic', margin: '6px 0 0' }}>
              AI guess about the company: {draft.company_guess}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn-secondary" onClick={() => setStep('email')}>Back</button>
            <button className="primary" style={{ marginTop: 0, flex: 1 }} disabled={saving} onClick={() => save(draft)}>{saving ? 'Saving…' : 'Save contact'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div className="card" style={{ maxWidth: 420 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {subtitle && <p className="sub" style={{ margin: '4px 0 12px', color: '#9aa0ad' }}>{subtitle}</p>}
        {children}
      </div>
    </div>
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
            <button className="delete" onClick={e => { e.preventDefault(); del(r.id); }}>Delete</button>
            <a href={`/contact/${r.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
              <h3>{r.name || '(no name)'}</h3>
              <div className="company">{r.company}</div>
              <div className="meta">{r.email}</div>
              {r.notes && <div className="notes" style={{ marginTop: 12, fontSize: 17, lineHeight: 1.45, fontWeight: 500 }}>{r.notes}</div>}
              {r.company_guess && <div style={{ marginTop: 10, color: '#9aa0ad', fontSize: 12, fontStyle: 'italic' }}>{r.company_guess}</div>}
            </a>
          </div>
        ))
      }
    </>
  );
}
