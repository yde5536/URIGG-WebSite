# URIGG — security.log

URIGG의 개인 거점 사이트. 나를 소개하는 페이지가 아니라 내가 쓰는 대시보드다. Cloudflare Pages(`*.pages.dev`)에 배포한다.

- 첫 화면 대시보드: 상태, 오늘 일정(접근 키), 최근 글, 바로가기, 공부 진행도, 캘린더 앱
- 아래 스크롤 장면: 블로그 로그 카드, security.log `tree` 출력, 캘린더 패킷 경로
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
  images/
functions/api/         Cloudflare Pages Functions (blog, github)
calendar-web/          캘린더 위젯 웹 빌드용 빈 껍데기(Tauri 대체)와 스타일
lib/                   RSS·GitHub 파싱
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
