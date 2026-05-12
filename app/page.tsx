'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function useSpeech() {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);
  const finalRef = useRef('');

  useEffect(() => {
    const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) setSupported(false);
  }, []);

  function start() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return false; }
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalRef.current += t + ' ';
          else interim += t;
        }
        setTranscript((finalRef.current + interim).trim());
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.start();
      recRef.current = rec;
      setListening(true);
      return true;
    } catch { setListening(false); return false; }
  }
  function stop() { try { recRef.current?.stop(); } catch {} setListening(false); }
  function reset() { finalRef.current = ''; setTranscript(''); }
  return { transcript, listening, supported, start, stop, reset };
}

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
  const [tab, setTab] = useState<'scan' | 'list' | 'trash'>('scan');
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
        <button className={'tab' + (tab === 'trash' ? ' active' : '')} onClick={() => setTab('trash')}>Trash</button>
      </nav>
      <div className="pane">
        {tab === 'scan' && <ScanTab />}
        {tab === 'list' && <ListTab />}
        {tab === 'trash' && <TrashTab />}
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
  const speech = useSpeech();

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>, kind: 'badge' | 'card') {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setStatus('Compressing photo…'); setStatusErr(false);
    setDraft(null); setStep(null);
    speech.reset();
    speech.start();

    let upload: Blob = file;
    try { upload = await compressImage(file, 1600, 0.85); } catch {}

    setStatus(`Reading ${kind === 'card' ? 'business card' : 'badge'} with AI…`);
    const fd = new FormData();
    fd.append('photo', upload, `${kind}.jpg`);
    fd.append('kind', kind);
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
    speech.stop();
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
    speech.reset();
  }

  // Keep notes field synced with live voice transcript while listening.
  useEffect(() => {
    if (speech.listening && draft && step === 'notes') {
      setDraft(d => d ? { ...d, notes: speech.transcript } : d);
    }
  }, [speech.transcript, speech.listening, step]);

  return (
    <>
      <div style={{ display: 'grid', gap: 10 }}>
        <label className="capture-btn">
          <input type="file" accept="image/*" capture="environment" onChange={e => onPhoto(e, 'badge')} style={{ display: 'none' }} />
          <span>📷 Take badge photo</span>
        </label>
        <label className="capture-btn" style={{ background: '#2a3142' }}>
          <input type="file" accept="image/*" capture="environment" onChange={e => onPhoto(e, 'card')} style={{ display: 'none' }} />
          <span>💼 Take business card photo</span>
        </label>
      </div>
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
        <Modal title="Your notes" subtitle={speech.listening ? '🎤 Listening — speak your notes' : 'What do you want to remember about this person?'}>
          <label>Notes
            <textarea autoFocus rows={6} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Why this is interesting, follow-up needed, where you met, etc." />
          </label>
          {speech.supported && (
            <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => speech.listening ? speech.stop() : speech.start()}>
              {speech.listening ? '⏹ Stop recording' : '🎤 Resume recording'}
            </button>
          )}
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

function TrashTab() {
  const [rows, setRows] = useState<Contact[] | null>(null);
  async function load() { const r = await fetch('/api/trash'); setRows(await r.json()); }
  useEffect(() => { load(); }, []);
  async function restore(id: number) { await fetch(`/api/contacts/${id}/restore`, { method: 'POST' }); load(); }

  if (!rows) return <p style={{ color: '#9aa0ad' }}>Loading…</p>;
  return (
    <>
      <p style={{ color: '#9aa0ad', fontSize: 13, marginTop: 0 }}>Deleted contacts are kept for 7 days, then removed permanently.</p>
      {rows.length === 0 ? <p style={{ color: '#9aa0ad' }}>Trash is empty.</p> :
        rows.map(r => {
          const deletedAt = (r as any).deleted_at as string;
          const daysLeft = Math.max(0, 7 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000));
          return (
            <div key={r.id} className="contact">
              <h3>{r.name || '(no name)'}</h3>
              <div className="company">{r.company}</div>
              <div className="meta">{r.email} · deleted {deletedAt.slice(0, 10)} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</div>
              <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => restore(r.id)}>Restore</button>
            </div>
          );
        })
      }
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
