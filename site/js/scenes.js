// 스크롤 장면 — 휠을 내린 만큼 각 장면의 진행도(0→1)를 계산해 움직임에 쓴다.
// 위치·크기·투명도만 바꾼다(GPU로 처리되는 속성). '애니메이션 줄이기'면 아무것도 켜지 않는다.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !CSS.supports('position', 'sticky')) return;
  document.documentElement.classList.add('scenes-on');
  document.querySelectorAll('.scene').forEach((s) => s.classList.add('is-live'));

  const $ = (s, root = document) => root.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const vh = () => innerHeight;

  // 장면의 진행도: 장면 위쪽이 화면 위에 닿을 때 0, 고정이 풀릴 때 1
  const progress = (el) => {
    const r = el.getBoundingClientRect();
    const run = r.height - vh();
    return run > 0 ? clamp(-r.top / run) : 0;
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh(); };

  /* ── 제목 복호화 ───────────────────────── */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEF';
  const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0].replace('<', '&lt;').replace('>', '&gt;');
  // 글자가 무작위 기호로 깨졌다가 앞에서부터 text로 맞춰진다
  const scramble = (el, text, delay = 0) => {
    const start = performance.now() + delay;
    const tick = (t) => {
      const k = clamp((t - start) / 900);
      const fixed = Math.floor(k * text.length);
      el.innerHTML = [...text].map((ch, i) => (i < fixed || ch === ' ' ? ch : `<span class="glyph">${glyph()}</span>`)).join('');
      if (k < 1) requestAnimationFrame(tick); else el.textContent = text;
    };
    requestAnimationFrame(tick);
  };
  document.querySelectorAll('[data-decrypt]').forEach((el, n) => scramble(el, el.textContent, n * 180));

  /* ── 제목: 15초마다 URIGG ↔ Security.log Website ── */
  const name = $('.dash__name');
  if (name) {
    const TITLES = ['URIGG', 'Security.log Website'];
    let cur = 0;
    // 긴 제목은 옆의 상태줄과 겹치지 않게, 들어갈 만큼만 글씨를 줄인다
    const fit = () => {
      name.style.fontSize = '';
      if (cur === 0) return;
      const brand = name.closest('.dash__brand'), head = name.closest('.dash__head'), side = $('.dash__side');
      const sideBeside = side && side.offsetTop < brand.offsetTop + brand.offsetHeight;
      const room = head.clientWidth - (sideBeside ? side.offsetWidth + 40 : 0) - (brand.offsetWidth - name.offsetWidth);
      const probe = name.cloneNode();
      probe.textContent = TITLES[cur];
      probe.style.cssText = 'position:absolute;visibility:hidden;transition:none';
      name.parentNode.append(probe);
      const need = probe.offsetWidth, base = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      if (need > room) name.style.fontSize = `${Math.floor(base * room / need)}px`;
    };
    setInterval(() => {
      if (document.hidden || !visible(name)) return;
      cur = (cur + 1) % TITLES.length;
      fit();
      scramble(name, TITLES[cur]);
    }, 15_000);
    addEventListener('resize', fit);
  }

  /* ── 장면 4: tree 출력 ─────────────────── */
  const repoScene = $('.scene--repo'), screen = $('.term__screen'), out = $('#tree'), counter = $('#repo-total');
  const drawRepo = () => {
    const p = progress(repoScene);
    const rows = out.querySelectorAll('.term__row');
    const shown = Math.round(clamp(p / 0.85) * rows.length);
    let last = null;
    rows.forEach((r, i) => { const o = i < shown; r.classList.toggle('is-on', o); if (o) last = r; });
    // 마지막으로 찍힌 줄이 창 아래에 오도록 출력을 밀어 올린다 (터미널 자동 스크롤)
    const bottom = last ? last.offsetTop + last.offsetHeight : 0;
    out.style.transform = `translate3d(0, ${-Math.max(0, bottom - screen.clientHeight + 8)}px, 0)`;
    const target = +counter.dataset.target || 0;
    counter.textContent = Math.round(clamp(p / 0.6) * target);
  };

  /* ── 한 프레임에 한 번만 그린다 ───────────── */
  const scenes = [
    [repoScene, drawRepo],
  ];
  let queued = false;
  const frame = () => {
    queued = false;
    for (const [el, draw] of scenes) if (visible(el)) draw();
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  const layout = () => {
    $('.scene--repo').style.setProperty('--len', '260vh');
    request();
  };

  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', layout);
  addEventListener('scenes:refresh', layout);
  addEventListener('load', layout);
  document.fonts?.ready.then(layout);
  layout();
})();
