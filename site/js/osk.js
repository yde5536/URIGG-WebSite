// 바탕화면 모드(?wall) 화면 키보드 — Lively는 바탕화면에 마우스만 넘겨 주고 키보드는 넘겨 주지 않는다.
// 입력칸(캘린더 위젯 로그인, D-day 이름 등)을 누르면 마우스로 치는 키보드가 뜬다.
// 위젯 iframe은 같은 사이트 주소라서 바깥에서 그 입력칸에 글자를 넣을 수 있다.
// 한/영 전환과 두벌식 한글 조합, 맨 위 입력 미리보기, 투명도(100·75·55%) 버튼이 있고,
// 입력칸을 가릴 자리면 키보드가 화면 위쪽으로 비켜 간다.
(() => {
  if (!document.documentElement.classList.contains('wall')) return;

  const ROWS = {
    lower: ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
    upper: ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
    ko: ['1234567890', 'ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ'],
    koShift: ['1234567890', 'ㅃㅉㄸㄲㅆㅛㅕㅑㅒㅖ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ'],
    sym: ['!@#$%^&*()', '-_=+[]{}\\|', ';:\'",.<>/?', '`~'],
  };
  const TYPES = new Set(['text', 'email', 'password', 'search', 'url', 'tel', 'number']);
  const OPACITY = [1, 0.75, 0.55], OPACITY_KEY = 'urigg-osk-opacity';

  /* ── 두벌식 한글 조합 ──
     조합 중인 한 글자(cho·jung·jong 자모)를 들고 있다가, 이어 붙일 수 없는 자모가 오면 확정하고 새 글자를 시작한다. */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const V2 = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
  const C2 = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
  const split = (pair, table) => Object.keys(table).find((k) => table[k] === pair); // 'ㄺ' → 'ㄹㄱ'
  const isVowel = (c) => JUNG.includes(c);
  let st = null; // { cho, jung, jong } 조합 중인 글자, 없으면 null
  const glyph = (s) => {
    if (!s) return '';
    if (s.cho && s.jung) return String.fromCharCode(0xac00 + (CHO.indexOf(s.cho) * 21 + JUNG.indexOf(s.jung)) * 28 + JONG.indexOf(s.jong || ''));
    return s.cho || s.jung || '';
  };
  // 자모 하나를 넣는다. 확정된 글자(있으면)를 돌려준다
  const feed = (c) => {
    let done = '';
    if (isVowel(c)) {
      if (!st) st = { jung: c };
      else if (st.jong) {
        // 받침을 다음 글자의 첫소리로 넘긴다 (겹받침이면 뒤쪽만)
        const pair = split(st.jong, C2);
        const moved = pair ? pair[1] : st.jong;
        st.jong = pair ? pair[0] : '';
        done = glyph(st); st = { cho: moved, jung: c };
      } else if (st.jung) {
        if (V2[st.jung + c]) st.jung = V2[st.jung + c];
        else { done = glyph(st); st = { jung: c }; }
      } else st.jung = c;
    } else {
      if (!st) st = { cho: c };
      else if (st.cho && st.jung && !st.jong && JONG.includes(c)) st.jong = c;
      else if (st.jong && C2[st.jong + c]) st.jong = C2[st.jong + c];
      else { done = glyph(st); st = { cho: c }; }
    }
    return done;
  };
  // 조합 중인 글자에서 마지막 자모 하나를 뺀다. 뺄 게 없으면 false
  const unfeed = () => {
    if (!st) return false;
    if (st.jong) { const pair = split(st.jong, C2); st.jong = pair ? pair[0] : ''; }
    else if (st.jung && st.cho) { const pair = split(st.jung, V2); if (pair) st.jung = pair[0]; else delete st.jung; }
    else if (st.jung) { const pair = split(st.jung, V2); if (pair) st.jung = pair[0]; else st = null; }
    else st = null;
    return true;
  };

  let layer = 'lower', lang = 'en', target = null, committed = '';
  let opacity = 0;
  try { opacity = Math.max(0, OPACITY.indexOf(+localStorage.getItem(OPACITY_KEY))); } catch {}

  const kb = document.createElement('div');
  kb.className = 'osk glass glass--dark';
  kb.hidden = true;
  kb.setAttribute('role', 'group');
  kb.setAttribute('aria-label', '화면 키보드');
  document.body.append(kb);

  const key = (label, act, cls = '') => `<button type="button" class="osk__key ${cls}" data-act="${act}">${label}</button>`;
  const esc = (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c;
  const rowsNow = () => (layer === 'sym' ? ROWS.sym : lang === 'ko' ? (layer === 'upper' ? ROWS.koShift : ROWS.ko) : ROWS[layer]);
  const draw = () => {
    const rows = rowsNow().map((r) => [...r].map((c) => key(esc(c), 'c:' + esc(c))).join(''));
    rows[3] = key('⇧', 'shift', 'osk__key--wide' + (layer === 'upper' ? ' is-on' : '')) + rows[3] + key('⌫', 'back', 'osk__key--wide');
    rows.push(key(layer === 'sym' ? (lang === 'ko' ? '한' : 'abc') : '#+=', 'sym', 'osk__key--wide') + key(lang === 'ko' ? '한/<b>영</b>' : '<b>한</b>/영', 'lang', 'osk__key--wide')
      + key('@', 'c:@') + key('.', 'c:.') + key('', 'c: ', 'osk__key--space')
      + key(`투명 ${Math.round(OPACITY[opacity] * 100)}%`, 'opacity', 'osk__key--wide') + key('닫기', 'close', 'osk__key--wide') + key('입력', 'enter', 'osk__key--wide osk__key--go'));
    kb.innerHTML = `<p class="osk__preview" aria-live="polite"></p>` + rows.map((r) => `<div class="osk__row">${r}</div>`).join('');
    kb.style.opacity = OPACITY[opacity];
    preview();
  };
  // 키보드가 입력칸을 가려도 무엇을 치고 있는지 보이게, 맨 위에 지금 값을 보여 준다 (비밀번호는 가림)
  const preview = () => {
    const p = kb.querySelector('.osk__preview');
    if (!p || !target) return;
    const v = target.type === 'password' ? '•'.repeat(target.value.length) : target.value;
    // 길면 지금 치는 끝부분이 보이게 앞을 줄인다
    p.textContent = (v.length > 32 ? '…' + v.slice(-32) : v) || target.placeholder || ' ';
    p.classList.toggle('is-empty', !target.value);
  };

  // React가 관리하는 입력칸도 알아듣도록, 원래 value setter로 넣고 input 이벤트를 보낸다
  const setValue = (el, v) => {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // 입력칸 값 = 확정된 글 + 조합 중인 글자. 그사이 다른 곳(자동완성 등)에서 값이 바뀌었으면 그 값부터 다시 시작
  const sync = () => { if (target && target.value !== committed + glyph(st)) { committed = target.value; st = null; } };
  const show = () => { if (target) { setValue(target, committed + glyph(st)); preview(); } };
  const commit = () => { committed += glyph(st); st = null; };
  const typeText = (s) => { sync(); commit(); committed += s; show(); };
  const typeJamo = (c) => { sync(); committed += feed(c); show(); };
  const back = () => {
    sync();
    if (!unfeed()) committed = [...committed].slice(0, -1).join('');
    show();
  };

  // 입력칸을 가릴 자리면 키보드를 화면 위쪽에 둔다 (iframe 안 입력칸은 iframe 위치를 더한다)
  const place = () => {
    if (!target) return;
    let r = target.getBoundingClientRect();
    const frameEl = target.ownerDocument !== document && document.querySelector('.widget-frame');
    if (frameEl) { const f = frameEl.getBoundingClientRect(); r = { top: r.top + f.top, bottom: r.bottom + f.top }; }
    kb.classList.remove('is-top');
    const k = kb.getBoundingClientRect();
    if (r.bottom > k.top - 8) kb.classList.add('is-top');
  };

  const open = (el) => {
    if (target !== el) { target = el; committed = el.value; st = null; }
    lang = el.type === 'text' || el.type === 'search' ? 'ko' : 'en';
    layer = 'lower';
    draw();
    kb.hidden = false;
    place();
  };
  const close = () => { commit(); kb.hidden = true; target = null; };

  // 키를 눌러도 입력칸의 포커스를 뺏지 않는다
  kb.addEventListener('pointerdown', (e) => e.preventDefault());
  kb.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act.startsWith('c:')) {
      const c = act.slice(2);
      if (lang === 'ko' && layer !== 'sym' && (CHO.includes(c) || isVowel(c))) typeJamo(c);
      else typeText(c);
      if (layer === 'upper') { layer = 'lower'; draw(); }
    } else if (act === 'back') back();
    else if (act === 'shift') { layer = layer === 'upper' ? 'lower' : 'upper'; draw(); }
    else if (act === 'sym') { layer = layer === 'sym' ? 'lower' : 'sym'; draw(); }
    else if (act === 'lang') { sync(); commit(); lang = lang === 'ko' ? 'en' : 'ko'; layer = 'lower'; draw(); }
    else if (act === 'opacity') {
      opacity = (opacity + 1) % OPACITY.length;
      try { localStorage.setItem(OPACITY_KEY, String(OPACITY[opacity])); } catch {}
      draw();
    } else if (act === 'close') close();
    else if (act === 'enter') {
      const form = target?.form;
      sync(); commit(); show();
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
  addEventListener('resize', place);

  // 캘린더 위젯: 로그인 뒤 화면이 바뀌어도 같은 문서라서 한 번만 걸면 되지만, iframe이 새로 불러와지면 다시 건다
  const frame = document.querySelector('.widget-frame');
  const hook = () => { try { watch(frame.contentDocument); } catch {} };
  if (frame) { frame.addEventListener('load', hook); if (frame.contentDocument?.readyState === 'complete') hook(); }
})();
