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
const API_VERSION = 5;
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

/* ── 상단 바 유리 렌즈 (크롬·엣지만: 배경 필터에 SVG를 쓸 수 있는 브라우저) ──
   가장자리 띠에서 뒤 화면을 안쪽으로 당겨 굴절처럼 보이게 하고, 빨강·초록·파랑을 조금씩 다르게 당겨 프리즘처럼 갈라지게 한다. */
if (window.chrome && !matchMedia('(prefers-reduced-transparency: reduce)').matches) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  svg.innerHTML = `<filter id="top-lens" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feImage result="map" preserveAspectRatio="none"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="src"/>
    ${[['r', 1, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['g', 0.9, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['b', 0.8, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']]
      .map(([c, k, m]) => `<feDisplacementMap in="src" in2="map" data-k="${k}" xChannelSelector="R" yChannelSelector="G"/><feColorMatrix type="matrix" values="${m}" result="${c}"/>`).join('')}
    <feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>
  </filter>`;
  document.body.append(svg);
  const filter = svg.querySelector('filter'), img = svg.querySelector('feImage');
  const BAND = 20, SCALE = 46;
  // 알약 모양의 가장자리에서 안쪽으로 얼마나 들어왔는지(거리)와 바깥 방향(법선)으로 변위 지도를 그린다
  const build = () => {
    const w = Math.round(topBar.offsetWidth), h = Math.round(topBar.offsetHeight);
    if (!w || !h) return;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), data = ctx.createImageData(w, h), r = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
      let nx, ny, depth;
      if (qx > 0) { const l = Math.hypot(qx, qy > 0 ? qy : 0) || 1; depth = r - Math.hypot(qx, Math.max(qy, 0)); nx = Math.sign(px) * qx / l; ny = qy > 0 ? Math.sign(py) * qy / l : 0; }
      else { depth = r - Math.abs(py); nx = 0; ny = Math.sign(py); }
      const t = Math.max(0, 1 - depth / BAND), mag = t * t;
      const i = (y * w + x) * 4;
      data.data[i] = 128 - nx * mag * 127;
      data.data[i + 1] = 128 - ny * mag * 127;
      data.data[i + 2] = 128; data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    for (const el of [filter, img]) { el.setAttribute('x', 0); el.setAttribute('y', 0); el.setAttribute('width', w); el.setAttribute('height', h); }
    img.setAttribute('href', cv.toDataURL());
    svg.querySelectorAll('feDisplacementMap').forEach((d) => d.setAttribute('scale', SCALE * d.dataset.k));
  };
  build();
  addEventListener('resize', build);
  document.documentElement.classList.add('lens-on');
}

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
  $('#activity-days').textContent = `${Object.entries(days).filter(([k, n]) => n > 0 && k >= kstKey(start)).length}일`;
  // 오늘(아직 안 했으면 어제)부터 거꾸로 이어진 날 수
  let streak = 0;
  for (let d = days[kstKey(now)] ? 0 : 1; days[kstKey(now - d * DAY)]; d++) streak++;
  $('#activity-streak').textContent = `${streak}일`;
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
