# URIGG — security.log

URIGG의 개인 거점 사이트. 나를 소개하는 페이지가 아니라 내가 쓰는 대시보드다. Cloudflare Pages(`*.pages.dev`)에 배포한다.

- 첫 화면 대시보드: 상태, 오늘 일정(접근 키), 최근 글, 바로가기, 공부 진행도, 캘린더 앱
- 아래 스크롤 장면: 블로그 로그 카드, security.log `tree` 출력, 캘린더 패킷 경로
- 블로그: 티스토리 [security.log](https://urigg-security.tistory.com/) RSS → `/api/blog`
- 저장소: [URIGG-security.log](https://github.com/yde5536/URIGG-security.log) README 목차 → `/api/github`
- 일정: 코워크 캘린더 ICS 구독 주소 → `/api/today` (접근 키 필요)

## 구조

```
site/                  정적 파일 (Pages 출력 폴더)
  index.html
  css/base.css         기본 스타일
  css/scenes.css       대시보드와 스크롤 장면 배치
  css/theme-glass.css  리퀴드 글래스 테마
  css/theme-hacker.css 터미널 테마 (초록 포인트, 터미널 창 타일)
  js/main.js           데이터 불러오기, 대시보드, grep, tree
  js/scenes.js         스크롤 장면 엔진
  js/glass.js          유리 굴절 효과 (Chromium 전용)
  data/*.json          API가 실패할 때 쓰는 예비 데이터
  images/
functions/api/         Cloudflare Pages Functions (blog, github, today)
lib/                   RSS·GitHub·ICS 파싱
scripts/snapshot.mjs   예비 데이터 갱신: npm run snapshot
```

## 로컬 실행

```
npm run dev     # http://127.0.0.1:8788 (wrangler로 함수까지 실행)
```

일정까지 확인하려면 프로젝트 폴더에 `.dev.vars`(git에 올라가지 않음)를 만든다.

```
ICS_URL=https://.../ics/<토큰>.ics
SITE_KEY=<접근 키>
```

## Cloudflare Pages 설정

- Build command: 비움
- Build output directory: `site`
- 비밀 변수 `ICS_URL`, `SITE_KEY`: 오늘 일정 (Production과 Preview 둘 다)
- (선택) `GITHUB_TOKEN`: GitHub API 한도를 늘릴 때만

## 테마 끄기

`site/index.html`에서 해당 줄을 지우면 그 효과만 빠진다.

```html
<link rel="stylesheet" href="css/theme-hacker.css">   <!-- 터미널 테마 -->
<link rel="stylesheet" href="css/theme-glass.css">    <!-- 리퀴드 글래스 -->
<script src="js/glass.js" defer></script>              <!-- 유리 굴절 -->
```

## 백업

리퀴드 글래스 첫 버전은 태그 `v1-liquid-glass`에 있다.
