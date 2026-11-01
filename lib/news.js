// 보안 뉴스 RSS 세 곳을 합쳐 최신순으로 — KISA 보안공지, 데일리시큐, The Hacker News
import { decode } from './rss.js';

export const SOURCES = [
  { id: 'kisa', label: 'KISA', url: 'https://www.boho.or.kr/kr/rss.do?bbsId=B0000133' },
  { id: 'dailysecu', label: '데일리시큐', url: 'https://www.dailysecu.com/rss/allArticle.xml' },
  { id: 'thn', label: 'THN', url: 'https://feeds.feedburner.com/TheHackersNews' },
];
const KST = 9 * 3_600_000;
const PER_SOURCE = 5;

const field = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]).replace(/\s+/g, ' ').trim() : '';
};

// "2026-10-30", "2026-11-01 16:54:47"(시간대 없음 = 한국 시간), RFC 822 날짜를 모두 받는다
function parseDate(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - KST;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

async function fetchSource(src) {
  const res = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0 (URIGG site)' } });
  if (!res.ok) throw new Error(`${src.id} ${res.status}`);
  const xml = await res.text();
  // 기사가 많은 곳이 목록을 다 차지하지 않도록 곳마다 최신 몇 건만
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, PER_SOURCE).map(([, it]) => ({
    source: src.label,
    title: field(it, 'title'),
    link: field(it, 'link'),
    at: parseDate(field(it, 'pubDate')),
  }));
}

export async function fetchNews(limit = 15) {
  // 한 곳이 실패해도 나머지는 보여 준다
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((i) => i.title && i.link)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((i) => ({ ...i, date: new Date(i.at).toISOString() }));
  if (!items.length) throw new Error('no news');
  return { fetchedAt: new Date().toISOString(), items };
}
