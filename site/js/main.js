// 페이지 데이터 — 블로그 로그, 로그 카드와 grep, tree 출력, 캘린더 버전
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

async function sha256(text) {
  if (!crypto?.subtle) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''); // taste-skill-ignore: 해시 16진수 자리 맞춤
}

// 서버 함수 → 실패하면 저장해 둔 스냅샷
// 응답 모양이 바뀌면 숫자를 올린다 (엣지 캐시를 새로 쓰게 하려고)
const API_VERSION = 2;
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
$('#today-date').textContent = todayLabel;

/* ── 오늘 일정: 접근 키가 맞아야 서버가 내준다 ── */
const KEY = 'urigg.site-key';
const store = {
  get: () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} },
};
const today = $('#today'), agenda = $('#agenda'), form = $('#unlock'), msg = $('#unlock-msg'), relock = $('#relock');
const hhmm = (iso) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const dayKey = (iso) => kstDay(new Date(iso).getTime());

function renderAgenda({ events }) {
  const now = kstDay(Date.now());
  const rows = events.map((e) => {
    const d = Math.max(dayKey(e.start), now) - now;
    const when = d === 0 ? '오늘' : d === 1 ? '내일' : `D+${d}`;
    const time = e.allDay ? '종일' : hhmm(e.start);
    return `<li class="agenda__row rd${d === 0 ? ' is-today' : ''}"><time datetime="${e.start}">${when} · ${time}</time><span>${esc(e.title)}</span></li>`;
  });
  agenda.innerHTML = rows.join('') || '<li class="agenda__row rd"><time>7일</time><span>잡힌 일정이 없습니다</span></li>';
  // 가림 막대가 위에서부터 하나씩 걷힌다
  agenda.querySelectorAll('.rd').forEach((r, i) => setTimeout(() => r.classList.add('is-open'), 120 + i * 90));
  today.classList.add('is-clear');
  form.hidden = true;
  relock.hidden = false;
}

async function openToday(key) {
  msg.textContent = '확인 중…';
  try {
    const res = await fetch('/api/today', { headers: { 'x-site-key': key } });
    if (res.status === 401) { store.set(''); msg.textContent = '키가 맞지 않습니다.'; return; }
    if (res.status === 503) { msg.textContent = '서버에 일정 주소(ICS_URL)와 접근 키(SITE_KEY)가 아직 설정되지 않았습니다.'; return; }
    if (!res.ok) { msg.textContent = '일정을 불러오지 못했습니다.'; return; }
    store.set(key);
    msg.textContent = '';
    renderAgenda(await res.json());
  } catch {
    msg.textContent = '일정 서버에 연결하지 못했습니다.';
  }
}
form.addEventListener('submit', (e) => { e.preventDefault(); openToday($('#site-key').value.trim()); });
relock.addEventListener('click', () => { store.set(''); location.reload(); });
if (store.get()) openToday(store.get());

/* ── 블로그 ──────────────────────────────── */
const markFor = (p) => (p.group === '자격증' ? 3 : /네트워크/.test(p.series) ? 2 : 1);
function splitTitle(title) {
  const i = title.indexOf(' - ');
  return i < 0 ? { line: '', name: title } : { line: title.slice(0, i), name: title.slice(i + 3) };
}

function renderTail(posts) {
  $('#tail').innerHTML = posts.slice(0, 5).map((p, i) => `
    <li style="--i:${i}"><time datetime="${p.date}">${stamp(p.date).slice(5)}</time><span class="lvl">INFO</span><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a></li>`).join('');
}

async function renderBlog(data) {
  renderTail(data.posts);
  setStatus('st-post', data.posts[0]?.date);
  const track = $('#track'), input = $('#grep'), count = $('#grep-count');
  const posts = data.posts.map((p) => ({ ...p, ...splitTitle(p.title), mark: markFor(p) }));
  const hashes = await Promise.all(posts.map((p) => sha256(p.link)));

  track.innerHTML = posts.map((p, i) => `
    <li class="card glass glass--dark" data-i="${i}">
      <p class="card__meta">[${stamp(p.date)}] <b>INFO</b> ${esc(p.group)}/${esc(p.series)}</p>
      <span class="card__series mark mark--${p.mark}">${esc(p.line || p.series)}</span>
      <h3 class="card__title">${esc(p.name)}</h3>
      ${p.thumb ? `<img class="card__thumb" src="${esc(p.thumb)}" alt="${esc(p.name)} 글에 들어간 이미지" width="480" height="270" loading="lazy" referrerpolicy="no-referrer">` : ''}
      <p class="card__sum">${esc(p.summary)}</p>
      <p class="card__foot"><span class="card__hash">${hashes[i] ? `sha256 ${hashes[i].slice(0, 12)}…` : ''}</span><a class="link card__go" href="${esc(p.link)}" target="_blank" rel="noopener">글 읽기 →</a></p>
    </li>`).join('') + `
    <li class="card card--end glass glass--dark">
      <p class="card__meta">EOF</p>
      <h3 class="card__title">전체 글은 블로그에서</h3>
      <a class="btn" href="https://urigg-security.tistory.com/" target="_blank" rel="noopener">security.log 열기</a>
    </li>`;

  // grep: 제목·시리즈·요약에서 찾는다
  const grep = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    track.querySelectorAll('.card[data-i]').forEach((c) => {
      const p = posts[+c.dataset.i];
      const hit = !q || `${p.title} ${p.series} ${p.summary}`.toLowerCase().includes(q);
      c.hidden = !hit;
      if (hit) shown++;
    });
    count.textContent = `${shown} / ${posts.length}`;
    refresh();
  };
  input.addEventListener('input', grep);
  grep();
  window.dispatchEvent(new Event('glass:refresh'));
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

  // 내가 만든 프로그램 (캘린더는 위에 따로 있으니 목록에서는 뺀다)
  const LANG = { 'C++': 'C++', TypeScript: 'TS', JavaScript: 'JS', CSS: 'Web', HTML: 'Web', Python: 'Py' };
  $('#programs').innerHTML = (data.programs || [])
    .filter((p) => p.name !== 'URIGG-ClaudeCalender')
    .map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><span class="programs__name">${esc(p.name)}</span><span class="programs__lang">${esc(LANG[p.language] || p.language || '—')}</span><span class="programs__when">${ago(p.pushedAt)}</span></a></li>`)
    .join('');

  if (release) {
    $('#app-ver').textContent = `${release.tag} · ${stamp(release.publishedAt).slice(5, 10)}`;
    $('#st-app').textContent = release.tag;
  }
  refresh();
}

// 렌즈는 첫 화면이 보일 때만 떠다닌다 (화면 밖에서 유리 필터를 다시 그리지 않도록)
const lens = $('.lens');
if (lens && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => lens.classList.toggle('is-paused', !e.isIntersecting)).observe($('.dash'));
}

load('blog').then((d) => d?.posts?.length && renderBlog(d));
load('github').then((d) => d?.groups && renderGithub(d));
