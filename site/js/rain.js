// 배경의 초록 코드 비. 성능을 위해 초당 12장만 그리고, 탭이 숨겨지면 멈춘다.
(() => {
  const canvas = document.querySelector('.rain');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF<>/{}[]$#';
  const SIZE = 16, FPS = 12;
  let cols = [], last = 0, running = true;

  const resize = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    cols = Array.from({ length: Math.ceil(innerWidth / SIZE) }, () => Math.random() * -40);
    ctx.fillStyle = '#030805';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const draw = (t) => {
    if (!running) return;
    requestAnimationFrame(draw);
    if (t - last < 1000 / FPS) return;
    last = t;
    // 이전 글자를 조금씩 어둡게 덮어 꼬리를 만든다
    ctx.fillStyle = 'rgba(3, 8, 5, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${SIZE - 2}px "JetBrains Mono", monospace`;
    cols.forEach((y, i) => {
      const ch = CHARS[(Math.random() * CHARS.length) | 0];
      ctx.fillStyle = Math.random() < 0.06 ? '#c8ffdc' : '#1fd16a';
      ctx.fillText(ch, i * SIZE, y * SIZE);
      cols[i] = y * SIZE > canvas.height && Math.random() > 0.97 ? 0 : y + 1;
    });
  };

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(draw);
  });
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();
