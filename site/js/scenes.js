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

  /* ── 장면 1: 첫 화면 ───────────────────── */
  const hero = $('.scene--hero');
  const title = $('.hero__title'), lede = $('.hero__status'), tail = $('.term--tail'), hint = $('.hero__hint');
  const drawHero = () => {
    const p = progress(hero);
    title.style.transform = `translate3d(0, ${-p * 18}vh, 0) scale(${1 - p * 0.32})`;
    lede.style.opacity = 1 - clamp(p * 1.8);
    tail.style.transform = `translate3d(0, ${-p * 12}vh, 0)`;
    tail.style.opacity = 1 - clamp(p * 1.3);
    hint.style.opacity = 1 - clamp(p * 4);
  };

  /* ── 장면 3: 로그 카드가 옆으로 ─────────── */
  const logScene = $('.scene--log'), track = $('#track'), viewport = $('.log__viewport'), bar = $('#log-bar');
  let logRun = 0;
  const sizeLog = () => {
    logRun = Math.max(0, track.scrollWidth - viewport.clientWidth);
    logScene.style.height = `${logRun + vh() * 1.15}px`;
  };
  const drawLog = () => {
    const p = progress(logScene);
    track.style.transform = `translate3d(${-p * logRun}px, 0, 0)`;
    bar.style.transform = `scaleX(${p})`;
  };

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

  /* ── 장면 5: 위젯과 패킷 ───────────────── */
  const appScene = $('.scene--app'), shot = $('.app__shot'), packet = $('.route__packet');
  const hops = [...document.querySelectorAll('.hop')];
  let hopY = [];
  const measureHops = () => { hopY = hops.map((h) => h.offsetTop); };
  const drawApp = () => {
    const p = progress(appScene);
    const t = clamp(p / 0.35);
    shot.style.transform = `translate3d(0, ${(1 - t) * 8}vh, 0) scale(${0.72 + 0.28 * t})`;
    shot.style.opacity = 0.25 + 0.75 * t;
    const q = clamp((p - 0.3) / 0.6);
    const y = hopY[0] + q * (hopY[hopY.length - 1] - hopY[0]);
    packet.style.transform = `translate3d(0, ${y}px, 0)`;
    hops.forEach((h, i) => h.classList.toggle('is-on', y >= hopY[i] - 2));
  };

  /* ── 한 프레임에 한 번만 그린다 ───────────── */
  const scenes = [
    [hero, drawHero], [logScene, drawLog], [repoScene, drawRepo], [appScene, drawApp],
  ];
  let queued = false;
  const frame = () => {
    queued = false;
    for (const [el, draw] of scenes) if (visible(el)) draw();
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  const layout = () => {
    $('.scene--repo').style.setProperty('--len', '260vh');
    $('.scene--app').style.setProperty('--len', '280vh');
    sizeLog(); measureHops(); request();
  };

  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', layout);
  addEventListener('scenes:refresh', layout);
  addEventListener('load', layout);
  document.fonts?.ready.then(layout);
  layout();
})();
