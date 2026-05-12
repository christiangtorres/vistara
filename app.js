const $ = s => document.querySelector(s);

document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('#tab-' + t.dataset.tab).classList.add('active');
    if (t.dataset.tab === 'list') loadList();
  };
});

$('#photo').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  $('#preview').src = url;
  $('#preview').hidden = false;
  $('#status').textContent = 'Reading badge with AI…';
  $('#entry').hidden = true;

  const fd = new FormData();
  fd.append('photo', file);
  try {
    const r = await fetch('api.php?action=scan', { method: 'POST', body: fd });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    const x = data.extracted || {};
    if (x.error) {
      $('#status').innerHTML = '<span class="err">AI extract failed: ' + x.error + '. Fill in manually below.</span>';
    } else {
      $('#status').textContent = 'Got it. Review and add your notes.';
    }
    const f = $('#entry');
    f.name.value = x.name || '';
    f.company.value = x.company || '';
    f.title.value = x.title || '';
    f.email.value = x.email || '';
    f.phone.value = x.phone || '';
    f.company_guess.value = x.company_guess || '';
    f.notes.value = '';
    f.photo.value = data.photo || '';
    f.hidden = false;
  } catch (err) {
    $('#status').innerHTML = '<span class="err">' + err.message + '</span>';
    $('#entry').hidden = false;
  }
});

$('#entry').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  const r = await fetch('api.php?action=save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (data.error) { $('#status').innerHTML = '<span class="err">' + data.error + '</span>'; return; }
  $('#status').textContent = 'Saved ✓';
  e.target.reset();
  e.target.hidden = true;
  $('#preview').hidden = true;
  $('#photo').value = '';
});

async function loadList() {
  const r = await fetch('api.php?action=list');
  const rows = await r.json();
  const c = $('#contacts');
  if (!rows.length) { c.innerHTML = '<p style="color:#9aa0ad">No contacts yet.</p>'; return; }
  c.innerHTML = rows.map(r => `
    <div class="contact" data-id="${r.id}">
      <button class="delete" onclick="del(${r.id})">Delete</button>
      <h3>${esc(r.name) || '(no name)'}</h3>
      <div class="company">${esc(r.company)} ${r.title ? '· ' + esc(r.title) : ''}</div>
      <div class="meta">${esc(r.email)} ${r.phone ? '· ' + esc(r.phone) : ''} · added by ${esc(r.owner)} on ${r.created_at.slice(0,10)}</div>
      ${r.company_guess ? `<div class="notes"><em>${esc(r.company_guess)}</em></div>` : ''}
      ${r.notes ? `<div class="notes" style="margin-top:8px">${esc(r.notes)}</div>` : ''}
    </div>
  `).join('');
}

async function del(id) {
  if (!confirm('Delete this contact?')) return;
  await fetch('api.php?action=delete&id=' + id);
  loadList();
}

function esc(s) { return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
