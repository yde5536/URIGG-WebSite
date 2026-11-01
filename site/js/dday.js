// D-day 칸 — 메인 하나는 크게, 나머지는 아래 목록. 사이트에서 추가·삭제·메인 지정.
// 저장은 코워크 캘린더와 같은 Supabase의 ddays 표(db/ddays.sql). 로그인은 Today 칸의 캘린더 위젯이 하고,
// 여기서는 같은 사이트 저장소에 남은 그 로그인 정보를 빌려 쓴다. 토큰 갱신도 위젯이 맡는다.
(() => {
  const SUPABASE_URL = 'https://dfvcgacadkaglgtooxdy.supabase.co';
  const KEY = 'sb_publishable_QizHB60p_MUv45grEeFt8w_8UBZjvpK'; // 공개용 키 (데이터 보호는 RLS 담당)
  const SESSION = 'sb-dfvcgacadkaglgtooxdy-auth-token';
  const $ = (s) => document.querySelector(s);
  const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const main = $('#dday-main'), list = $('#dday-list'), form = $('#dday-form'), addBtn = $('#dday-add');
  let items = [];

  // 위젯이 저장해 둔 로그인 정보 (만료됐으면 위젯이 갱신할 때까지 기다린다)
  const session = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION) || 'null');
      return s && s.access_token && s.expires_at * 1000 > Date.now() + 10_000 ? s : null;
    } catch { return null; }
  };

  async function api(path, opts = {}) {
    const s = session();
    if (!s) throw new Error('login');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...opts,
      headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
    });
    if (res.status === 404 || res.status === 400) {
      const body = await res.json().catch(() => ({}));
      if (/ddays/.test(body.message || '') || body.code === 'PGRST205' || body.code === '42P01') throw new Error('no-table');
    }
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  // 한국 날짜 기준 남은 날
  const todayKey = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const left = (date) => Math.round((Date.parse(date) - Date.parse(todayKey())) / 86_400_000);
  const label = (n) => (n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `D+${-n}`);
  const md = (date) => `${+date.slice(5, 7)}월 ${+date.slice(8, 10)}일`;

  function render(state) {
    if (state === 'login') {
      main.innerHTML = '<p class="dday__hint">Today 칸의 캘린더 위젯에 로그인하면 D-day를 저장하고 볼 수 있어요.</p>';
      list.innerHTML = ''; addBtn.hidden = true; form.hidden = true;
      return;
    }
    if (state === 'no-table') {
      main.innerHTML = '<p class="dday__hint">Supabase에 D-day 표가 아직 없어요. <code>db/ddays.sql</code>을 SQL Editor에서 한 번 실행해 주세요.</p>';
      list.innerHTML = ''; addBtn.hidden = true;
      return;
    }
    if (state === 'error') {
      main.innerHTML = '<p class="dday__hint">D-day를 불러오지 못했어요.</p>';
      return;
    }
    addBtn.hidden = false;
    const sorted = [...items].sort((a, b) => a.target.localeCompare(b.target));
    const top = sorted.find((d) => d.is_main) || sorted.find((d) => left(d.target) >= 0) || sorted[0];
    if (!top) {
      main.innerHTML = '<p class="dday__hint">아직 D-day가 없어요. <b>+ 추가</b>로 시험이나 목표 날짜를 넣어 보세요.</p>';
      list.innerHTML = '';
      return;
    }
    const n = left(top.target);
    main.innerHTML = `
      <p class="dday__big${n < 0 ? ' is-past' : ''}">${label(n)}</p>
      <p class="dday__name">${esc(top.title)}</p>
      <p class="dday__date">${md(top.target)}${top.is_main ? ' · 메인' : ''}</p>`;
    list.innerHTML = sorted.filter((d) => d !== top).map((d) => {
      const k = left(d.target);
      return `<li class="${k < 0 ? 'is-past' : ''}">
        <b>${label(k)}</b><span>${esc(d.title)}</span><time>${md(d.target)}</time>
        <button type="button" class="dday__icon" data-main="${d.id}" title="메인으로" aria-label="${esc(d.title)} 메인으로">메인</button>
        <button type="button" class="dday__icon" data-del="${d.id}" title="삭제" aria-label="${esc(d.title)} 삭제">×</button>
      </li>`;
    }).join('') + (top ? `<li class="dday__top-actions"><button type="button" class="link" data-del="${top.id}">메인 D-day 삭제</button></li>` : '');
  }

  async function load() {
    if (!session()) return render('login');
    try {
      items = await api('ddays?select=id,title,target,is_main&order=target.asc');
      render();
    } catch (e) {
      render(e.message === 'login' ? 'login' : e.message === 'no-table' ? 'no-table' : 'error');
    }
  }

  // 메인은 하나만: 다른 메인을 먼저 내리고 새로 지정
  async function setMain(id) {
    await api('ddays?is_main=is.true', { method: 'PATCH', body: JSON.stringify({ is_main: false }) });
    if (id) await api(`ddays?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_main: true }) });
  }

  /* ── 이름 자동완성: 캘린더(events 표)의 오늘 이후 일정에서 찾는다 ── */
  const nameIn = $('#dday-name'), dateIn = $('#dday-date'), sug = $('#dday-suggest');
  const kstDate = (iso) => new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);
  let hits = [], pick = -1, timer = 0, ask = 0;

  const closeSug = () => { sug.hidden = true; sug.innerHTML = ''; hits = []; pick = -1; nameIn.setAttribute('aria-expanded', 'false'); nameIn.removeAttribute('aria-activedescendant'); };
  const drawSug = () => {
    sug.innerHTML = hits.length
      ? hits.map((h, i) => `<li id="dday-sug-${i}" role="option" aria-selected="${i === pick}" data-i="${i}"><b>${esc(h.emoji || '·')}</b><span>${esc(h.title)}</span><time>${md(h.date)}</time></li>`).join('')
      : '<li class="is-empty" role="option" aria-disabled="true">캘린더에 맞는 일정이 없어요</li>';
    sug.hidden = false;
    nameIn.setAttribute('aria-expanded', 'true');
    if (pick >= 0) nameIn.setAttribute('aria-activedescendant', `dday-sug-${pick}`); else nameIn.removeAttribute('aria-activedescendant');
  };
  const choose = (i) => {
    const h = hits[i];
    if (!h) return;
    nameIn.value = h.title.slice(0, 60);
    dateIn.value = h.date;
    closeSug();
  };

  async function suggest() {
    // 검색 문법에 쓰이는 글자는 빼고 찾는다
    const q = nameIn.value.trim().replace(/[*,()%\\]/g, '');
    const n = ++ask;
    if (!q || !session()) return closeSug();
    try {
      const from = encodeURIComponent(`${todayKey()}T00:00:00+09:00`);
      const rows = await api(`events?select=title,emoji,start_at&title=ilike.*${encodeURIComponent(q)}*&start_at=gte.${from}&order=start_at.asc&limit=30`);
      if (n !== ask) return; // 그새 더 입력했으면 버린다
      // 같은 이름이 반복되면 가장 가까운 날짜 하나만
      const seen = new Set();
      hits = rows.filter((r) => !seen.has(r.title) && seen.add(r.title)).slice(0, 8).map((r) => ({ ...r, date: kstDate(r.start_at) }));
      pick = -1;
      drawSug();
    } catch { closeSug(); }
  }

  nameIn.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(suggest, 220); });
  nameIn.addEventListener('keydown', (e) => {
    if (sug.hidden || !hits.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      pick = (pick + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      drawSug();
    } else if (e.key === 'Enter' && pick >= 0) { e.preventDefault(); choose(pick); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSug(); }
  });
  // 클릭이 입력칸의 blur보다 먼저 처리되도록 mousedown에서 고른다
  sug.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
  nameIn.addEventListener('blur', () => setTimeout(closeSug, 120));

  addBtn.addEventListener('click', () => {
    form.hidden = !form.hidden;
    closeSug();
    if (!form.hidden) { dateIn.value = todayKey(); nameIn.focus(); }
  });
  $('#dday-cancel').addEventListener('click', () => { form.hidden = true; closeSug(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('#dday-name').value.trim(), target = $('#dday-date').value, isMain = $('#dday-main-check').checked;
    if (!title || !target) return;
    try {
      if (isMain) await setMain(null);
      await api('ddays', { method: 'POST', body: JSON.stringify({ title, target, is_main: isMain || !items.length }) });
      form.reset(); form.hidden = true;
      await load();
    } catch { render('error'); }
  });
  list.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]'), star = e.target.closest('[data-main]');
    try {
      if (del && confirm('이 D-day를 지울까요?')) { await api(`ddays?id=eq.${del.dataset.del}`, { method: 'DELETE' }); await load(); }
      if (star) { await setMain(star.dataset.main); await load(); }
    } catch { render('error'); }
  });

  // 위젯에서 로그인·로그아웃·토큰 갱신이 일어나면 같은 사이트 저장소가 바뀐다 → 다시 불러온다
  addEventListener('storage', (e) => { if (e.key === SESSION) load(); });
  // 처음 열었을 때 토큰이 만료돼 있으면 위젯이 갱신할 시간을 준다
  load();
  setTimeout(() => { if (!items.length && session()) load(); }, 4000);
  // 자정이 지나면 남은 날 다시 계산
  setInterval(() => items.length && render(), 60_000);
})();
