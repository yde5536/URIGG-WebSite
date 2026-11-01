// 리퀴드 글래스 굴절 — 요소마다 가장자리 변위 지도를 그려 SVG 필터로 backdrop-filter에 건다.
// backdrop-filter: url(#…)은 Chromium만 지원하므로 다른 브라우저는 theme-glass.css의 흐린 유리로 남는다.
(() => {
  const isChromium = navigator.userAgentData?.brands?.some((b) => /Chromium/.test(b.brand));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVG = 'http://www.w3.org/2000/svg';

  const defs = document.createElementNS(SVG, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.append(defs);

  // 둥근 사각형 안의 점에서 가장 가까운 가장자리까지의 거리와 바깥 방향 법선
  function edge(px, py, hw, hh, r) {
    const ax = Math.abs(px), ay = Math.abs(py);
    const qx = ax - (hw - r), qy = ay - (hh - r);
    let d, nx, ny;
    if (qx > 0 && qy > 0) {
      const len = Math.hypot(qx, qy) || 1;
      d = r - len; nx = qx / len; ny = qy / len;
    } else if (qx > qy) {
      d = hw - ax; nx = 1; ny = 0;
    } else {
      d = hh - ay; nx = 0; ny = 1;
    }
    return { d, nx: nx * Math.sign(px || 1), ny: ny * Math.sign(py || 1) };
  }

  function drawMap(w, h, r, bezel) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hw = w / 2, hh = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const { d, nx, ny } = edge(x + 0.5 - hw, y + 0.5 - hh, hw, hh, r);
        let m = 0;
        if (d >= 0 && d < bezel) {
          const t = 1 - d / bezel;          // 가장자리 1 → 안쪽 0
          m = 1 - Math.sqrt(1 - t * t);     // 볼록한 유리 단면
        }
        const i = (y * w + x) * 4;
        img.data[i] = 128 - nx * m * 127;
        img.data[i + 1] = 128 - ny * m * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  let n = 0;
  function refract(el) {
    const id = `lg-${n++}`;
    const filter = document.createElementNS(SVG, 'filter');
    filter.id = id;
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.innerHTML = '<feImage result="map" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/>';
    defs.append(filter);
    const image = filter.firstChild, disp = filter.lastChild;
    const blur = el.dataset.blur ?? '2px';
    const extra = el.dataset.extra ?? 'saturate(160%)';

    let last = '';
    const build = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h || `${w}x${h}` === last) return;
      last = `${w}x${h}`;
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
      const bezel = Math.min(+el.dataset.bezel || 22, Math.min(w, h) / 2);
      for (const node of [filter, image]) {
        node.setAttribute('x', 0); node.setAttribute('y', 0);
        node.setAttribute('width', w); node.setAttribute('height', h);
      }
      image.setAttribute('href', drawMap(w, h, r, bezel));
      disp.setAttribute('scale', el.dataset.depth || 36);
      const f = `url(#${id}) blur(${blur}) ${extra}`;
      el.style.backdropFilter = f;
      el.style.webkitBackdropFilter = f;
    };
    new ResizeObserver(build).observe(el);
  }

  const scan = () => document.querySelectorAll('[data-refract]:not([data-lg])').forEach((el) => { el.dataset.lg = ''; refract(el); });
  if (isChromium) { scan(); addEventListener('glass:refresh', scan); }

  // 렌즈 끌기
  const lens = document.querySelector('.lens');
  if (lens) {
    let sx, sy, ox, oy;
    lens.addEventListener('pointerdown', (e) => {
      const box = lens.getBoundingClientRect(), parent = lens.offsetParent.getBoundingClientRect();
      lens.classList.add('is-held', 'is-placed');
      lens.style.transform = 'none';
      lens.style.left = `${box.left - parent.left}px`;
      lens.style.top = `${box.top - parent.top}px`;
      sx = e.clientX; sy = e.clientY; ox = box.left - parent.left; oy = box.top - parent.top;
      lens.setPointerCapture(e.pointerId);
    });
    lens.addEventListener('pointermove', (e) => {
      if (!lens.classList.contains('is-held')) return;
      lens.style.left = `${ox + e.clientX - sx}px`;
      lens.style.top = `${oy + e.clientY - sy}px`;
    });
    const drop = () => lens.classList.remove('is-held');
    lens.addEventListener('pointerup', drop);
    lens.addEventListener('pointercancel', drop);
    if (reduced) lens.classList.add('is-placed');
  }
})();
