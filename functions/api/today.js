import { parseIcs, months } from '../../lib/ics.js';

// GET /api/today — 지난달부터 다음 달까지의 일정(달력용). 공개 사이트라 접근 키(x-site-key)가 맞아야 내준다.
// Cloudflare Pages 환경 변수(비밀): ICS_URL = 코워크 캘린더 구독 주소, SITE_KEY = 접근 키
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });

// 키 비교에 걸리는 시간이 맞은 글자 수에 따라 달라지지 않도록
function same(a = '', b = '') {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestGet({ request, env }) {
  if (!env.ICS_URL || !env.SITE_KEY) return json({ error: 'not-configured' }, 503);
  if (!same(request.headers.get('x-site-key') || '', env.SITE_KEY)) return json({ error: 'locked' }, 401);
  try {
    const res = await fetch(env.ICS_URL, { headers: { 'User-Agent': 'URIGG-site' } });
    if (!res.ok) return json({ error: `calendar ${res.status}` }, 502);
    return json(months(parseIcs(await res.text())));
  } catch (err) {
    return json({ error: String(err.message || err) }, 502);
  }
}
