// 페이지 데이터 — 대시보드(상태·시계·일정·tail·진행도·프로그램)와 tree 출력
// 화면을 움직이는 일은 scenes.js가 한다. 여기서 내용이 바뀌면 'scenes:refresh'를 알린다.
const $ = (s, root = document) => root.querySelector(s);
const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const refresh = () => window.dispatchEvent(new Event('scenes:refresh'));

// 한국 시간으로 "2026-10-06 15:57"
const stamp = (iso) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const get = (t) => p.find((x) => x.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
};

// 서버 함수 → 실패하면 저장해 둔 스냅샷
// 응답 모양이 바뀌면 숫자를 올린다 (엣지 캐시를 새로 쓰게 하려고)
const API_VERSION = 4;
async function load(name) {
  for (const url of [`/api/${name}?v=${API_VERSION}`, `data/${name}.json`]) {
    try {
      const res = await fetch(url);
      if (res.ok && res.headers.get('content-type')?.includes('json')) return await res.json();
    } catch {}
  }
  return null;
}

/* ── 상단 바 ─────────────────────────────── */
const topBar = $('.top');
const onScroll = () => topBar.classList.toggle('is-stuck', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ── 첫 화면 상태 한 줄 ───────────────────── */
const DAY = 86_400_000;
const kstDay = (t) => Math.floor((t + 9 * 3_600_000) / DAY);
const ago = (iso) => {
  const d = kstDay(Date.now()) - kstDay(new Date(iso).getTime());
  if (d <= 0) return '오늘';
  if (d === 1) return '어제';
  if (d < 60) return `${d}일 전`;
  return stamp(iso).slice(0, 7).replace('-', '.');
};
function setStatus(id, iso) {
  if (iso) $('#' + id).textContent = `${ago(iso)} · ${stamp(iso).slice(5, 10)}`;
}
const todayLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
$('#st-today').textContent = todayLabel;

// 상태줄의 시계: 한국 시간, 1초마다
const clock = $('#st-clock');
const clockFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const tick = () => { clock.textContent = clockFmt.format(new Date()); };
tick();
setInterval(tick, 1000);
$('#today-date').textContent = todayLabel;

/* ── 블로그: 대시보드의 tail 로그 ─────────── */
function renderBlog(data) {
  $('#tail').innerHTML = data.posts.slice(0, 5).map((p, i) => `
    <li style="--i:${i}"><time datetime="${p.date}">${stamp(p.date).slice(5)}</time><span class="lvl">INFO</span><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a></li>`).join('');
  setStatus('st-post', data.posts[0]?.date);
}

/* ── security.log: tree 출력 ─────────────── */
const sizeLabel = (b) => (b == null ? 'dir' : b >= 1024 ? `${(b / 1024).toFixed(1)}K` : `${b}B`);

function renderGithub(data) {
  const { repo, groups, release } = data;
  const written = groups.map((g) => ({ ...g, done: g.entries.filter((e) => e.url) }));
  const total = written.reduce((n, g) => n + g.done.length, 0);
  const bytes = written.reduce((n, g) => n + g.done.reduce((m, e) => m + (e.size || 0), 0), 0);

  $('#repo-total').dataset.target = total;
  $('#repo-total').textContent = total;
  // 시리즈별 진행도: 쓴 글 ■, 남은 자리 □
  $('#progress').innerHTML = written.map((g) => {
    const todo = g.entries.length - g.done.length;
    const cells = '■'.repeat(g.done.length) + '□'.repeat(todo || (g.done.length ? 0 : 1));
    // 번호가 붙는 연재(리눅스·네트워크)만 다음 편 번호를 쓴다
    const series = /리눅스|네트워크/.test(g.name);
    const next = !g.done.length ? '준비 중' : !todo ? 'done' : series ? `next #${g.done.length + 1}` : '진행 중';
    return `<li><span class="progress__name">${esc(g.name)}</span><span class="progress__cells" aria-hidden="true">${cells}</span><span class="progress__next">${g.done.length}편 · ${next}</span></li>`;
  }).join('');
  setStatus('st-push', repo.pushedAt);
  $('#repo-foot').textContent = `${Math.round(bytes / 1024)} KB · last push ${stamp(repo.pushedAt)}`;

  const row = (branch, name, size, cls = '', url = '') => {
    const inner = `<span class="br">${branch}</span><span class="nm">${esc(name)}</span><span class="sz">${size}</span>`;
    return url
      ? `<a class="term__row ${cls}" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<p class="term__row ${cls}">${inner}</p>`;
  };
  let dirs = 0, files = 0;
  const rows = [row('', `${repo.name}/`, `stars ${repo.stars}`, 'term__row--dir', repo.url)];
  written.forEach((g, gi) => {
    const lastG = gi === written.length - 1;
    dirs++;
    rows.push(row(lastG ? '└── ' : '├── ', `${g.name}${g.en ? ` (${g.en})` : ''}/`, '', 'term__row--dir'));
    const pad = lastG ? '    ' : '│   ';
    const list = g.entries.length ? g.entries : [{ title: '작성 예정', url: null }];
    list.forEach((e, ei) => {
      const br = pad + (ei === list.length - 1 ? '└── ' : '├── ');
      if (e.url) { files++; rows.push(row(br, e.title, sizeLabel(e.size), '', e.url)); }
      else rows.push(row(br, e.title, 'todo', 'term__row--plan'));
    });
  });
  rows.push(row('', ' ', ''), row('', `${dirs} directories, ${files} files`, ''), row('', '$ ', '', 'term__row--cursor'));
  $('#tree').insertAdjacentHTML('beforeend', rows.join(''));

  if (release) {
    $('#app-ver').textContent = `${release.tag} · ${stamp(release.publishedAt).slice(5, 10)}`;
    $('#st-app').textContent = release.tag;
  }
  renderActivity(data.activity || {});
  refresh();
}

/* ── 잔디: 지난 26주 커밋 ─────────────────── */
function renderActivity(days) {
  const WEEKS = 26, DAY = 86_400_000;
  const kstKey = (ms) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);
  const now = Date.now();
  const todayDow = new Date(now + 9 * 3_600_000).getUTCDay();
  // 맨 오른쪽 열이 이번 주가 되도록, 26주 전 일요일부터 오늘까지
  const start = now - (todayDow + (WEEKS - 1) * 7) * DAY;
  let total = 0;
  const cells = [];
  for (let i = 0; i <= (WEEKS - 1) * 7 + todayDow; i++) {
    const key = kstKey(start + i * DAY);
    const n = days[key] || 0;
    total += n;
    const lv = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3;
    cells.push(`<i class="lv${lv}" title="${key} · ${n} commits"></i>`);
  }
  $('#activity').innerHTML = cells.join('');
  $('#activity-total').textContent = total;
}

/* ── 보안 뉴스 ──────────────────────────── */
function renderNews(data) {
  $('#panel-news').innerHTML = data.items.map((n) => `
    <li><a href="${esc(n.link)}" target="_blank" rel="noopener"><span class="news__src">${esc(n.source)}</span><span class="news__title">${esc(n.title)}</span><time datetime="${n.date}">${ago(n.date)}</time></a></li>`).join('');
}

/* ── 앱처럼 설치 (PWA) ───────────────────── */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

load('blog').then((d) => d?.posts?.length && renderBlog(d));
load('github').then((d) => d?.groups && renderGithub(d));
load('news').then((d) => d?.items?.length && renderNews(d));
