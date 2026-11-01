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
async function load(name) {
  for (const url of [`/api/${name}`, `data/${name}.json`]) {
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

/* ── 블로그 ──────────────────────────────── */
const markFor = (p) => (p.group === '자격증' ? 3 : /네트워크/.test(p.series) ? 2 : 1);
function splitTitle(title) {
  const i = title.indexOf(' - ');
  return i < 0 ? { line: '', name: title } : { line: title.slice(0, i), name: title.slice(i + 3) };
}

function renderTail(posts) {
  $('#tail').innerHTML = posts.slice(0, 6).map((p, i) => `
    <li style="--i:${i}"><time datetime="${p.date}">${stamp(p.date)}</time><span class="lvl">INFO</span><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a></li>`).join('');
}

async function renderBlog(data) {
  renderTail(data.posts);
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
  $('#repo-split').innerHTML = written.map((g) => `<li><span>${esc(g.name)}</span><span>${g.done.length ? `${g.done.length}` : '—'}</span></li>`).join('');
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

  if (release) $('#app-ver').textContent = `Windows · ${release.tag} · ${stamp(release.publishedAt).slice(0, 10)} 배포`;
  refresh();
}

// 렌즈는 첫 화면이 보일 때만 떠다닌다 (화면 밖에서 유리 필터를 다시 그리지 않도록)
const lens = $('.lens');
if (lens && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => lens.classList.toggle('is-paused', !e.isIntersecting)).observe($('.scene--hero'));
}

load('blog').then((d) => d?.posts?.length && renderBlog(d));
load('github').then((d) => d?.groups && renderGithub(d));
