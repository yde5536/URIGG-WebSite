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
  css/base.css        스타일 (taste-skill 방향)
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

## 디자인 버전

- 지금: taste-skill "The page is the object" — 출입증, 편지지, 메뉴판, 서류 폴더, 엽서. 로고의 네이비와 종이색 두 가지.
- 백업: 리퀴드 글래스 버전은 태그 `v1-liquid-glass` (브랜치 `liquid-glass`)에 있다. 되돌리려면

```
git checkout main
git reset --hard v1-liquid-glass
git push --force-with-lease
```
