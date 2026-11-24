const $ = id => document.getElementById(id); let cur = null, S = {}, busy = false, lastAns = '', bubble;
const st = (t, c = '') => { $('status').textContent = t; $('core').className = c; };
function add(role, text) { const d = document.createElement('div'); d.className = 'm ' + role; d.textContent = text; $('chat').append(d); $('chat').scrollTop = 1e9; return d; }
async function refresh() { const q = $('search').value.trim(); const l = await api.convList(q); $('list').innerHTML = '';
  l.forEach(c => { const e = document.createElement('div'); e.className = 'it' + (c.id === cur ? ' a' : '');
    e.innerHTML = '<span></span><em title="تغییر نام">✎</em><em title="حذف">🗑</em>'; e.firstChild.textContent = c.title;
    e.onclick = () => open(c.id); e.children[1].onclick = async ev => { ev.stopPropagation(); const t = prompt('نام جدید:', c.title); if (t) { await api.convRename(c.id, t); refresh(); } };
    e.children[2].onclick = async ev => { ev.stopPropagation(); if (confirm('حذف شود؟')) { await api.convDelete(c.id); if (cur === c.id) { cur = null; $('chat').innerHTML = ''; } refresh(); } }; $('list').append(e); }); }
async function open(id) { cur = id; $('chat').innerHTML = ''; (await api.convGet(id)).forEach(m => add(m.role, m.content)); refresh(); }
async function send() { const t = $('inp').value.trim(); if (!t || busy) return;
  if (!cur) cur = (await api.convNew()).id; $('inp').value = ''; add('user', t); bubble = add('assistant', '…'); lastAns = ''; busy = true; st('در حال فکر کردن…', 'think'); api.send(cur, t); }
api.onChunk(d => { if (d.token) { if (!lastAns) st('در حال پاسخ دادن…', 'think'); lastAns += d.token; bubble.textContent = lastAns; $('chat').scrollTop = 1e9; }
  if (d.error) { bubble.className = 'm err'; bubble.textContent = '⚠ ' + d.error; }
  if (d.done || d.error) { busy = false; st('آنلاین'); refresh(); if (d.done && !S.mute) say(lastAns); } });
function say(t) { speechSynthesis.cancel(); if (!t) return; const u = new SpeechSynthesisUtterance(t); u.rate = +S.rate || 1; u.lang = /[\u0600-\u06FF]/.test(t) ? 'fa-IR' : 'en-US'; speechSynthesis.speak(u); }
let rec; $('mic').onclick = () => { const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return add('err', 'تشخیص گفتار در این محیط پشتیبانی نمی‌شود.'); if (rec) { rec.stop(); return; }
  rec = new R(); rec.lang = 'fa-IR'; rec.interimResults = true; $('mic').classList.add('on'); st('در حال گوش دادن…', 'listen');
  rec.onresult = e => { $('inp').value = [...e.results].map(r => r[0].transcript).join(' '); };
  rec.onerror = e => add('err', 'خطای میکروفون: ' + e.error); rec.onend = () => { rec = null; $('mic').classList.remove('on'); st('آنلاین'); }; rec.start(); };
$('speak').onclick = () => speechSynthesis.speaking ? speechSynthesis.cancel() : say(lastAns);
$('send').onclick = send; $('inp').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
$('newChat').onclick = async () => { cur = (await api.convNew()).id; $('chat').innerHTML = ''; refresh(); };
$('search').oninput = refresh; $('clearAll').onclick = async () => { if (await api.historyClear()) { cur = null; $('chat').innerHTML = ''; refresh(); } };
$('setBtn').onclick = async () => { S = { ...S, ...await api.settingsGet() }; $('s_url').value = S.baseUrl; $('s_model').value = S.model; $('s_to').value = S.timeoutSec; $('s_tone').value = S.tone;
  $('s_ret').value = S.retentionDays; $('s_mem').checked = S.memory; $('s_mute').checked = !!S.mute; $('s_rate').value = S.rate || 1; $('s_key').value = ''; $('dlg').showModal(); };
$('s_close').onclick = () => $('dlg').close();
$('s_save').onclick = async () => { S.mute = $('s_mute').checked; S.rate = $('s_rate').value; localStorage.setItem('ui', JSON.stringify({ mute: S.mute, rate: S.rate }));
  try { await api.settingsSet({ baseUrl: $('s_url').value.trim(), model: $('s_model').value.trim(), timeoutSec: +$('s_to').value || 60, tone: $('s_tone').value,
    retentionDays: +$('s_ret').value || 0, memory: $('s_mem').checked, apiKey: $('s_key').value.trim() || undefined }); $('dlg').close(); } catch (e) { alert(e.message); } };
setInterval(async () => { const i = await api.sysInfo(); $('stats').textContent = `CPU ${i.cpuPct}% • RAM ${Math.round(100 * (1 - i.free / i.total))}% • ${navigator.onLine ? 'متصل' : 'آفلاین'}`; }, 2000);
addEventListener('offline', () => st('آفلاین')); addEventListener('online', () => st('آنلاین'));
try { Object.assign(S, JSON.parse(localStorage.getItem('ui') || '{}')); } catch {} api.settingsGet().then(s => S = { ...S, ...s }); refresh();
