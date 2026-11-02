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
/* ── 칸 제목 탭: 알림 ↔ Log ↔ CTF, Security News ↔ KEV, Shortcuts ↔ Network ──
   제목 뒤의 유리 알약이 고른 탭으로 미끄러져 간다. 칸 내용은 그대로 바뀐다.
   제목 줄의 data-pane="패널id …" 요소(오른쪽 링크 등)는 그 패널이 보일 때만 보인다. */
const tabGroups = [...document.querySelectorAll('.tabs')].map((group) => {
  const tabs = [...group.querySelectorAll('[role="tab"]')], pill = group.querySelector('.tabs__pill');
  const head = group.closest('.tile__head');
  const move = () => {
    const on = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    if (!on || !pill) return;
    pill.style.width = `${on.offsetWidth}px`;
    pill.style.transform = `translateX(${on.offsetLeft}px)`;
  };
  const show = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    }
    head.querySelectorAll('[data-pane]').forEach((el) => { el.hidden = !el.dataset.pane.split(' ').some((id) => !$('#' + id).hidden); });
    move();
    watchRead();
    group.dispatchEvent(new CustomEvent('tabchange', { detail: tab.id }));
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      show(next); next.focus();
    });
  });
  return move;
});
const movePill = () => tabGroups.forEach((move) => move());
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
movePill();
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
  // 3일 전(달력 날짜 기준)까지만 보여 준다
  data = { ...data, items: data.items.filter((n) => daysAgo(n.date) <= 3) };
  window.alerts.set('news', data.items
    .filter((n) => daysAgo(n.date) <= 2 && URGENT.test(n.title))
    .slice(0, 4)
    .map((n) => ({ icon: '!', warn: true, text: `${n.source} · ${n.title}`, time: ago(n.date), href: n.link })));
  $('#panel-news').innerHTML = data.items.map((n) => `
    <li><a href="${esc(n.link)}" target="_blank" rel="noopener"><span class="news__src">${esc(n.source)}</span><span class="news__title">${esc(n.title)}</span><time datetime="${n.date}">${ago(n.date)}</time></a></li>`).join('') || '<li class="news__empty">최근 3일 안에 올라온 뉴스가 없어요.</li>';
}

/* ── 실제 악용 중인 취약점 (CISA KEV, 뉴스 칸의 KEV 탭) ─────── */
function renderKev(data) {
  $('#pane-kev').innerHTML = data
    ? data.items.map((v) => `
    <li><a href="https://nvd.nist.gov/vuln/detail/${esc(v.cve)}" target="_blank" rel="noopener" title="${esc(v.name)}${v.ransomware ? ' · 랜섬웨어에 쓰인 적 있음' : ''}"><span class="news__src">${esc(v.vendor)}</span><span class="news__title">${v.ransomware ? '<b class="kev__rw">랜섬웨어</b> ' : ''}${esc(v.cve)} · ${esc(v.product)}</span><time datetime="${v.added}">${ago(`${v.added}T12:00:00-05:00`)}</time></a></li>`).join('')
    : '<li class="news__empty">CISA 목록을 불러오지 못했어요.</li>';
}

/* ── 유명 취약점 해설 (뉴스 칸의 Vuln 탭) ─────────────────
   data/vulns.json에서 하나씩. '다음 취약점 ›'으로 넘기고, 본 위치는 이 브라우저에만 기억한다(없으면 날짜로 시작) */
