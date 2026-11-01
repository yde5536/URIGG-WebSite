# URIGG — security.log

URIGG의 개인 거점 사이트. 나를 소개하는 페이지가 아니라 내가 쓰는 대시보드다. Cloudflare Pages(`*.pages.dev`)에 배포한다.

- 첫 화면 대시보드: 상태, 오늘 일정(캘린더 위젯), D-day, 바로가기, 커밋 잔디(Activity), 보안 뉴스, 블로그 로그, 프로그램
- 아래 스크롤 장면: security.log `tree` 출력과 커밋 잔디(Notes)
- 블로그: 티스토리 [security.log](https://urigg-security.tistory.com/) RSS → `/api/blog`
- 저장소: [URIGG-security.log](https://github.com/yde5536/URIGG-security.log) README 목차 → `/api/github`
- 일정: 코워크 캘린더 앱의 위젯 화면을 웹용으로 빌드해 Today 칸에 띄운다 (`site/calendar/`, 앱 계정으로 로그인)

## 구조

```
site/                  정적 파일 (Pages 출력 폴더)
  index.html
  css/base.css         기본 스타일
  css/scenes.css       대시보드와 스크롤 장면 배치
  css/theme-glass.css  리퀴드 글래스 (배경 빛, 유리 타일, 유리 버튼)
  js/main.js           데이터 불러오기, 대시보드, grep, tree
  js/scenes.js         스크롤 장면 엔진
  data/*.json          API가 실패할 때 쓰는 예비 데이터
  manifest.webmanifest, sw.js  앱처럼 설치(PWA)
  images/
functions/api/         Cloudflare Pages Functions (blog, github, news)
calendar-web/          캘린더 위젯 웹 빌드용 빈 껍데기(Tauri 대체)와 스타일
lib/                   RSS·GitHub·보안 뉴스 파싱
scripts/snapshot.mjs   예비 데이터 갱신: npm run snapshot
scripts/build-calendar.mjs  캘린더 위젯 웹 빌드: npm run build:calendar (앱을 업데이트한 뒤 다시 실행)
```

## 로컬 실행

```
npm run dev     # http://127.0.0.1:8788 (wrangler로 함수까지 실행)
```


## Cloudflare Pages 설정

- Build command: 비움
- Build output directory: `site`
- (선택) `GITHUB_TOKEN`: GitHub API 한도를 늘릴 때만

## 테마 끄기

`site/index.html`에서 해당 줄을 지우면 그 효과만 빠진다.

```html
<link rel="stylesheet" href="css/theme-glass.css">    <!-- 유리 패널 -->
```

## 백업

리퀴드 글래스 첫 버전은 태그 `v1-liquid-glass`에 있다.

## D-day

대시보드의 D-day 칸에서 직접 추가·삭제하고 "메인"으로 큰 D-day를 고른다. 저장은 코워크 캘린더와 같은 Supabase의 `ddays` 표이고,
처음 한 번 `db/ddays.sql`을 Supabase SQL Editor에서 실행해야 한다. 로그인은 Today 칸의 캘린더 위젯 로그인을 같이 쓴다.

## 캘린더 위젯 자동 갱신

`.github/workflows/calendar-widget.yml`이 매시간 앱을 받아 다시 빌드하고, 바뀌었을 때만 커밋한다. GitHub 저장소의 Actions 탭에서 바로 돌릴 수도 있다.
