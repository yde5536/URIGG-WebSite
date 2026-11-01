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
const API_VERSION = 3;
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

/* ── 오늘 일정: 접근 키가 맞아야 서버가 내준다 ── */
const KEY = 'urigg.site-key';
const store = {
  get: () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} },
};
const today = $('#today'), agenda = $('#agenda'), form = $('#unlock'), msg = $('#unlock-msg'), relock = $('#relock');
const hhmm = (iso) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const dayKey = (iso) => kstDay(new Date(iso).getTime());

/* 잠금이 풀리면 위젯처럼 달력을 그린다: 날짜마다 일정 이모지, 고른 날의 일정은 아래 목록 */
const cal = $('#cal');
const KST_MS = 9 * 3_600_000;
const EMOJI = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;
const splitEmoji = (title) => {
  const m = title.match(EMOJI);
  return m ? { emoji: m[1], text: title.slice(m[0].length) } : { emoji: '', text: title };
};
const monthTitle = (y, m) => `${y}년 ${m + 1}월`;
const dayLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });

function renderCalendar({ events, from, until }) {
  // 날짜(한국 시간 기준 일 번호)별로 일정을 모은다. 여러 날 걸친 종일 일정은 매일 들어간다.
  const byDay = new Map();
  for (const e of events) {
    const s = new Date(e.start).getTime(), end = new Date(e.end).getTime();
    for (let d = kstDay(s); d <= kstDay(Math.max(s, end - 1)); d++) {
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push({ ...e, ...splitEmoji(e.title) });
    }
  }
  const todayKey = kstDay(Date.now());
  const k = new Date(Date.now() + KST_MS);
  let y = k.getUTCFullYear(), m = k.getUTCMonth(), selected = todayKey;
  const minKey = kstDay(new Date(from).getTime()), maxKey = kstDay(new Date(until).getTime()) - 1;

  const draw = () => {
    const first = kstDay(Date.UTC(y, m, 1) - KST_MS);
    const start = first - new Date(Date.UTC(y, m, 1)).getUTCDay();
    const cells = [];
    // 이번 달에 필요한 주 수만큼만 그린다 (4~6주)
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const weeks = Math.ceil((first - start + daysInMonth) / 7);
    for (let i = 0; i < weeks * 7; i++) {
      const d = start + i;
      const date = new Date(d * 86_400_000 + KST_MS);
      const inMonth = date.getUTCMonth() === m;
      const list = byDay.get(d) || [];
      const marks = list.slice(0, 3).map((e) => e.emoji || '•').join('');
      const cls = ['cal__day', inMonth ? '' : 'is-out', d === todayKey ? 'is-today' : '', d === selected ? 'is-on' : ''].join(' ').trim();
      cells.push(`<button type="button" class="${cls}" data-d="${d}" aria-pressed="${d === selected}" aria-label="${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일, 일정 ${list.length}개"><b>${date.getUTCDate()}</b><span>${esc(marks)}</span></button>`);
    }
    const sel = (byDay.get(selected) || []).slice().sort((a, b) => (b.allDay - a.allDay) || (new Date(a.start) - new Date(b.start)));
    const prevOk = first - 1 >= minKey, nextOk = first + 31 <= maxKey;
    cal.innerHTML = `
      <div class="cal__bar">
        <button type="button" class="cal__nav" data-step="-1" aria-label="지난달"${prevOk ? '' : ' disabled'}>‹</button>
        <p class="cal__month">${monthTitle(y, m)}</p>
        <button type="button" class="cal__nav" data-step="1" aria-label="다음 달"${nextOk ? '' : ' disabled'}>›</button>
      </div>
      <div class="cal__week" aria-hidden="true"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
      <div class="cal__grid">${cells.join('')}</div>
      <div class="cal__list">
        <p class="cal__day-title">${dayLabel.format(new Date(selected * 86_400_000))}</p>
        <ul>${sel.map((e) => `<li><time>${e.allDay ? '종일' : hhmm(e.start)}</time><span class="cal__emoji">${esc(e.emoji)}</span><span>${esc(e.text)}</span></li>`).join('') || '<li class="is-empty">일정 없음</li>'}</ul>
      </div>`;
  };

  cal.onclick = (e) => {
    const day = e.target.closest('.cal__day');
    const nav = e.target.closest('.cal__nav');
    if (day) { selected = +day.dataset.d; const dt = new Date(selected * 86_400_000 + KST_MS); y = dt.getUTCFullYear(); m = dt.getUTCMonth(); draw(); }
    if (nav && !nav.disabled) { m += +nav.dataset.step; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); }
  };
  draw();

  // 가림 막대가 걷히고 달력이 드러난다
  agenda.querySelectorAll('.rd').forEach((r, i) => setTimeout(() => r.classList.add('is-open'), 80 + i * 90));
  setTimeout(() => { agenda.hidden = true; cal.hidden = false; }, 420);
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
    renderCalendar(await res.json());
  } catch {
    msg.textContent = '일정 서버에 연결하지 못했습니다.';
  }
}
form.addEventListener('submit', (e) => { e.preventDefault(); openToday($('#site-key').value.trim()); });
relock.addEventListener('click', () => { store.set(''); location.reload(); });
if (store.get()) openToday(store.get());

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
  refresh();
}


load('blog').then((d) => d?.posts?.length && renderBlog(d));
load('github').then((d) => d?.groups && renderGithub(d));
