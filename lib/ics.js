// 코워크 캘린더 ICS 구독 주소 → 오늘과 앞으로 며칠의 일정
const KST = 9 * 60 * 60_000;

// "한 줄 75바이트" 규칙으로 접힌 줄을 다시 붙인다
const unfold = (text) => text.replace(/\r?\n[ \t]/g, '');
const unescape = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// 20261101 → 한국 날짜 자정, 20261101T053000Z → 그 시각
function parseTime(value, params) {
  if (/VALUE=DATE/.test(params) || /^\d{8}$/.test(value)) {
    const [, y, m, d] = value.match(/^(\d{4})(\d{2})(\d{2})/);
    return { at: Date.UTC(+y, +m - 1, +d) - KST, allDay: true };
  }
  const [, y, mo, d, h, mi, s] = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  return { at: value.endsWith('Z') ? utc : utc - KST, allDay: false };
}

export function parseIcs(text) {
  const events = [];
  for (const block of unfold(text).split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const field = (name) => {
      const m = body.match(new RegExp(`^${name}((?:;[^:\\r\\n]*)?):(.*)$`, 'm'));
      return m ? { params: m[1], value: m[2].trim() } : null;
    };
    const start = field('DTSTART'), end = field('DTEND'), summary = field('SUMMARY');
    if (!start || !summary) continue;
    const s = parseTime(start.value, start.params);
    const e = end ? parseTime(end.value, end.params) : { at: s.at + (s.allDay ? 86_400_000 : 3_600_000) };
    events.push({ title: unescape(summary.value), start: s.at, end: e.at, allDay: s.allDay });
  }
  return events.sort((a, b) => a.start - b.start);
}

// 지난달 1일부터 다음 달 말일까지(한국 시간) 걸쳐 있는 일정 — 달력에서 앞뒤 한 달씩 넘겨 볼 수 있게
export function months(events, now = Date.now()) {
  const k = new Date(now + KST);
  const y = k.getUTCFullYear(), m = k.getUTCMonth();
  const from = Date.UTC(y, m - 1, 1) - KST;
  const until = Date.UTC(y, m + 2, 1) - KST;
  const today = Math.floor((now + KST) / 86_400_000) * 86_400_000 - KST;
  return {
    today: new Date(today).toISOString(),
    from: new Date(from).toISOString(),
    until: new Date(until).toISOString(),
    events: events
      .filter((e) => e.end > from && e.start < until)
      .map((e) => ({ ...e, start: new Date(e.start).toISOString(), end: new Date(e.end).toISOString() })),
  };
}
