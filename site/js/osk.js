// 바탕화면 모드(?wall) 화면 키보드 — Lively는 바탕화면에 마우스만 넘겨 주고 키보드는 넘겨 주지 않는다.
// 입력칸(캘린더 위젯 로그인, D-day 이름 등)을 누르면 마우스로 치는 키보드가 뜬다.
// 위젯 iframe은 같은 사이트 주소라서 바깥에서 그 입력칸에 글자를 넣을 수 있다.
(() => {
  if (!document.documentElement.classList.contains('wall')) return;

  const ROWS = {
    lower: ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
    upper: ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
    sym: ['!@#$%^&*()', '-_=+[]{}\\|', ';:\'",.<>/?', '`~'],
  };
  const TYPES = new Set(['text', 'email', 'password', 'search', 'url', 'tel', 'number']);
  let layer = 'lower', target = null;

  const kb = document.createElement('div');
  kb.className = 'osk glass glass--dark';
  kb.hidden = true;
  kb.setAttribute('role', 'group');
  kb.setAttribute('aria-label', '화면 키보드');
  document.body.append(kb);

  const key = (label, act, cls = '') => `<button type="button" class="osk__key ${cls}" data-act="${act}">${label}</button>`;
  const esc = (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c;
  const draw = () => {
    const rows = ROWS[layer].map((r) => [...r].map((c) => key(esc(c), 'c:' + esc(c))).join(''));
    rows[3] = key('⇧', 'shift', 'osk__key--wide' + (layer === 'upper' ? ' is-on' : '')) + rows[3] + key('⌫', 'back', 'osk__key--wide');
    rows.push(key(layer === 'sym' ? 'abc' : '#+=', 'sym', 'osk__key--wide') + key('@', 'c:@') + key('.', 'c:.') + key('', 'c: ', 'osk__key--space')
      + key('.com', 'text:.com', 'osk__key--wide') + key('닫기', 'close', 'osk__key--wide') + key('입력', 'enter', 'osk__key--wide osk__key--go'));
    kb.innerHTML = rows.map((r) => `<div class="osk__row">${r}</div>`).join('');
  };

  // React가 관리하는 입력칸도 알아듣도록, 원래 value setter로 넣고 input 이벤트를 보낸다
  const setValue = (el, v) => {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const type = (s) => { if (target) setValue(target, target.value + s); };

  const open = (el) => { target = el; layer = 'lower'; draw(); kb.hidden = false; };
  const close = () => { kb.hidden = true; target = null; };

  // 키를 눌러도 입력칸의 포커스를 뺏지 않는다
  kb.addEventListener('pointerdown', (e) => e.preventDefault());
  kb.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act.startsWith('c:')) { type(act.slice(2)); if (layer === 'upper') { layer = 'lower'; draw(); } }
    else if (act.startsWith('text:')) type(act.slice(5));
    else if (act === 'back') { if (target) setValue(target, target.value.slice(0, -1)); }
    else if (act === 'shift') { layer = layer === 'upper' ? 'lower' : 'upper'; draw(); }
    else if (act === 'sym') { layer = layer === 'sym' ? 'lower' : 'sym'; draw(); }
    else if (act === 'close') close();
    else if (act === 'enter') {
      const form = target?.form;
      close();
      if (form) form.requestSubmit();
    }
  });

  const watch = (doc) => {
    doc.addEventListener('focusin', (e) => {
      const el = e.target;
      if (el.tagName === 'INPUT' && TYPES.has(el.type) && !el.readOnly) open(el);
    });
  };
  watch(document);

  // 캘린더 위젯: 로그인 뒤 화면이 바뀌어도 같은 문서라서 한 번만 걸면 되지만, iframe이 새로 불러와지면 다시 건다
  const frame = document.querySelector('.widget-frame');
  const hook = () => { try { watch(frame.contentDocument); } catch {} };
  if (frame) { frame.addEventListener('load', hook); if (frame.contentDocument?.readyState === 'complete') hook(); }
})();
