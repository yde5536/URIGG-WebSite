// GitHub API → security.log 목차 + 코워크 캘린더 최신 릴리스
export const OWNER = 'yde5536';
export const LOG_REPO = 'URIGG-security.log';
export const APP_REPO = 'URIGG-ClaudeCalender';

async function gh(path, token, accept = 'application/vnd.github+json') {
  const headers = { Accept: accept, 'User-Agent': 'URIGG-site' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${path} ${res.status}`);
  return accept.endsWith('raw') ? res.text() : res.json();
}

// README의 "### 리눅스 (Linux)" 아래 "- [[제목]](경로)" 줄들을 그룹별로 모은다.
export function parseReadme(md) {
  const groups = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^###\s+(.+?)\s*(?:\((.+)\))?\s*$/);
    if (h) {
      cur = { name: h[1], en: h[2] || '', entries: [], planned: false };
      groups.push(cur);
      continue;
    }
    if (!cur) continue;
    const link = line.match(/^-\s*\[\[(.+?)\]\]\((.+?)\)/);
    if (link) {
      cur.entries.push({ title: link[1].replace(/^#\d+\s*-\s*/, ''), path: decodeURIComponent(link[2]) });
    } else if (/^-\s*.*작성 예정/.test(line)) {
      cur.entries.push({ title: '다음 글', path: null });
    } else if (/^작성 예정/.test(line.trim())) {
      cur.planned = true;
    }
  }
  return groups.filter((g) => g.entries.length || g.planned);
}

// security.log 커밋을 날짜별로 센다 (최대 300개)
async function commitDays(since, token) {
  const days = {};
  for (let page = 1; page <= 3; page++) {
    const list = await gh(`/repos/${OWNER}/${LOG_REPO}/commits?since=${since}&per_page=100&page=${page}`, token);
    for (const c of list) {
      const d = new Date(new Date(c.commit.author.date).getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
      days[d] = (days[d] || 0) + 1;
    }
    if (list.length < 100) break;
  }
  return days;
}

// 계정 전체(모든 저장소)의 날짜별 기여 수 — GitHub 프로필 잔디와 같은 값. GraphQL이라 토큰이 필요하다.
async function contributionDays(token) {
  if (!token) throw new Error('no token');
  const query = `query { user(login: "${OWNER}") { contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'URIGG-site' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!res.ok || !weeks) throw new Error(`GitHub graphql ${res.status}`);
  const days = {};
  for (const w of weeks) for (const d of w.contributionDays) if (d.contributionCount) days[d.date] = d.contributionCount;
  return days;
}

export async function fetchGithub(token) {
  const repo = await gh(`/repos/${OWNER}/${LOG_REPO}`, token);
  const since = new Date(Date.now() - 26 * 7 * 86_400_000).toISOString();
  const [readme, tree, release, commits] = await Promise.all([
    gh(`/repos/${OWNER}/${LOG_REPO}/readme`, token, 'application/vnd.github.raw'),
    gh(`/repos/${OWNER}/${LOG_REPO}/git/trees/${repo.default_branch}?recursive=1`, token),
    gh(`/repos/${OWNER}/${APP_REPO}/releases/latest`, token).catch(() => null),
    // 전체 저장소 잔디, 안 되면 security.log 커밋만
    contributionDays(token).catch(() => commitDays(since, token)).catch(() => ({})),
  ]);
  const sizes = Object.fromEntries(tree.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t.size]));
  const base = `${repo.html_url}/tree/${repo.default_branch}/`;
  const groups = parseReadme(readme).map((g) => ({
    ...g,
    entries: g.entries.map((e) => {
      if (!e.path) return { title: e.title, url: null, size: null };
      const path = e.path.replace(/\/$/, '');
      return { title: e.title, url: base + encodeURI(path), size: sizes[path] ?? null };
    }),
  }));
  return {
    fetchedAt: new Date().toISOString(),
    repo: {
      name: repo.name,
      url: repo.html_url,
      description: repo.description,
      stars: repo.stargazers_count,
      pushedAt: repo.pushed_at,
    },
    groups,
    // 날짜별 커밋(기여) 수 — Notes 옆 잔디
    activity: commits,
    release: release && {
      tag: release.tag_name,
      publishedAt: release.published_at,
      url: release.html_url,
    },
  };
}
