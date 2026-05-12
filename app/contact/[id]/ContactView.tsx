'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Contact = {
  id: number; created_at: string;
  name: string; company: string; email: string; state: string;
  company_guess: string; notes: string; owner: string; photo_path: string;
};

export default function ContactView({ contact, photoUrl, audioUrl }: { contact: Contact; photoUrl: string | null; audioUrl?: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(contact);
  const [err, setErr] = useState('');

  const upd = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true); setErr('');
    const r = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name, company: form.company, email: form.email, state: form.state,
        company_guess: form.company_guess, notes: form.notes,
      }),
    });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || 'save failed'); return; }
    setEditing(false);
    router.refresh();
  }

  async function del() {
    if (!confirm('Delete this contact?')) return;
    const r = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
    if (r.ok) router.push('/');
  }

  if (!editing) {
    return (
      <>
        <h2 style={{ margin: '0 0 4px' }}>{form.name || '(no name)'}</h2>
        <div style={{ color: '#8ab4ff', fontSize: 16, marginBottom: 14 }}>{form.company}</div>
        {photoUrl && <img className="preview" src={photoUrl} alt="badge" style={{ marginBottom: 18 }} />}
        {audioUrl && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: '#9aa0ad', fontSize: 13, marginBottom: 6 }}>Voice note</div>
            <audio controls src={audioUrl} style={{ width: '100%' }} />
          </div>
        )}
        <div className="contact" style={{ marginBottom: 14 }}>
          <Field label="Email" value={form.email} />
          <Field label="State" value={form.state} />
          <Field label="What this company does" value={form.company_guess} />
          <Field label="Your notes" value={form.notes} multi />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="primary" style={{ marginTop: 0, flex: 1 }} onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-secondary" onClick={del} style={{ color: '#d97777' }}>Delete</button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Edit contact</h2>
      {photoUrl && <img className="preview" src={photoUrl} alt="badge" style={{ marginBottom: 18 }} />}
      <label>Name<input value={form.name} onChange={upd('name')} /></label>
      <label>Company<input value={form.company} onChange={upd('company')} /></label>
      <label>Email<input type="email" value={form.email} onChange={upd('email')} /></label>
      <label>State<input value={form.state} onChange={upd('state')} /></label>
      <label>What this company does<textarea rows={3} value={form.company_guess} onChange={upd('company_guess')} /></label>
      <label>Your notes<textarea rows={6} value={form.notes} onChange={upd('notes')} /></label>
      {err && <p style={{ color: '#ff8a8a' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn-secondary" onClick={() => { setForm(contact); setEditing(false); }}>Cancel</button>
        <button className="primary" style={{ marginTop: 0, flex: 1 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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
