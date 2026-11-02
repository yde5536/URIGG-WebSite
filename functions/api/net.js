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
    timezone: cf.timezone,
    colo: cf.colo,
    http: cf.httpProtocol,
    tls: cf.tlsVersion,
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private' },
  });
};