const VULN_AT = 'urigg-vuln-index';
fetch('data/vulns.json').then((r) => r.json()).then((list) => {
  let i = kstDay(Date.now());
  try { const saved = localStorage.getItem(VULN_AT); if (saved !== null && Number.isInteger(+saved)) i = +saved; } catch {}
  const show = () => {
    const n = ((i % list.length) + list.length) % list.length, v = list[n];
    $('#vuln-alias').textContent = v.alias;
    $('#vuln-cve').textContent = v.cve;
    $('#vuln-target').textContent = v.target;
    $('#vuln-type').textContent = v.type;
    $('#vuln-year').textContent = `${v.year}년`;
    $('#vuln-cvss').textContent = v.cvss != null ? v.cvss.toFixed(1) : '—';
    $('#vuln-desc').textContent = v.desc;
    const sec = (title, inner) => `<section><h3>${title}</h3>${inner}</section>`;
    $('#vuln-more').innerHTML = [
      v.flow?.length && sec('어떻게 터지나', `<ol class="vuln__flow">${v.flow.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`),
      v.ex && sec('예시', `<code class="vuln__ex">${esc(v.ex)}</code>`),
      v.fix?.length && sec('막는 법', `<ul class="vuln__fix">${v.fix.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`),
      v.cwe && sec('분류', `<p>${esc(v.cwe)}</p>`),
      sec('더 보기', `<p class="vuln__links"><a class="link" href="https://nvd.nist.gov/vuln/detail/${esc(v.cve)}" target="_blank" rel="noopener">NVD ↗</a><a class="link" href="https://www.cve.org/CVERecord?id=${esc(v.cve)}" target="_blank" rel="noopener">CVE.org ↗</a></p>`),
    ].filter(Boolean).join('');
    $('.vuln__body').scrollTop = 0;
    $('#vuln-count').textContent = `${n + 1} / ${list.length}`;
  };
  show();
  $('#vuln-next').addEventListener('click', () => {
    i += 1;
    try { localStorage.setItem(VULN_AT, String(i % list.length)); } catch {}
    show();
  });
}).catch(() => { $('#vuln-alias').textContent = '취약점 해설을 불러오지 못했어요'; });

/* ── 다가오는 CTF (CTFtime, 알림 칸의 CTF 탭) ─────────── */
const ctfWhen = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
};
function renderCtf(data) {
  const now = Date.now();
  const rows = (data?.events || []).filter((e) => Date.parse(e.finish) > now).map((e) => {
    const s = Date.parse(e.start), f = Date.parse(e.finish), live = s <= now;
    const hours = Math.round((f - s) / 3_600_000);
    const len = hours % 24 === 0 ? `${hours / 24}일` : `${hours}시간`;
    const when = live ? `진행 중 · ${Math.ceil((f - now) / 3_600_000)}시간 남음` : `${ctfWhen(s)} · ${len}`;
    return `<li${live ? ' class="is-warn"' : ''}><a href="${esc(e.url)}" target="_blank" rel="noopener" title="${esc(e.format || '')} · ${e.onsite ? esc(e.location || '현장') : '온라인'} · ${len}"><b>${live ? '●' : '▸'}</b><span>${esc(e.title)}</span><time>${when}</time></a></li>`;
  });
  $('#pane-ctf').innerHTML = rows.join('') || `<li class="is-empty">${data ? '45일 안에 예정된 CTF가 없어요.' : 'CTF 일정을 불러오지 못했어요.'}</li>`;
}

/* ── 내 네트워크 상태 (Shortcuts 칸의 Network 탭) ─────────
   보는 사람 자신의 IP라 스냅샷 없이 늘 /api/net에 직접 묻고, 탭을 볼 때만 부른다.
   VPN·프록시는 추정: 브라우저 시간대와 IP 위치의 시간대가 다르거나, 통신사가 호스팅·VPN 회사면 "사용 중"으로 본다. */
