// 코워크 캘린더 앱의 위젯 화면을 웹용으로 빌드해 site/calendar/에 넣는다.  npm run build:calendar
// 앱 저장소는 건드리지 않는다: 임시 폴더에 받아서 데스크톱 전용 부분만 바꾼 뒤 빌드한다.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = 'https://github.com/yde5536/URIGG-ClaudeCalender.git';
const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'site', 'calendar');
const WORK = join(tmpdir(), 'urigg-calendar-src');
const APP = join(WORK, 'app');
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

// 1) 앱 소스 받기 (최신 main)
rmSync(WORK, { recursive: true, force: true });
run(`git clone --depth 1 ${REPO} "${WORK}"`);
const commit = execSync('git rev-parse --short HEAD', { cwd: WORK }).toString().trim();

// 2) 웹에서 쓰지 않는 버튼 빼기. 찾는 글이 없으면(앱 코드가 바뀌면) 바로 멈춰서 알린다.
function patch(file, edits) {
  const path = join(APP, 'src', file);
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of edits) {
    if (!text.includes(from)) throw new Error(`${file}: 바꿀 부분을 찾지 못했습니다 → ${from}`);
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}
patch('Widget.tsx', [
  ['<button onClick={() => openMainWindow(selected)}>전체 창 열기</button>', ''],
  ['<button onClick={closeApp}>종료</button>', ''],
  ['onDoubleClick={() => openMainWindow(day)}', ''],
  ['title="더블클릭: 전체 창"', ''],
  ['<div className="resize-grip" onMouseDown={startWidgetResize} title="크기 조절" aria-hidden="true" />', ''],
]);
// 로그인 화면의 종료(X) 버튼
{
  const path = join(APP, 'src', 'Login.tsx');
  const text = readFileSync(path, 'utf8');
  const next = text.replace(/<button className="icon-btn" onClick=\{closeApp\}[\s\S]*?<\/button>/, '');
  if (next === text) throw new Error('Login.tsx: 종료 버튼을 찾지 못했습니다');
  writeFileSync(path, next);
}
// 전체 창(FullCalendar)은 웹에서 쓰지 않으니 묶지 않는다 (용량이 크게 준다)
patch('App.tsx', [
  ['import { MainCalendar } from "./MainCalendar";', ''],
  ['<MainCalendar key={session.user.id} />', 'null'],
]);
patch('main.tsx', [['import App from "./App";', 'import App from "./App";\nimport "./embed.css";']]);
cpSync(join(ROOT, 'calendar-web', 'embed.css'), join(APP, 'src', 'embed.css'));

// 3) 데스크톱 기능 자리에 빈 껍데기를 끼운 Vite 설정
const stub = join(ROOT, 'calendar-web', 'stubs', 'tauri.js').replace(/\\/g, '/');
writeFileSync(join(APP, 'vite.web.config.mjs'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      { find: /^@tauri-apps\\/api\\/.*$/, replacement: '${stub}' },
      { find: /^@tauri-apps\\/plugin-(updater|process)$/, replacement: '${stub}' },
    ],
  },
  build: { outDir: ${JSON.stringify(OUT.replace(/\\/g, '/'))}, emptyOutDir: true },
});
`);

// 4) 설치하고 빌드
run('npm ci --ignore-scripts --no-audit --no-fund', APP);
mkdirSync(OUT, { recursive: true });
run('npx vite build --config vite.web.config.mjs', APP);
writeFileSync(join(OUT, 'BUILD.txt'), `URIGG-ClaudeCalender ${commit} — scripts/build-calendar.mjs로 만든 웹용 위젯\n`);
console.log(`\n캘린더 위젯 빌드 완료: site/calendar (앱 커밋 ${commit})`);
if (!existsSync(join(OUT, 'index.html'))) process.exit(1);
