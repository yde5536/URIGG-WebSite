// 로컬 정적 서버: node scripts/dev/serve.mjs site 4181
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import path from 'node:path';
const root = process.argv[2]; const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg' };
http.createServer(async (req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  try { const b = await readFile(path.join(root, p)); res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end('nf'); } }).listen(+process.argv[3]||4173, () => console.log('on', +process.argv[3] || 4173));
