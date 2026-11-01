// 페이지 동작 — 데이터 불러오기, 메뉴판과 grep, 붙인 사진, 폴더, 캘린더 탭, 첫 화면 사진 교차
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

/* ── 첫 화면: 로고와 위젯이 천천히 바뀐다 ─────── */
const pics = [...document.querySelectorAll('.room__pic')];
if (!reduced && pics.length > 1) {
  let i = 0, timer;
  const next = () => {
    pics[i].classList.remove('is-on');
    i = (i + 1) % pics.length;
    pics[i].classList.add('is-on');
  };
  const run = () => { clearInterval(timer); if (!document.hidden) timer = setInterval(next, 6000); };
  document.addEventListener('visibilitychange', run);
  run();
}

/* ── 블로그: 메뉴판 ─────────────────────── */
// "리눅스 제로부터 #3 - 실습 환경…" → 시리즈 "리눅스 제로부터", 제목 "실습 환경…"
function splitTitle(title) {
  const m = title.match(/^(.*?)\s*#\d+\s*-\s*(.+)$/);
  return m ? { series: m[1], name: m[2] } : { series: '그 밖의 글', name: title };
}

function renderBlog(data) {
  const posts = data.posts.map((p) => ({ ...p, ...splitTitle(p.title) }));
  const groups = [...new Set(posts.map((p) => p.series))];
  const menu = $('#menu'), input = $('#grep'), count = $('#grep-count');

  menu.innerHTML = groups.map((g) => `
    <div class="menu__group" data-group="${esc(g)}">
      <h3>${esc(g)}</h3>
      <ul>${posts.map((p, i) => p.series !== g ? '' : `
        <li class="menu__item" data-i="${i}">
          <a href="${esc(p.link)}" target="_blank" rel="noopener">
            <span class="menu__title">${esc(p.name)}</span>
            <time class="menu__date" datetime="${p.date}">${ymd(p.date).slice(5)}</time>
            <span class="menu__desc">${esc(p.summary)}</span>
          </a>
        </li>`).join('')}
      </ul>
    </div>`).join('') + '<p class="menu__empty" hidden>맞는 글이 없습니다.</p>';

  // grep: 제목·시리즈·요약에서 찾는다
  const grep = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    menu.querySelectorAll('.menu__item').forEach((li) => {
      const p = posts[+li.dataset.i];
      const hit = !q || `${p.title} ${p.summary}`.toLowerCase().includes(q);
      li.hidden = !hit;
      if (hit) shown++;
    });
    menu.querySelectorAll('.menu__group').forEach((g) => { g.hidden = !g.querySelector('.menu__item:not([hidden])'); });
    menu.querySelector('.menu__empty').hidden = shown > 0;
    count.textContent = `${shown} / ${posts.length}`;
  };
  input.addEventListener('input', grep);
  grep();

  // 글 속 이미지를 메뉴판 옆에 사진처럼 붙인다
  $('#plates').innerHTML = posts.filter((p) => p.thumb).slice(0, 3).map((p) => `
    <figure class="plate-pic">
      <img src="${esc(p.thumb)}" alt="${esc(p.name)} 글에 들어간 이미지" width="480" height="360" loading="lazy" referrerpolicy="no-referrer">
      <figcaption>${esc(p.series)}, ${esc(p.name)}</figcaption>
    </figure>`).join('');
}

