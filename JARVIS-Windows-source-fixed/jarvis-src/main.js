const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os');
const Database = require('better-sqlite3');
let win, db, abortCtl, S;
const sPath = () => path.join(app.getPath('userData'), 'settings.json');
const DEF = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', timeoutSec: 60, retries: 2,
  memory: true, retentionDays: 0, lang: 'fa', tone: 'friendly', keyEnc: '' };
function loadS() { try { S = { ...DEF, ...JSON.parse(fs.readFileSync(sPath(), 'utf8')) }; } catch { S = { ...DEF }; } }
function saveS() { fs.writeFileSync(sPath(), JSON.stringify(S)); }
function getKey() { try { return S.keyEnc ? safeStorage.decryptString(Buffer.from(S.keyEnc, 'base64')) : ''; } catch { return ''; } }
function initDb() {
  db = new Database(path.join(app.getPath('userData'), 'jarvis.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS conv(id INTEGER PRIMARY KEY, title TEXT, ts INTEGER);
  CREATE TABLE IF NOT EXISTS msg(id INTEGER PRIMARY KEY, conv INTEGER, role TEXT, content TEXT, ts INTEGER);`);
  if (S.retentionDays > 0) { const c = Date.now() - S.retentionDays * 864e5;
    db.prepare('DELETE FROM msg WHERE ts<?').run(c); db.prepare('DELETE FROM conv WHERE ts<?').run(c); }
}
function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 720, minWidth: 900, minHeight: 600, backgroundColor: '#050b1a',
    title: 'JARVIS AI', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.setMenuBarVisibility(false); win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.session.setPermissionRequestHandler((_, p, cb) => cb(p === 'media')); // mic only on user click in UI
}
const sys = () => ({ cpu: os.loadavg()[0], cores: os.cpus().length, total: os.totalmem(), free: os.freemem(), platform: os.platform(), uptime: os.uptime() });
let lastCpu = os.cpus();
function cpuPct() { const n = os.cpus(); let idle = 0, tot = 0;
  n.forEach((c, i) => { const p = lastCpu[i].times, t = c.times; for (const k in t) tot += t[k] - p[k]; idle += t.idle - p.idle; });
  lastCpu = n; return tot ? Math.round(100 * (1 - idle / tot)) : 0; }
app.whenReady().then(() => {
  loadS(); initDb(); createWindow();
  ipcMain.handle('conv:list', (_, q) => q ? db.prepare('SELECT DISTINCT c.* FROM conv c LEFT JOIN msg m ON m.conv=c.id WHERE c.title LIKE @q OR m.content LIKE @q ORDER BY c.ts DESC').all({ q: `%${q}%` })
    : db.prepare('SELECT * FROM conv ORDER BY ts DESC').all());
  ipcMain.handle('conv:new', () => ({ id: db.prepare('INSERT INTO conv(title,ts) VALUES(?,?)').run('گفتگوی جدید', Date.now()).lastInsertRowid }));
  ipcMain.handle('conv:get', (_, id) => db.prepare('SELECT role,content FROM msg WHERE conv=? ORDER BY id').all(id));
  ipcMain.handle('conv:rename', (_, id, t) => db.prepare('UPDATE conv SET title=? WHERE id=?').run(String(t).slice(0, 80), id));
  ipcMain.handle('conv:delete', (_, id) => { db.prepare('DELETE FROM msg WHERE conv=?').run(id); db.prepare('DELETE FROM conv WHERE id=?').run(id); });
  ipcMain.handle('history:clear', async () => { const r = await dialog.showMessageBox(win, { type: 'warning', buttons: ['لغو', 'حذف همه'], defaultId: 0, message: 'تمام تاریخچه حذف شود؟' });
    if (r.response === 1) { db.exec('DELETE FROM msg; DELETE FROM conv;'); return true; } return false; });
  ipcMain.handle('settings:get', () => ({ ...S, keyEnc: undefined, hasKey: !!S.keyEnc }));
  ipcMain.handle('settings:set', (_, n) => { const { apiKey, ...rest } = n;
    for (const k of Object.keys(DEF)) if (k !== 'keyEnc' && rest[k] !== undefined) S[k] = rest[k];
    if (apiKey) { if (!safeStorage.isEncryptionAvailable()) throw new Error('رمزنگاری سیستم در دسترس نیست');
      S.keyEnc = safeStorage.encryptString(apiKey).toString('base64'); }
    saveS(); return true; });
  ipcMain.handle('sys:info', () => ({ ...sys(), cpuPct: cpuPct() }));
  ipcMain.handle('sys:openUrl', async (_, u) => { if (!/^https?:\/\//i.test(u)) return false;
    const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['لغو', 'باز کن'], message: 'باز کردن این آدرس؟', detail: u });
    if (r.response === 1) { await shell.openExternal(u); return true; } return false; });
  ipcMain.handle('chat:abort', () => abortCtl?.abort());
  ipcMain.handle('chat:send', async (_, convId, text) => {
    const emit = d => win.webContents.send('chat:chunk', d);
    if (S.memory) db.prepare('INSERT INTO msg(conv,role,content,ts) VALUES(?,?,?,?)').run(convId, 'user', text, Date.now());
    const row = db.prepare('SELECT COUNT(*) n FROM msg WHERE conv=?').get(convId);
    if (S.memory && row.n === 1) db.prepare('UPDATE conv SET title=? WHERE id=?').run(text.slice(0, 40), convId);
    const hist = S.memory ? db.prepare('SELECT role,content FROM msg WHERE conv=? ORDER BY id DESC LIMIT 20').all(convId).reverse() : [{ role: 'user', content: text }];
    const tones = { friendly: 'دوستانه', formal: 'رسمی', expert: 'تخصصی' };
    const sysMsg = `You are JARVIS, a helpful, polite assistant. Reply in the user's language (Persian or English). Tone: ${tones[S.tone] || S.tone}. Be honest about your abilities and limits; you cannot execute actions on the user's PC from this chat.`;
    const key = getKey(); if (!key) { emit({ error: 'کلید API تنظیم نشده است. از تنظیمات وارد کنید.' }); return; }
    let full = '', lastErr = '';
    for (let a = 0; a <= S.retries; a++) {
      abortCtl = new AbortController(); const t = setTimeout(() => abortCtl.abort(), S.timeoutSec * 1000);
      try {
        const r = await fetch(S.baseUrl.replace(/\/$/, '') + '/chat/completions', { method: 'POST', signal: abortCtl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ model: S.model, stream: true, messages: [{ role: 'system', content: sysMsg }, ...hist] }) });
        if (!r.ok) { lastErr = `خطای سرویس (${r.status})`; if (r.status < 500 && r.status !== 429) break; throw new Error(lastErr); }
        const dec = new TextDecoder(); let buf = '';
        for await (const ch of r.body) { buf += dec.decode(ch, { stream: true }); const lines = buf.split('\n'); buf = lines.pop();
          for (const l of lines) { if (!l.startsWith('data:')) continue; const d = l.slice(5).trim(); if (d === '[DONE]') continue;
            try { const tk = JSON.parse(d).choices?.[0]?.delta?.content; if (tk) { full += tk; emit({ token: tk }); } } catch {} } }
        clearTimeout(t); lastErr = ''; break;
      } catch (e) { clearTimeout(t); if (e.name === 'AbortError' && !full) { lastErr = 'درخواست لغو شد یا زمان انتظار تمام شد'; break; }
        lastErr = lastErr || 'خطای اتصال'; if (full) break; await new Promise(r => setTimeout(r, 1000 * (a + 1))); }
    }
    if (full && S.memory) db.prepare('INSERT INTO msg(conv,role,content,ts) VALUES(?,?,?,?)').run(convId, 'assistant', full, Date.now());
    emit(lastErr && !full ? { error: lastErr } : { done: true });
  });
});
app.on('window-all-closed', () => app.quit());
