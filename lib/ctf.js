// 다가오는 CTF 대회 — CTFtime 공개 API (https://ctftime.org/api/)
// 이미 시작했지만 아직 안 끝난 대회도 넣으려고 사흘 전부터 찾는다.
const DAY = 86_400;
// 초보자용: 제목·설명에 초보·입문·고등학생 대상이라고 적힌 대회. 예선을 통과해야 하는 본선(Prequalified, Final)은 뺀다.
// (student, easy 같은 말은 일반 대회에도 흔해서 넣지 않았다)
const BEGINNER = /beginner|newbie|novice|entry[- ]level|introductory|first[- ]timers?|초보|입문|high[- ]?school/i;
const isBeginner = (e) => BEGINNER.test(`${e.title} ${e.description || ''}`) && e.restrictions !== 'Prequalified' && !/final/i.test(e.title);

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
      beginner: isBeginner(e),
    }));
  return { fetchedAt: new Date().toISOString(), events };
}
