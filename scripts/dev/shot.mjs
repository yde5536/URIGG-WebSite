// 헤드리스 Edge로 스크린샷 (가짜 로그인 + 가짜 D-day·일정, 캘린더 위젯 iframe은 막음)
// node scripts/dev/shot.mjs <url> <out.png> [width] [height]
// 환경 변수: DPR(배율) WAIT(ms) SCROLL(선택자) K(스크롤 배수) TYPE(D-day 이름 입력) EVAL(실행 후 값 출력) BROWSER(브라우저 경로)
import { spawn } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
const [url, out, width = '1440', height = '900'] = process.argv.slice(2);
const edge = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((f) => existsSync(f));
const prof = await mkdtemp(join(tmpdir(), 'edge-'));
const p = spawn(edge, ['--headless=new', '--remote-debugging-port=9337', `--user-data-dir=${prof}`, `--window-size=${width},${height}`, 'about:blank']);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let target; for (let i = 0; i < 50 && !target; i++) { await wait(200); try { target = (await (await fetch('http://127.0.0.1:9337/json')).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +width, height: +height, deviceScaleFactor: +(process.env.DPR||1), mobile: +width < 500 });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  if (window !== top) { location.replace("about:blank"); }
  if (window === top) localStorage.setItem('sb-dfvcgacadkaglgtooxdy-auth-token', JSON.stringify({ access_token: 'test', expires_at: Math.floor(Date.now()/1000) + 3600 }));
  const real = window.fetch;
  window.fetch = (u, o) => String(u).includes('/rest/v1/events') ? Promise.resolve(new Response(JSON.stringify(String(u).includes('start_at=lt.') ? [{title:'리눅스마스터 오답 복습',emoji:'📘',start_at:new Date().toISOString().slice(0,10)+'T05:00:00Z',all_day:false},{title:'분리수거',emoji:'♻️',start_at:new Date().toISOString().slice(0,10)+'T00:00:00Z',all_day:true}] : [{title:'리눅스마스터 2급 2차 시험',emoji:'🐧',start_at:'2026-12-12T00:00:00+00:00'},{title:'리눅스마스터 2급 2차 시험',emoji:'🐧',start_at:'2027-03-12T00:00:00+00:00'},{title:'리눅스 스터디',emoji:'📚',start_at:'2026-11-05T11:00:00+00:00'}]),{headers:{'content-type':'application/json'}})) : String(u).includes('/rest/v1/ddays') ? Promise.resolve(new Response(JSON.stringify([
    { id: '1', title: '리눅스마스터 2급 2차', target: '2026-12-12', is_main: true },
    { id: '2', title: '기말고사', target: '2026-12-01', is_main: false },
    { id: '3', title: '정보처리기능사 필기', target: '2027-01-24', is_main: false },
    { id: '4', title: '리마 1차 발표', target: '2026-11-04', is_main: false }]), { headers: { 'content-type': 'application/json' } })) : real(u, o);
` });
await send('Page.navigate', { url }); await wait(+(process.env.WAIT||4000));
if (process.env.TYPE) { await send('Runtime.evaluate', { expression: `document.querySelector('#dday-add').click(); const i=document.querySelector('#dday-name'); i.value=${JSON.stringify(process.env.TYPE)}; i.dispatchEvent(new Event('input')); setTimeout(()=>i.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown'})),600);` }); await wait(1200); }
if (process.env.SCROLL) { await send('Runtime.evaluate', { expression: `scrollTo(0, document.querySelector(${JSON.stringify(process.env.SCROLL)}).offsetTop + innerHeight*${+process.env.K||1.2})` }); await wait(800); }
if (process.env.EVAL) console.log(JSON.stringify((await send('Runtime.evaluate', { expression: process.env.EVAL, returnByValue: true, awaitPromise: true })).result.value));
await writeFile(out, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
ws.close(); p.kill(); console.log('saved', out);
