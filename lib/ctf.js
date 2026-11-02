// 다가오는 CTF 대회 — CTFtime 공개 API (https://ctftime.org/api/)
// 이미 시작했지만 아직 안 끝난 대회도 넣으려고 사흘 전부터 찾는다.
const DAY = 86_400;

export async function fetchCtf(limit = 15) {
  const now = Math.floor(Date.now() / 1000);
  const url = `https://ctftime.org/api/v1/events/?limit=${limit + 10}&start=${now - 3 * DAY}&finish=${now + 45 * DAY}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'urigg.pages.dev (personal dashboard)', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ctftime ${res.status}`);
  const events = (await res.json())
    .filter((e) => Date.parse(e.finish) > Date.now())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, limit)
    .map((e) => ({
      title: e.title,
      url: e.ctftime_url,
      start: e.start,
      finish: e.finish,
      format: e.format,
      onsite: !!e.onsite,
      location: e.location || '',
      weight: e.weight,
    }));
  return { fetchedAt: new Date().toISOString(), events };
}