/* ── security.log: 폴더 ─────────────────── */
const ABOUT = {
  리눅스: '「리눅스 제로부터」 원고와 실습 기록입니다. 파일 구조와 권한에서 시작해 grep과 파이프, 로그 읽기까지 왔습니다.',
  네트워크: '「네트워크 첫걸음」 원고입니다. 네트워크의 구성 요소부터 IP 주소, 서브넷 마스크와 DHCP까지 정리했습니다.',
  자격증: '리눅스마스터 2급 준비 기록입니다. 공부 계획과 현황, 오답 노트, 직접 만든 모의고사가 들어 있습니다.',
  커리큘럼: '시리즈마다 무엇을 어떤 순서로 공부할지 정리한 계획과 보안 공부 로드맵입니다.',
};
const BANDS = [
  ['var(--paper)', 'var(--ink)', 'var(--ink-soft)'],
  ['var(--silver)', 'var(--ink)', '#3b4463'],
  ['var(--paper-2)', 'var(--ink)', 'var(--ink-soft)'],
  ['#2e4373', 'var(--paper)', 'var(--on-ground-soft)'],
  ['var(--ground-deep)', 'var(--paper)', 'var(--on-ground-soft)'],
];
const sizeLabel = (b) => (b == null ? '폴더' : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

function renderGithub(data) {
  const { repo, groups, release } = data;
  // 아직 비어 있는 시리즈는 마지막 폴더 하나로 묶는다
  const filled = groups.filter((g) => g.entries.some((e) => e.url));
  const planned = groups.filter((g) => !g.entries.some((e) => e.url));
  const folders = filled.map((g) => ({ ...g, files: g.entries }));
  if (planned.length) folders.push({ name: planned.map((g) => g.name).join(' · '), en: 'Next', files: [], planned: true });

  $('#folders').innerHTML = folders.map((g, n) => {
    const [band, ink, soft] = BANDS[n % BANDS.length];
    const done = g.files.filter((e) => e.url);
    const bytes = done.reduce((s, e) => s + (e.size || 0), 0);
    const meta = g.planned ? '준비 중' : `문서 ${done.length}개 · ${Math.round(bytes / 1024)} KB`;
    const about = g.planned ? '다음에 시작할 시리즈입니다. 첫 글이 올라오면 이 폴더가 채워집니다.' : (ABOUT[g.name] || `${g.name} 관련 기록입니다.`);
    return `
    <article class="folder" style="--n:${n};--band:${band};--band-ink:${ink};--band-soft:${soft}" aria-label="${esc(g.name)}">
      <div class="folder__tabrow"><h3 class="folder__tab">${esc(g.name)}</h3><p class="folder__meta">${g.en ? `${esc(g.en)} · ` : ''}${meta}</p></div>
      <div class="folder__band">
        <ul class="folder__files">${g.files.map((e) => e.url
          ? `<li><a href="${esc(e.url)}" target="_blank" rel="noopener"><span class="name">${esc(e.title)}</span><span class="size">${sizeLabel(e.size)}</span></a></li>`
          : `<li class="planned"><span><span class="name">${esc(e.title)}</span><span class="size">작성 예정</span></span></li>`).join('')
          || '<li class="planned"><span><span class="name">웹 해킹과 암호학</span><span class="size">작성 예정</span></span></li>'}
        </ul>
        <div class="folder__about"><p>${esc(about)}</p><a class="link" href="${esc(repo.url)}" target="_blank" rel="noopener">GitHub에서 보기</a></div>
      </div>
    </article>`;
  }).join('');

  if (release) $('#app-ver').textContent = `${release.tag} · ${ymd(release.publishedAt)}`;
}

/* ── 코워크 캘린더 탭 ───────────────────── */
const TABS = {
  win: '바탕화면 위에 늘 떠 있는 달력 위젯입니다. 날마다 일정이 이모지로 표시되고, 아래에 오늘 일정과 다가오는 일정이 보입니다.',
  ios: '같은 일정이 아이폰 기본 캘린더에도 그대로 나타납니다. 컴퓨터 앞이 아니어도 하루를 확인할 수 있습니다.',
  mcp: 'Claude 코워크에서 대화로 일정을 짜면, MCP 서버(Cloudflare Workers)를 거쳐 Supabase에 저장되고 위젯과 아이폰으로 퍼집니다.',
};
const tabs = [...document.querySelectorAll('[role="tab"]')];
const select = (t) => {
  tabs.forEach((b) => b.setAttribute('aria-selected', b === t));
  $('#tab-panel').textContent = TABS[t.dataset.tab];
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length];
    next.focus(); select(next);
  });
});

load('blog').then((d) => d?.posts?.length && renderBlog(d));
load('github').then((d) => d?.groups && renderGithub(d));
