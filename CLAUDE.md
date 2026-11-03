# URIGG-WebSite — notes for Claude

Read this first. It carries the decisions made with the user so work can continue on any machine.

## The user

- Speaks Korean. Reply in Korean, plainly, on Windows terms.
- Claude does all development. The user only does steps that need their own accounts (GitHub, Cloudflare, Supabase, Microsoft Store…). Explain those **screen by screen** (which button, which menu, what to type).
- Often asks for opinions before building ("의견 교환"): when they say so, propose and wait; don't build.
- Sends screenshots and sketches; follow them literally, and ask when something is ambiguous.

## Names (fixed 2026-11-03)

- **웹 (web)**: urigg.pages.dev, title cycles "URIGG ↔ Security.log Website". This repo.
- **바탕화면 (wall)**: the `?wall` page shown by Lively as the laptop wallpaper, title "Security.log Wallpaper". This repo.
- **허브 (hub)**: the Windows desktop app for the home PC, title "Security.log HUB", repo `yde5536/URIGG-DesktopApp`.
- "허브/hub" means only the desktop app from now on. Older notes that said "hub" for the website were rewritten.

## What the site is

- **A personal dashboard for the user, not a self-introduction.** No About/bio/"안녕하세요, 저는…" copy. Content is written for the user as the reader.
- **Never put the user's real name or school on the site.**
- Never paste tokens, ICS URLs or other secrets into the repo or chat; they live only in Cloudflare/Supabase settings.
- Live at https://urigg.pages.dev (Cloudflare **Pages**, not Workers; output dir `site`, Functions in `functions/`).

## Deploy flow

Work on branch `scroll-story` (preview: scroll-story.urigg.pages.dev). Production is `main`.

```
git fetch origin && git merge --ff-only origin/main      # the hourly calendar Action commits to main
git add … && git commit -m "…"
git push origin scroll-story
git checkout main && git merge --ff-only scroll-story && git push origin main && git checkout scroll-story
```

The user has asked for every change to go to production ("운영 사이트 반영"); keep doing that unless told otherwise. A `taste-skill` backup branch exists; don't delete it without asking.

## Layout of the code

- `site/` static page: `index.html`, `css/base.css` (tokens, top bar, footer), `css/scenes.css` (dashboard, tiles, Notes scene, wall mode), `css/theme-glass.css` (liquid glass), `js/main.js` (data, status, alerts, tabs, top-bar lens), `js/scenes.js` (scroll scene, title scramble), `js/dday.js` (D-day + autocomplete + D-day/today alerts).
- `functions/api/{blog,github,news,ctf,kev}.js` → `lib/*.js`. Edge-cached (`lib/cache.js`; ctf = CTFtime upcoming events, kev = latest 20 of the CISA Known Exploited Vulnerabilities catalog, both 1 h). Client loads `/api/<name>?v=API_VERSION` (bump `API_VERSION` in main.js when a response shape changes), falls back to `site/data/*.json` (`npm run snapshot`, or `node scripts/snapshot.mjs ctf kev` for some).
- `functions/api/net.js` returns the viewer's own IP / ISP / location from `request.cf`, `no-store`, skipped by the service worker, never snapshotted. The dev server mocks it with 203.0.113.7.
- `/api/github` needs `GITHUB_TOKEN` (set in Cloudflare for Production and Preview). The grass uses the GraphQL contribution calendar (all repos).
- Today tile = the real Cowork Calendar app built for the web: `scripts/build-calendar.mjs` → `site/calendar/`. `.github/workflows/calendar-widget.yml` rebuilds hourly and commits to main when the app changed.
- D-day data: Supabase table `ddays` (`db/ddays.sql`, owner-only RLS), same project as the calendar; the site borrows the widget's login from localStorage (`sb-dfvcgacadkaglgtooxdy-auth-token`).
- Wallpaper mode: `?wall` (dashboard only, no scroll, taskbar padding, reloads once 30 min of real time have passed: checked every 30 s and when the page becomes visible again, because Lively pauses freeze timers). Used with Lively Wallpaper on the user's **laptop only** (ultrawide layout doesn't matter for wall). Lively forwards the mouse but not the keyboard, and its preview window doesn't share storage with the wallpaper, so `js/osk.js` shows a mouse-driven on-screen keyboard for inputs (widget login, D-day name): 한/영 key with a 2-beolsik Hangul composer (text inputs start in Korean, email/password in English), a preview line of what is typed, an opacity key (100/75/55 %, remembered), and it moves to the top of the screen when it would cover the input. Lively does not forward the mouse wheel either, so `js/drag.js` lets you drag the in-tile lists to scroll (5 px threshold; a drag swallows the following click so links do not open). Lively's web wallpaper (WebView2) gets a fresh temp profile every launch unless its **disk cache** setting is on (`"CefDiskCache": false` in `%LocalAppData%\Packages\12030rocksdanister.LivelyWallpaper_*\LocalCache\Local\Lively Wallpaper\Settings.json`); with it off the login is lost on every restart. Desktop icons hidden. User declined battery saving.
- Wide screens (`@media (min-width: 1800px)`, end of scenes.css): the home PC is 3440×1440 at **125 % scaling**, so Chrome's page is about 2752×1024 CSS px. There the website dashboard is pinned to one screen (rows `minmax(0, 1fr)`, the D-day list scrolls inside its tile), and the Network tab's info is set larger and spread evenly over the tile. **The latency chart must never appear on the website** (wallpaper only; the user said so on 2026-11-02). The laptop (1536 px) never hits these rules. Test with `DPR=1.25 node scripts/dev/shot.mjs … 2752 1024`.

