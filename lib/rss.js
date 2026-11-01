// Tistory RSS → 사이트에서 쓰는 글 목록 JSON
export const BLOG_URL = 'https://urigg-security.tistory.com';
export const RSS_URL = `${BLOG_URL}/rss`;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', rarr: '→', larr: '←', hellip: '…' };

export function decode(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const pick = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]).trim() : '';
};

// "보안/시스템 · 리눅스" → { group: '보안', series: '시스템 · 리눅스' }
function splitCategory(raw) {
  const [group, ...rest] = raw.split('/');
  return { group: group || '기타', series: rest.join('/') || group || '기타' };
}

export function parseRss(xml, limit = 20) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
  return items.map(([, it]) => {
    // 요약에서 빼는 것: 블로그 링크 카드(opengraph)와 "이전 편 : [...]" 머리말 문단
    const html = decode(pick(it, 'description'))
      .replace(/<figure[^>]*data-ke-type="opengraph"[\s\S]*?<\/figure>/g, '')
      .replace(/<p[^>]*>\s*이전\s*편[\s\S]*?<\/p>/g, '');
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const category = (it.match(/<category>([\s\S]*?)<\/category>/) || [, ''])[1];
    // 티스토리는 카테고리를 두 번 인코딩한다 (&amp;middot;)
    const { group, series } = splitCategory(decode(decode(category)).trim());
    const thumb = (html.match(/<img[^>]+src="([^"]+)"/) || [])[1] || null;
    return {
      title: pick(it, 'title'),
      link: pick(it, 'link'),
      date: new Date(pick(it, 'pubDate')).toISOString(),
      group,
      series,
      summary: text.length > 160 ? text.slice(0, 158).trimEnd() + '…' : text,
      thumb,
    };
  });
}

export async function fetchBlog() {
  const res = await fetch(RSS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (URIGG site)' } });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  return { source: BLOG_URL, fetchedAt: new Date().toISOString(), posts: parseRss(await res.text()) };
}
