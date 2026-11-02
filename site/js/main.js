// 페이지 데이터 — 대시보드(상태·시계·tail·알림·뉴스·프로그램)와 tree 출력·잔디
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

/* ── 오로라: 아주 느리게(초당 1~2px) 흐르므로 초당 8번만 옮긴다.
   CSS 애니메이션은 초당 60번 그려서, 위에 겹친 유리 칸들의 흐림을 매번 다시 계산해 GPU를 많이 쓴다.
   [주기(초), 시작 x(vw), y(vh), 크기, 끝 x, y, 크기] — 끝까지 갔다가 되돌아온다 */
const AURORA = [[58, 0, 0, 1, -5, 4, 1.06], [67, 0, 0, 1.04, 4, -3, 1], [74, -4, 3, 0.96, 5, -4, 1.05]];
const auroraSpans = document.querySelectorAll('.aurora span');
if (auroraSpans.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const t0 = performance.now();
  const drift = () => {
    if (document.hidden) return;
    const s = (performance.now() - t0) / 1000;
    auroraSpans.forEach((el, i) => {
      const [dur, x0, y0, k0, x1, y1, k1] = AURORA[i];
      const p = (s / dur) % 2, e = (1 - Math.cos(Math.PI * (p < 1 ? p : 2 - p))) / 2; // ease-in-out
      el.style.transform = `translate3d(${x0 + (x1 - x0) * e}vw, ${y0 + (y1 - y0) * e}vh, 0) scale(${k0 + (k1 - k0) * e})`;
    });
  };
  drift();
  setInterval(drift, 125);
}

/* ── 상단 바 유리 렌즈 (크롬·엣지만: 배경 필터에 SVG를 쓸 수 있는 브라우저) ──
   가장자리 띠에서 뒤 화면을 안쪽으로 당겨 굴절처럼 보이게 하고, 빨강·초록·파랑을 조금씩 다르게 당겨 프리즘처럼 갈라지게 한다. */
if (window.chrome && !matchMedia('(prefers-reduced-transparency: reduce)').matches) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  svg.innerHTML = `<filter id="top-lens" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feImage result="map" preserveAspectRatio="none"/>
    ${[['r', 1, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['g', 0.9, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['b', 0.8, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']]
      .map(([c, k, m]) => `<feDisplacementMap in="SourceGraphic" in2="map" data-k="${k}" xChannelSelector="R" yChannelSelector="G"/><feColorMatrix type="matrix" values="${m}" result="${c}"/>`).join('')}
    <feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>
  </filter>`;
  document.body.append(svg);
  const filter = svg.querySelector('filter'), img = svg.querySelector('feImage');
  const BAND = 20, SCALE = 46;
  // 알약 모양의 가장자리에서 안쪽으로 얼마나 들어왔는지(거리)와 바깥 방향(법선)으로 변위 지도를 그린다.
  // 크롬은 이 필터를 화면의 실제 픽셀 단위로 계산하므로, 배율(devicePixelRatio)만큼 키워서 만들어야 글자가 뭉개지지 않는다.
  const build = () => {
    const dpr = devicePixelRatio || 1;
    const w = topBar.offsetWidth, h = topBar.offsetHeight;
    if (!w || !h) return;
    const W = Math.round(w * dpr), H = Math.round(h * dpr), r = h / 2;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), data = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = (x + 0.5) / dpr - w / 2, py = (y + 0.5) / dpr - h / 2;
      const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
      let nx, ny, depth;
      if (qx > 0) { const l = Math.hypot(qx, Math.max(qy, 0)) || 1; depth = r - l; nx = Math.sign(px) * qx / l; ny = qy > 0 ? Math.sign(py) * qy / l : 0; }
      else { depth = r - Math.abs(py); nx = 0; ny = Math.sign(py); }
      const t = Math.max(0, 1 - depth / BAND), mag = t * t;
      const i = (y * W + x) * 4;
      data.data[i] = 128 - nx * mag * 127;
      data.data[i + 1] = 128 - ny * mag * 127;
      data.data[i + 2] = 128; data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    for (const el of [filter, img]) { el.setAttribute('x', 0); el.setAttribute('y', 0); el.setAttribute('width', W); el.setAttribute('height', H); }
    img.setAttribute('href', cv.toDataURL());
    svg.querySelectorAll('feDisplacementMap').forEach((d) => d.setAttribute('scale', SCALE * dpr * d.dataset.k));
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
/* ── Log 칸 탭: 알림(먼저) ↔ Log ──────────────
   제목 뒤의 유리 알약이 고른 탭으로 미끄러져 간다. 칸 내용은 그대로 바뀐다. */
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
const pill = $('.tabs__pill');
const movePill = () => {
  const on = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
  if (!on || !pill) return;
  pill.style.width = `${on.offsetWidth}px`;
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
};
const showTab = (tab) => {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  }
  movePill();
  watchRead();
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => showTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    showTab(next); next.focus();
  });
});
addEventListener('resize', movePill);
document.fonts?.ready.then(movePill);

