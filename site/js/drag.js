// 바탕화면 모드(?wall) 끌어서 스크롤 — Lively는 바탕화면에 마우스 이동·클릭만 넘겨 주고 휠은 넘겨 주지 않는다.
// 칸 안에서 스크롤되는 목록을 마우스로 잡고 위아래로 끌면 스크롤된다. 끌었을 때는 손을 뗄 때 링크가 열리지 않는다.
(() => {
  if (!document.documentElement.classList.contains('wall')) return;

  const LISTS = '.news, .alerts, .dday__list, .programs, .net, .vuln__desc, .term';
  const MOVE = 5; // 이만큼(px) 움직여야 끌기로 본다. 그보다 작으면 그냥 클릭
  let drag = null;

  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const box = e.target.closest(LISTS);
    if (!box || box.scrollHeight <= box.clientHeight) return;
    drag = { box, id: e.pointerId, y: e.clientY, top: box.scrollTop, moved: false };
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < MOVE) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.box.classList.add('is-dragging');
      try { drag.box.setPointerCapture(e.pointerId); } catch {}
    }
    drag.box.scrollTop = drag.top - dy;
  });

  const end = () => {
    if (!drag) return;
    drag.box.classList.remove('is-dragging');
    // 끌었으면 바로 뒤따르는 클릭(링크 열기)을 한 번 막는다
    if (drag.moved) {
      const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      document.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', stop, { capture: true }), 300);
    }
    drag = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
