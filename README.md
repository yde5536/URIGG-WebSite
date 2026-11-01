# URIGG — security.log

URIGG의 개인 웹사이트. Cloudflare Pages(`*.pages.dev`)에 배포한다.

- 자기소개
- 블로그: 티스토리 [security.log](https://urigg-security.tistory.com/) RSS → `/api/blog`
- 저장소: [URIGG-security.log](https://github.com/yde5536/URIGG-security.log) README 목차 → `/api/github`
- 코워크 캘린더 소개와 최신 버전 다운로드

## 구조

```
site/                 정적 파일 (Pages 출력 폴더)
  index.html
  css/base.css        기본 스타일 (taste-skill 방향)
  css/theme-glass.css 리퀴드 글래스 테마
  js/glass.js         유리 굴절 효과 (Chromium 전용)
  js/main.js          데이터 불러오기, 책장/grep, 목차
  data/*.json         API가 실패할 때 쓰는 예비 데이터
  images/
functions/api/        Cloudflare Pages Functions
lib/                  RSS·GitHub 파싱 (함수와 스냅샷 스크립트가 같이 씀)
scripts/snapshot.mjs  예비 데이터 갱신: npm run snapshot
```

## 로컬 실행

```
npm run dev     # http://127.0.0.1:8788 (wrangler로 함수까지 실행)
```

## Cloudflare Pages 설정

- Build command: 비움
- Build output directory: `site`
- (선택) 환경 변수 `GITHUB_TOKEN`: GitHub API 한도를 늘릴 때만

## 리퀴드 글래스 → taste-skill 기본 스타일로 바꾸기

`site/index.html`에서 아래 두 줄을 지우면 된다. 나머지는 그대로 동작한다.

```html
<link rel="stylesheet" href="css/theme-glass.css">
<script src="js/glass.js" defer></script>
```

## 사진 출처

모두 Wikimedia Commons. 사이트 맨 아래에도 표기되어 있다.

- IBM 2314 DiskDrives and IBM 2540 CardReader Punch — Scott Gerstenberger, public domain
- Network cables in server room — ProjectManhattan, CC BY-SA 3.0
- ASR-33 Teletype terminal — Rama & Musée Bolo, CC BY-SA 2.0