/* ── 주요 알림: 여러 곳(블로그·릴리스·뉴스·D-day·캘린더)에서 모아 한 목록으로 ──
   각 출처가 window.alerts.set(이름, [{ text, href?, time?, icon?, warn?, at? }])로 자기 몫을 바꾼다.
   빨간 숫자는 아직 안 읽은 중요 알림 수. 알림 목록이 화면에 2초 보이면 읽은 것으로 친다(이 브라우저에 기억). */
const alertBox = $('#pane-alerts'), alertCount = $('#alert-count');
const alertSources = {};
const SEEN = 'urigg-alerts-seen';
let seen = new Set();
try { seen = new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch {}
let warnKeys = [];
const drawCount = () => {
  const unread = warnKeys.filter((k) => !seen.has(k)).length;
  if (unread) { alertCount.textContent = unread; alertCount.hidden = false; alertCount.classList.remove('is-read'); movePill(); }
  else if (!alertCount.hidden) {
    alertCount.classList.add('is-read');
    setTimeout(() => { if (alertCount.classList.contains('is-read')) { alertCount.hidden = true; movePill(); } }, 400);
  }
};
const markRead = () => {
  warnKeys.forEach((k) => seen.add(k));
  try { localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-200))); } catch {}
  drawCount();
};
let readTimer = 0, alertsVisible = false;
// 바탕화면 모드에서는 화면이 늘 보이므로, 알림 칸에 마우스를 올렸을 때만 읽은 것으로 친다
const WALL = document.documentElement.classList.contains('wall');
let alertsHovered = false;
const watchRead = () => {
  clearTimeout(readTimer);
  if (alertsVisible && !alertBox.hidden && !document.hidden && (!WALL || alertsHovered)) readTimer = setTimeout(markRead, 2000);
};
alertBox.closest('.tile').addEventListener('pointerenter', () => { alertsHovered = true; watchRead(); });
alertBox.closest('.tile').addEventListener('pointerleave', () => { alertsHovered = false; watchRead(); });
new IntersectionObserver(([e]) => { alertsVisible = e.isIntersecting; watchRead(); }, { threshold: 0.5 }).observe(alertBox.closest('.tile'));
document.addEventListener('visibilitychange', watchRead);

window.alerts = {
  set(source, items) {
    alertSources[source] = items;
    const all = Object.values(alertSources).flat().sort((a, b) => (!!b.warn - !!a.warn) || (a.at ?? 0) - (b.at ?? 0));
    alertBox.innerHTML = all.length
      ? all.map((a) => {
          const inner = `<b>${a.icon || '·'}</b><span>${esc(a.text)}</span><time>${esc(a.time || '')}</time>`;
          return `<li class="${a.warn ? 'is-warn' : ''}">${a.href ? `<a href="${esc(a.href)}" target="_blank" rel="noopener">${inner}</a>` : `<p>${inner}</p>`}</li>`;
        }).join('')
      : '<li class="is-empty">새 알림이 없어요</li>';
    warnKeys = all.filter((a) => a.warn).map((a) => a.text);
    drawCount();
    watchRead();
  },
};
window.alerts.set('init', []);
showTab(tabs[0]);
const daysAgo = (iso) => kstDay(Date.now()) - kstDay(new Date(iso).getTime());

