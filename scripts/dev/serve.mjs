// 로컬 정적 서버: node scripts/dev/serve.mjs site 4181
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import path from 'node:path';
const root = process.argv[2]; const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp' };
// /api/net은 Cloudflare만 아는 정보라, 여기서는 문서 예시용 IP(203.0.113.x)로 흉내 낸다
const NET = { ip: '203.0.113.7', asn: 4766, isp: 'Korea Telecom', country: 'KR', city: 'Seoul', timezone: 'Asia/Seoul', colo: 'ICN', http: 'HTTP/3', tls: 'TLSv1.3' };
http.createServer(async (req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  if (p === '/api/net') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(NET)); return; }
  try { const b = await readFile(path.join(root, p)); res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end('nf'); } }).listen(+process.argv[3]||4173, () => console.log('on', +process.argv[3] || 4173));
