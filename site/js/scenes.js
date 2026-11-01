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
  document.querySelectorAll('[data-decrypt]').forEach((el, n) => {
    const text = el.textContent;
    const start = performance.now() + n * 180;
    const tick = (t) => {
      const k = clamp((t - start) / 900);
      const fixed = Math.floor(k * text.length);
      el.innerHTML = [...text].map((ch, i) => (i < fixed || ch === ' ' ? ch : `<span class="glyph">${GLYPHS[(Math.random() * GLYPHS.length) | 0]}</span>`)).join('');
      if (k < 1) requestAnimationFrame(tick); else el.textContent = text;
    };
    requestAnimationFrame(tick);
  });

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

  /* ── 진행도: 위에서부터 차례로 게이지가 차오른다 ── */
  const pgScene = $('.scene--progress');
  const drawProgress = () => {
    const p = progress(pgScene);
    const gauges = pgScene.querySelectorAll('.gauge');
    const step = gauges.length > 1 ? 0.5 / (gauges.length - 1) : 0;
    gauges.forEach((g, i) => {
      // 각 게이지는 자기 차례(i × step)부터 0.4만큼의 구간 동안 0 → 1
      const t = clamp((p - i * step) / 0.4);
      g.style.setProperty('--t', t);
      const n = g.querySelector('.gauge__count b');
      if (n) n.textContent = Math.round(t * (+g.dataset.done || 0));
    });
  };

  /* ── 한 프레임에 한 번만 그린다 ───────────── */
  const scenes = [
    [pgScene, drawProgress],
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
    pgScene.style.setProperty('--len', '220vh');
    request();
  };

  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', layout);
  addEventListener('scenes:refresh', layout);
  addEventListener('load', layout);
  document.fonts?.ready.then(layout);
  layout();
})();
