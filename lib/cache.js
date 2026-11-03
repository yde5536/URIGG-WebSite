// Cloudflare 엣지 캐시에 JSON 응답을 maxAge초 동안 보관한다.
// 공개 데이터라 허브(데스크톱 앱, 출처 http://tauri.localhost)도 읽을 수 있게 CORS를 연다.
const CORS = { 'Access-Control-Allow-Origin': '*' };
export async function cached({ request, waitUntil }, maxAge, load) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const res = new Response(JSON.stringify(await load()), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${maxAge}`,
        ...CORS,
      },
    });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
    });
  }
}