const VPNISH = /cloud|hosting|server|data ?cent|vpn|proxy|amazon|aws|google|microsoft|azure|digitalocean|linode|akamai|ovh|hetzner|vultr|m247|datacamp|choopa|leaseweb|contabo|oracle|proton|nord|mullvad|express|surfshark|private internet/i;
const netPane = $('#pane-net'), netBox = $('#net-info');
let netAt = 0;
async function renderNet() {
  netAt = Date.now();
  const row = (k, v, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><dt>${k}</dt><dd>${v}</dd></div>`;
  if (!navigator.onLine) { netBox.innerHTML = row('상태', '오프라인이에요'); return; }
  let d = null;
  try {
    const res = await fetch('/api/net', { cache: 'no-store' });
    if (res.ok && res.headers.get('content-type')?.includes('json')) d = await res.json();
  } catch {}
  if (!d?.ip) { netBox.innerHTML = row('상태', '온라인') + row('공인 IP', '불러오지 못했어요'); return; }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzOff = d.timezone && tz !== d.timezone, host = VPNISH.test(d.isp || '');
  const conn = navigator.connection;
  netBox.innerHTML = [
    row('공인 IP', `<button type="button" class="net__ip" title="눌러서 복사">${esc(d.ip)}</button>`, 'net__main'),
    row('통신사', `${esc(d.isp || '—')}${d.asn ? ` <small>AS${d.asn}</small>` : ''}`),
    row('위치', esc([d.city, d.country].filter(Boolean).join(', ') || '—')),
    row('VPN·프록시', tzOff || host ? '사용 중 (추정)' : '안 씀 (추정)', tzOff || host ? 'is-warn' : ''),
    row('연결', esc([d.http, d.tls, d.colo && `Cloudflare ${d.colo}`].filter(Boolean).join(' · '))),
    conn?.effectiveType ? row('브라우저', esc(`${conn.effectiveType.toUpperCase()} · 지연 ${conn.rtt}ms · ${conn.downlink}Mbps`)) : '',
  ].join('');
  netBox.querySelector('[class="is-warn"] dd')?.setAttribute('title', [tzOff && `브라우저 시간대(${tz})와 IP 위치 시간대(${d.timezone})가 달라요`, host && '통신사가 호스팅·VPN 회사예요'].filter(Boolean).join(' · '));
}
netBox.addEventListener('click', async (e) => {
  const ip = e.target.closest('.net__ip');
  if (!ip) return;
  try { await navigator.clipboard.writeText(ip.textContent); ip.dataset.copied = ''; setTimeout(() => delete ip.dataset.copied, 1200); } catch {}
});
$('#net-refresh').addEventListener('click', renderNet);
$('#tab-net').closest('.tabs').addEventListener('tabchange', (e) => { if (e.detail === 'tab-net' && Date.now() - netAt > 60_000) renderNet(); });
const netVisible = () => !netPane.hidden && !document.hidden;
addEventListener('online', () => netVisible() && renderNet());
addEventListener('offline', () => netVisible() && renderNet());
setInterval(() => netVisible() && Date.now() - netAt > 5 * 60_000 && renderNet(), 60_000);

/* ── 지연 시간 꺾은선 (바탕화면 Network 탭 아래) ─────────
   매분 0초·30초(시계 기준)에, 화면이 보일 때만 사이트의 작은 파일을 받아 오는 왕복 시간을 잰다(서버 함수 안 씀).
   탭을 안 보고 있어도 재 두어야 열었을 때 그래프가 있다. 30분마다 새로고침되므로 기록은 이 브라우저에 저장.
   실패한 측정은 null → 선이 끊긴다. 웹사이트에는 넣지 않는다(바탕화면 전용). */
if (WALL) {
  // LIMIT: 이보다 오래 걸리면 끊김으로 본다. 그보다 훨씬 오래(8초+) 걸렸다면 재는 도중 Lively가 멈췄다 풀린 것이라 버린다
  // (멈춘 시간이 통째로 지연 시간으로 잡혀 134초 같은 값이 들어간 적이 있다)
  const PING_KEY = 'urigg-ping', WINDOW = 30 * 60_000, W = 300, H = 100, LIMIT = 5000, PAUSED = 8000;
  const svg = $('#ping-svg'), tip = $('#ping-tip'), dot = $('#ping-dot'), plot = svg.parentElement;
  let pts = [];
  try { pts = JSON.parse(localStorage.getItem(PING_KEY) || '[]').filter((p) => Date.now() - p.t < WINDOW && (p.ms == null || p.ms < LIMIT)); } catch {}
  const hhmm = (t) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
  let scaleMax = 50;
  const xOf = (t) => ((t - (Date.now() - WINDOW)) / WINDOW) * W;
  const yOf = (ms) => H - 4 - (Math.min(ms, scaleMax) / scaleMax) * (H - 8);
  const draw = () => {
    const ok = pts.filter((p) => p.ms != null).map((p) => p.ms);
    const last = pts[pts.length - 1];
    $('#ping-now').textContent = last ? (last.ms == null ? '끊김' : `${Math.round(last.ms)} ms`) : '— ms';
    // 눈금 최대값: 50ms 단위로 올림 (값이 작아도 50ms)
    scaleMax = Math.max(50, Math.ceil(Math.max(0, ...ok) / 50) * 50);
    $('#ping-max').textContent = `${scaleMax}ms`;
    // 끊긴 곳에서 선을 나눠 그린다
    let d = '', pen = false;
    for (const p of pts) {
      if (p.ms == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${xOf(p.t).toFixed(1)} ${yOf(p.ms).toFixed(1)}`;
      pen = true;
    }
    const gaps = pts.filter((p) => p.ms == null).map((p) => `<line class="ping__gap" x1="${xOf(p.t).toFixed(1)}" x2="${xOf(p.t).toFixed(1)}" y1="0" y2="${H}"/>`).join('');
    svg.innerHTML = `<line class="ping__grid" x1="0" x2="${W}" y1="4" y2="4"/><line class="ping__grid" x1="0" x2="${W}" y1="${H - 4}" y2="${H - 4}"/>${gaps}<path class="ping__line" d="${d}"/><line class="ping__cross" id="ping-cross" x1="0" x2="0" y1="0" y2="${H}" visibility="hidden"/>`;
    const avg = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : 0;
    $('#ping-stats').textContent = ok.length
      ? `최근 30분 · 최저 ${Math.round(Math.min(...ok))} · 평균 ${Math.round(avg)} · 최고 ${Math.round(Math.max(...ok))} ms`
      : '30초마다 재요';
  };
  const ping = async () => {
    if (document.hidden) return;
    let ms = null;
    const at = Date.now(); // 잰 시각은 보낸 순간 (응답이 늦어도 0초·30초에 찍히게)
    if (navigator.onLine) {
      const t0 = performance.now(), ctrl = new AbortController(), kill = setTimeout(() => ctrl.abort(), LIMIT);
      try {
        const res = await fetch(`/images/favicon-32.png?ping=${Date.now()}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
        if (res.ok) ms = performance.now() - t0;
      } catch {}
      clearTimeout(kill);
      if (Date.now() - at > PAUSED) return;
      if (ms != null && ms >= LIMIT) ms = null;
    }
    pts.push({ t: at, ms });
    pts = pts.filter((p) => Date.now() - p.t < WINDOW);
    try { localStorage.setItem(PING_KEY, JSON.stringify(pts)); } catch {}
    draw();
  };
  // 마우스를 올리면 가장 가까운 측정값에 세로선과 말풍선
  plot.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W;
    const near = pts.reduce((best, p) => (Math.abs(xOf(p.t) - x) < Math.abs(xOf(best.t) - x) ? p : best), pts[0]);
    if (!near) return;
    const cross = $('#ping-cross'), px = xOf(near.t);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    tip.textContent = `${hhmm(near.t)} · ${near.ms == null ? '끊김' : `${Math.round(near.ms)}ms`}`;
    tip.hidden = false;
    const left = (px / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 40), r.width - 40)}px`;
    const top = near.ms == null ? r.height / 2 : (yOf(near.ms) / H) * r.height;
    tip.style.top = `${top}px`;
    tip.classList.toggle('is-below', top < 30); // 점이 위쪽이면 말풍선을 아래로 (위의 현재 값을 가리지 않게)
    dot.hidden = near.ms == null;
    dot.style.left = `${left}px`; dot.style.top = `${top}px`;
  });
  plot.addEventListener('pointerleave', () => { tip.hidden = true; dot.hidden = true; $('#ping-cross')?.setAttribute('visibility', 'hidden'); });
  draw();
  // 시계 기준으로 매분 0초와 30초에 잰다. 매번 다음 정각을 다시 계산하므로 밀리지 않고,
  // Lively가 멈췄다 풀려도 다음 0초/30초부터 다시 맞춘다
  const STEP = 30_000;
  const schedule = () => setTimeout(() => { ping(); schedule(); }, STEP - (Date.now() % STEP) + 20);
  schedule();
  addEventListener('resize', draw);
}

/* ── 오늘의 보안 키워드 (바탕화면 Commits 칸의 Keyword 탭) ─────
   data/keywords.json의 [키워드, 원어·풀이, 한 줄 설명]에서 한국 날짜로 하루에 하나. 목록을 다 돌면 처음부터 */
fetch('data/keywords.json').then((r) => r.json()).then((list) => {
  const [term, name, desc] = list[kstDay(Date.now()) % list.length];
  $('#kw-term').textContent = term;
  $('#kw-name').textContent = name;
  $('#kw-desc').textContent = desc;
  $('#kw-date').textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date());
}).catch(() => { $('#kw-term').textContent = '키워드를 불러오지 못했어요'; });

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
load('kev').then((d) => renderKev(d?.items ? d : null));
load('ctf').then((d) => renderCtf(d?.events ? d : null));