## Design decisions (keep unless the user changes them)

- Brand kit lives in its own public repo **yde5536/URIGG-Brand** (local `../URIGG-Brand`, created 2026-11-02): `tokens/urigg.css` + `urigg.json`, `components/urigg-glass.css` (`u-` classes), logos, icons, brand page `index.html`. Other URIGG projects load it via `https://cdn.jsdelivr.net/gh/yde5536/URIGG-Brand@main/…`. The website itself still uses its own CSS; when a design value changes here, update the kit too. The **URIGG universe** discussion (what to build next: Drop, Desktop app, bot, Tab, profile, domain…, the "URIGG API" split idea, Claude's recommendations) is written up in `../URIGG-Brand/UNIVERSE.md`; read it when the user wants to continue that talk.

- Liquid glass dashboard on a dark, slowly drifting aurora. Tiles are fairly transparent but not clear.
- Top bar: fully clear when stuck, only edge refraction + RGB prism (SVG backdrop filter, Chromium only, map built at devicePixelRatio) and a thin rim.
- Crimson only on main buttons. Fonts: Switzer + Pretendard, mono for small labels/times.
- Round URIGG logo with a soft halo, no ring, no float.
- Dashboard grid: Today | News (2 rows); all four columns the same width | D-day · Shortcuts / 알림·Log · Programs. In `?wall` only, Programs is swapped for Commits (GitHub grass + 연속 / 이번 주 / 26주), and the right column is split about 62/38: Shortcuts tall (3 × 3, adds Chrome, 파일 탐색기, VMware; tighter row gaps keep icons at ~80px), Commits short (rows `10fr 2.4fr 7.6fr`).
- Wall-only shortcuts: Chrome opens https://www.google.com/ (Chrome is the laptop's default browser); 파일 탐색기 and VMware use `urigg-explorer:` / `urigg-vmware:`, registered per user by `scripts/windows/urigg-launchers.reg` (remove with `urigg-launchers-remove.reg`). They take no arguments, so nothing in the URL reaches the program. Claude's auto mode refuses to import registry files; the user double-clicks the .reg.
- Tile-title tabs with the sliding glass pill (generic code in main.js; `data-pane` elements in a head show only with their pane): 알림 · Log · CTF, Security News · KEV · Vuln, Shortcuts · Network, and in `?wall` Commits · Keyword (security keyword of the day: term, original name, one-line Korean description from `site/data/keywords.json`, picked by KST day; keywords, not commands). 알림 first; red unread count clears after the list is seen for 2 s. Network is fetched only when its tab is shown (refresh button, every 5 min while visible, on online/offline); "VPN" is a guess (browser vs IP time zone, hosting/VPN ISP names). In `?wall` only, a latency line chart sits under the network info: a HEAD request to `/images/favicon-32.png?ping=…` every 30 s on the clock (:00 and :30, rescheduled each time so it never drifts; timestamp = send time) while the page is visible (no Function call), last 30 min kept in localStorage (`urigg-ping`) so the 30-min reload keeps the history; failed pings (or over 5 s, aborted) break the line (dashed marker); a ping that took over 8 s of wall time means Lively paused mid-request and is dropped, and stored samples of 5 s or more are discarded on load (a 134 s sample once wrecked the scale); hover shows a crosshair, dot and "HH:MM · n ms". The user first chose 1 min (CPU worry), then asked for 30 s aligned to absolute time. KEV rows show the CVE first so it is never cut. A third news tab, Vuln (web and wall), explains one well-known vulnerability at a time from `site/data/vulns.json` (40, Korean, CVSS only where certain): name, facts (CVE / 대상 / 유형 / 공개 / CVSS), description, then (2026-11-02) a scrolling `.vuln__body` with 어떻게 터지나 (`flow` steps), 예시 (`ex`, only widely known textbook strings, may be null), 막는 법 (`fix`), 분류 (`cwe`, only when certain, else null) and NVD / CVE.org links, "n / 40" and a "다음 취약점 ›" button; the position is kept per browser in localStorage. (It first sat as a card above the KEV list; a long name pushed the tile wider, so it got its own tab.)
- Title scrambles between "URIGG" and "Security.log Website" every 15 s ("Security.log Wallpaper" in `?wall`; "Security.log HUB" is now the desktop app's name); tagline is `urigg.pages.dev`. In `?wall` the logo (104px) and title (4rem) are larger, so tiles are shorter.
- Shortcuts: 3 × 2 liquid-glass square icons, white mono, label below: Claude (desktop app, `claude://`), VS Code (`vscode://`), YouTube, GitHub (profile), 티스토리 (blog front page), 드림핵. Icons in `site/images/icons/` (simple-icons CC0; Dreamhack mark cut from its official logo).
- Short laptop windows (≤960px tall): compact header, Today without its title row, side-by-side D-day, so the dashboard fits one screen without cutting tiles.
- The footer (`.end`) is liked; keep it.
- Rejected before: green hacker theme, ASCII banners, rim glow, red-heavy looks, decorative photos, Progress gauges, refraction/prism lens on the moving 알림/Log pill (tried and reverted 2026-11-02).

## Checking work

```
node scripts/dev/serve.mjs site 4181                       # local static server
node scripts/dev/shot.mjs http://localhost:4181/ out.png 1440 900   # headless Edge screenshot with mocked login/data
```

Look at screenshots at desktop, wide and phone widths before deploying. If the `design-taste-frontend` skill is installed, also run its `lint.mjs`, `inspect.mjs --app --allow glass,shadow,mono,gradient,covered-text,heavy-shadow,button-fx` and `scenes.mjs` on `site/index.html`.

Gotchas: `core.autocrlf=true` (normalize `\r\n` in Node edit scripts); write regexes with the Edit tool, since shell heredocs have eaten backslashes before.

## Open threads (as of 2026-11-02)

**Next task (to start on the home PC): the 허브 (hub) = URIGG-DesktopApp.** A Tauri Windows app titled "Security.log HUB" that is the `?wall` dashboard as a normal window, for the home PC (3440×1440, not used as wallpaper there). Decisions, reasons and the step list are in `../URIGG-Brand/UNIVERSE.md` (first section). In short: structure C (the app bundles a copy of the wall page and diverges freely; data still from `urigg.pages.dev/api`; native features only in the bundled UI for safety), auto-update via GitHub releases, **manual sync** of a shared-file list, repo `yde5536/URIGG-DesktopApp` (the user creates it), no osk.js / drag.js in the app. **Step 1 is in this repo: split `site/js/main.js` into per-feature files without changing behaviour**, then add CORS for the Tauri origins to the API.

Session of 2026-11-02 ended with everything deployed to `main`. Not yet confirmed by the user:
- Lively: turning on the **disk cache** setting keeps the widget login across restarts; logging in with the on-screen keyboard works.
- `scripts/windows/urigg-launchers.reg` double-clicked on the laptop, and 파일 탐색기 / VMware / Claude (`claude://`) shortcuts open from the wallpaper.
- Lively 성능 tab: "응용 프로그램이 포커싱 되었을 때" set to pause (suggested for CPU).
- Command palette: **on hold** (2026-11-02). The user agreed it isn't needed now: the dashboard already shows everything on one screen, there is little to search, and the main use is the `?wall` wallpaper where keyboard input may not work. If notes/blog posts pile up, add a plain notes + blog search box in the Notes scene instead. Design notes kept in case: Spotlight-style centered glass bar, sliding glass pill selection, grouped results, Korean initial-consonant (초성) search, Ctrl+K and `/`.
- Feature ideas offered, not built (ask first): alerts for new KEV entries today (data already loaded). **Built 2026-11-02:** beginner CTF alerts — `lib/ctf.js` marks `beginner` (title/description says beginner/newbie/novice/entry-level/introductory/first-timer/초보/입문/high school; not Prequalified, not a Final); online beginner CTFs starting within 7 days or live are red alerts, and the CTF tab shows a 초보 chip; quiz mode for Keyword/Vuln (hide the description until clicked); Linux Master (리눅스마스터 2급 2차, on the D-day list) practice question of the day with self-written multiple choice; study timer with today's total; WebRTC IP-leak check, IP change log, speed test for the Network tab; Linux Master score chart from commit messages; news keyword highlight.
- Housekeeping: taste-skill lint has 1 WARN (too many em dashes); old PNGs now replaced by WebP (`logo-round-240.png`, `calendar-icon.png`) are unused by the page but still in `site/images`.
- Testing notes: this PC is slow; headless Edge from `shot.mjs` sometimes lingers on port 9337 and later runs attach to it (stale localStorage, hangs). Wrap test runs in `timeout`, and never pass `/dev/null` as an output path (Git Bash writes a file named `nul`).
