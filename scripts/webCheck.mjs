// Muted headless Chrome over the DevTools protocol, serving a static export.
// A scenario is a module whose default export gets the helpers below.
//   npx expo export --platform web --dev --output-dir <dir>
//   node scripts/webCheck.mjs <dir> <scenario.mjs> [width]
// Screenshots land in <dir>/shots.
// For real performance numbers build with EXPO_PUBLIC_TEST_HOOK=1 and no --dev.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [dist, scenario, width = '360'] = process.argv.slice(2);
const here = path.join(path.resolve(dist), 'shots');
fs.mkdirSync(here, { recursive: true });
const PORT = 8123;
const DBG = 9333;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(dist, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + '.html') ? f + '.html' : path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

const profile = path.join(here, 'chrome-profile');
fs.rmSync(profile, { recursive: true, force: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--mute-audio', '--disable-gpu', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`, `--window-size=${width},800`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const stop = (code) => { try { chrome.kill(); } catch {} server.close(); process.exit(code); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 60 && !target; i++) {
  await wait(250);
  try { target = (await (await fetch(`http://127.0.0.1:${DBG}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
if (!target) { console.log('no chrome'); stop(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const waiting = new Map();
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: 800, deviceScaleFactor: 2, mobile: true });

const api = {
  wait,
  errors,
  go: async (p) => { await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${p}` }); await wait(2500); },
  eval: async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result?.result?.value;
  },
  shot: async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(here, `${name}.png`), Buffer.from(r.result.data, 'base64'));
  },
  // Clicks the first element whose own text matches.
  click: async (text) => api.eval(`(() => { const all = [...document.querySelectorAll('div,span,a,button')].filter(e => e.textContent.trim().toLowerCase() === ${JSON.stringify(text.toLowerCase())} && e.offsetParent); const e = all[all.length - 1]; if (!e) return false; const r = e.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0 }; for (const t of ['pointerdown','mousedown','pointerup','mouseup','click']) e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o)); return true; })()`),
  text: () => api.eval(`document.body.innerText`),
  throttle: (rate) => send('Emulation.setCPUThrottlingRate', { rate }),
};

try {
  const mod = await import(pathToFileURL(path.resolve(scenario)).href);
  await mod.default(api);
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 6));
  stop(0);
} catch (e) {
  console.log('FAILED', e);
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 6));
  await api.shot('failure').catch(() => {});
  stop(1);
}
