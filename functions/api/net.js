// GET /api/net — 지금 이 연결의 공인 IP·통신사·위치 (Cloudflare가 요청에 붙여 주는 정보)
// 보는 사람 자신의 정보라 어디에도 저장하지 않고, 캐시도 하지 않는다.
export const onRequestGet = ({ request }) => {
  const cf = request.cf || {};
  const body = {
    ip: request.headers.get('CF-Connecting-IP'),
    asn: cf.asn,
    isp: cf.asOrganization,
    country: cf.country,
    city: cf.city,
    // 도시 단위 대략 좌표 (허브 Weather 칸이 날씨를 받을 때 씀)
    lat: cf.latitude,
    lon: cf.longitude,
    timezone: cf.timezone,
    colo: cf.colo,
    http: cf.httpProtocol,
    tls: cf.tlsVersion,
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'Access-Control-Allow-Origin': '*' },
  });
};
