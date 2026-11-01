// 페이지 동작 — 데이터 불러오기, 책장과 grep, 저장소 목차, 등장 움직임
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, root = document) => root.querySelector(s);
const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ymd = (iso) => {
  const p = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (t) => p.find((x) => x.type === t).value;
  return `${get('year')}.${get('month')}.${get('day')}`;
};

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

/* ── 블로그 책장 ──────────────────────────── */
function markFor(post) {
  if (post.group === '자격증') return 3;
  if (/네트워크/.test(post.series)) return 2;
  return 1;
}

function splitTitle(title) {
  const i = title.indexOf(' - ');
  return i < 0 ? { line: '', name: title } : { line: title.slice(0, i), name: title.slice(i + 3) };
}

function renderTail(posts) {
  $('#tail').innerHTML = posts.slice(0, 6).map((p, i) => `<li style="--i:${i}"><time datetime="${p.date}">${ymd(p.date)}</time><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a></li>`).join('');
}

function renderBlog(data) {
  renderTail(data.posts);
  const shelf = $('#shelf'), post = $('#post'), input = $('#grep'), count = $('#grep-count');
  const posts = data.posts.map((p) => ({ ...p, ...splitTitle(p.title), mark: markFor(p) }));

  shelf.innerHTML = posts.map((p, i) => `
    <li class="entry" data-i="${i}">
      <a class="entry__link" href="${esc(p.link)}" target="_blank" rel="noopener">
        <time class="entry__date" datetime="${p.date}">${ymd(p.date)}</time>
        <span class="entry__title">${esc(p.name)}</span>
        <span class="entry__series"><span class="entry__dot" style="background:var(--mark-${p.mark})"></span>${esc(p.line || p.series)}</span>
        <span class="entry__arrow" aria-hidden="true">→</span>
      </a>
    </li>`).join('') + '<li class="shelf__empty" hidden>맞는 글이 없습니다.</li>';

  const show = (i) => {
    const p = posts[i];
    shelf.querySelectorAll('.entry').forEach((s) => s.classList.toggle('is-active', s.dataset.i == i));
    post.innerHTML = `
      <span class="post__series mark mark--${p.mark}">${esc(p.line || p.series)}</span>
      <h3>${esc(p.name)}</h3>
      <p class="post__date">${ymd(p.date)} · ${esc(p.group)} / ${esc(p.series)}</p>
      ${p.thumb ? `<img class="post__thumb" src="${esc(p.thumb)}" alt="${esc(p.name)} 글의 첫 이미지" width="640" height="360" loading="lazy" referrerpolicy="no-referrer">` : ''}
      <p class="post__summary">${esc(p.summary)}</p>
      <a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener">글 읽기<span aria-hidden="true">→</span></a>`;
  };

  // 마우스를 올리거나 키보드로 고르면 옆 패널에 미리보기, 클릭하면 글로 이동
  const preview = (e) => {
    const s = e.target.closest('.entry');
    if (s) show(+s.dataset.i);
  };
  shelf.addEventListener('pointerover', preview);
  shelf.addEventListener('focusin', preview);

  // grep: 제목·시리즈·요약에서 찾는다
  const grep = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0, first = -1;
    shelf.querySelectorAll('.entry').forEach((s) => {
      const p = posts[+s.dataset.i];
      const hit = !q || `${p.title} ${p.series} ${p.summary}`.toLowerCase().includes(q);
      s.hidden = !hit;
      if (hit) { shown++; if (first < 0) first = +s.dataset.i; }
    });
    shelf.querySelector('.shelf__empty').hidden = shown > 0;
    count.textContent = `${shown} / ${posts.length}`;
    if (first >= 0) show(first);
  };
  input.addEventListener('input', grep);
  grep();
  window.dispatchEvent(new Event('glass:refresh'));
}

/* ── security.log 목차 ───────────────────── */
const sizeLabel = (b) => (b == null ? '폴더' : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);
const dotFor = (name) => (/리눅스/.test(name) ? 'var(--mark-1)' : /네트워크/.test(name) ? 'var(--mark-2)' : 'var(--mark-3)');

function renderGithub(data) {
  const { repo, groups, release } = data;
  $('#repo-meta').innerHTML = `별 ${repo.stars}개 · 마지막 업데이트 ${ymd(repo.pushedAt)} · <a class="link" href="${esc(repo.url)}" target="_blank" rel="noopener">GitHub에서 보기</a>`;
  $('#toc').innerHTML = groups.map((g) => `
    <div class="toc__group" data-rise>
      <p class="toc__name">${esc(g.name)}${g.en ? ` · ${esc(g.en)}` : ''}</p>
      <ul>
        ${g.planned && !g.entries.length
          ? `<li class="toc__row toc__row--planned"><span class="toc__dot" style="background:var(--surface-2)"></span><span class="toc__title">준비 중인 시리즈</span><span class="toc__value">작성 예정</span></li>`
          : g.entries.map((e) => e.url
            ? `<li><a class="toc__row" href="${esc(e.url)}" target="_blank" rel="noopener"><span class="toc__dot" style="background:${dotFor(g.name)}"></span><span class="toc__title">${esc(e.title)}</span><span class="toc__value">${sizeLabel(e.size)}</span></a></li>`
            : `<li class="toc__row toc__row--planned"><span class="toc__dot" style="background:var(--surface-2)"></span><span class="toc__title">${esc(e.title)}</span><span class="toc__value">작성 예정</span></li>`).join('')}
      </ul>
    </div>`).join('');
  observe($('#toc'));

  // 저장소 요약: 실제로 올라간 기록만 센다
  const written = groups.map((g) => ({ ...g, done: g.entries.filter((e) => e.url) }));
  const total = written.reduce((n, g) => n + g.done.length, 0);
  const bytes = written.reduce((n, g) => n + g.done.reduce((m, e) => m + (e.size || 0), 0), 0);
  $('#repo-total').innerHTML = `<b>${total}</b>개의 기록`;
  $('#repo-split').innerHTML = written.map((g) => `
    <li><span class="toc__dot" style="background:${g.done.length ? dotFor(g.name) : 'var(--surface-2)'}"></span><span>${esc(g.name)}</span><span>${g.done.length ? `${g.done.length}개` : '준비 중'}</span></li>`).join('');
  $('#repo-foot').textContent = `문서 ${Math.round(bytes / 1024)} KB · 마지막 업데이트 ${ymd(repo.pushedAt)}`;

  if (release) $('#app-ver').textContent = `Windows · ${release.tag} · ${ymd(release.publishedAt)} 배포`;
}

/* ── 등장 순서 ─────────────────────────── */
// 등장 자체는 CSS 스크롤 애니메이션이 한다. 여기서는 같은 줄에 있는 것들의 순서만 매긴다.
function observe(root = document) {
  root.querySelectorAll('[data-reveal]').forEach((el, i) => el.style.setProperty('--i', i % 4));
}
observe();

// 사진이 스크롤보다 조금 느리게 움직인다
const drifting = [...document.querySelectorAll('[data-drift]')];
if (!reduced && drifting.length) {
  let ticking = false;
  const drift = () => {
    ticking = false;
    for (const el of drifting) {
      const box = el.parentElement.getBoundingClientRect();
      const p = (innerHeight - box.top) / (innerHeight + box.height); // 0 → 1
      if (p < 0 || p > 1) continue;
      el.style.transform = `translate3d(0, ${(p - 0.5) * -8}%, 0) scale(1.1)`;
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
  drift();
}

load('blog').then((d) => d?.posts?.length && renderBlog(d));
load('github').then((d) => d?.groups && renderGithub(d));