function renderBlog(data) {
  $('#tail').innerHTML = data.posts.slice(0, 5).map((p, i) => `
    <li style="--i:${i}"><time datetime="${p.date}">${stamp(p.date).slice(5)}</time><span class="lvl">INFO</span><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a></li>`).join('');
  setStatus('st-post', data.posts[0]?.date);
  const last = data.posts[0];
  if (!last) return;
  const d = daysAgo(last.date);
  window.alerts.set('blog', d <= 2
    ? [{ icon: '¶', text: `새 글: ${last.title}`, time: ago(last.date), href: last.link }]
    : d >= 14 ? [{ icon: '¶', text: `블로그에 ${d}일째 새 글이 없어요`, time: '새 글 쓰기', href: 'https://urigg-security.tistory.com/manage/newpost' }] : []);
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
    if (daysAgo(release.publishedAt) <= 3) window.alerts.set('release', [{ icon: '⬇', text: `코워크 캘린더 ${release.tag} 나왔어요`, time: ago(release.publishedAt), href: release.url }]);
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
  $('#activity').innerHTML = $('#dash-activity').innerHTML = cells.join('');
  $('#activity-total').textContent = $('#dash-total').textContent = total;
  $('#activity-days').textContent = `${Object.entries(days).filter(([k, n]) => n > 0 && k >= kstKey(start)).length}일`;
  // 오늘(아직 안 했으면 어제)부터 거꾸로 이어진 날 수
  let streak = 0;
  for (let d = days[kstKey(now)] ? 0 : 1; days[kstKey(now - d * DAY)]; d++) streak++;
  $('#activity-streak').textContent = $('#dash-streak').textContent = `${streak}일`;
  // 이번 주(일요일부터 오늘까지) 커밋
  let week = 0;
  for (let d = 0; d <= todayDow; d++) week += days[kstKey(now - d * DAY)] || 0;
  $('#dash-week').textContent = week;
}

/* ── 보안 뉴스 ──────────────────────────── */
// 꼭 볼 보안 뉴스: 최근 이틀 안에, 제목에 긴급·제로데이·치명적·CVSS 9~10 같은 말이 있는 기사
const URGENT = /긴급|제로데이|0-?day|zero-day|critical|치명|CVSS\s*(9|10)|actively exploited|악용 중/i;
function renderNews(data) {
  window.alerts.set('news', data.items
    .filter((n) => daysAgo(n.date) <= 2 && URGENT.test(n.title))
    .slice(0, 4)
    .map((n) => ({ icon: '!', warn: true, text: `${n.source} · ${n.title}`, time: ago(n.date), href: n.link })));
  $('#panel-news').innerHTML = data.items.map((n) => `
    <li><a href="${esc(n.link)}" target="_blank" rel="noopener"><span class="news__src">${esc(n.source)}</span><span class="news__title">${esc(n.title)}</span><time datetime="${n.date}">${ago(n.date)}</time></a></li>`).join('');
}

/* ── 바탕화면 모드: 며칠씩 켜져 있으므로 30분마다 새로 불러와 뉴스·글·알림·날짜를 맞춘다 ── */
// 실제 흐른 시간으로 잰다: Lively가 일시정지하면 타이머도 멈추므로, 돌아왔을 때 30분이 지났으면 바로 새로고침
if (WALL) {
  const loadedAt = Date.now();
  const stale = () => { if (!document.hidden && Date.now() - loadedAt > 30 * 60_000) location.reload(); };
  setInterval(stale, 30_000);
  document.addEventListener('visibilitychange', stale);
  addEventListener('focus', stale);
  addEventListener('pageshow', stale);
}

/* ── 앱처럼 설치 (PWA) ───────────────────── */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

load('blog').then((d) => d?.posts?.length && renderBlog(d));
load('github').then((d) => d?.groups && renderGithub(d));
load('news').then((d) => d?.items?.length && renderNews(d));
