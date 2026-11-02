# URIGG-WebSite — notes for Claude

Read this first. It carries the decisions made with the user so work can continue on any machine.

## The user

- Speaks Korean. Reply in Korean, plainly, on Windows terms.
- Claude does all development. The user only does steps that need their own accounts (GitHub, Cloudflare, Supabase, Microsoft Store…). Explain those **screen by screen** (which button, which menu, what to type).
- Often asks for opinions before building ("의견 교환"): when they say so, propose and wait; don't build.
- Sends screenshots and sketches; follow them literally, and ask when something is ambiguous.

## What the site is

- **A personal hub for the user, not a self-introduction.** No About/bio/"안녕하세요, 저는…" copy. Content is written for the user as the reader.
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
- `functions/api/{blog,github,news}.js` → `lib/*.js`. Edge-cached (`lib/cache.js`). Client loads `/api/<name>?v=API_VERSION` (bump `API_VERSION` in main.js when a response shape changes), falls back to `site/data/*.json` (`npm run snapshot`).
- `/api/github` needs `GITHUB_TOKEN` (set in Cloudflare for Production and Preview). The grass uses the GraphQL contribution calendar (all repos).
- Today tile = the real Cowork Calendar app built for the web: `scripts/build-calendar.mjs` → `site/calendar/`. `.github/workflows/calendar-widget.yml` rebuilds hourly and commits to main when the app changed.
- D-day data: Supabase table `ddays` (`db/ddays.sql`, owner-only RLS), same project as the calendar; the site borrows the widget's login from localStorage (`sb-dfvcgacadkaglgtooxdy-auth-token`).
- Wallpaper mode: `?wall` (dashboard only, no scroll, taskbar padding, reload every 30 min). Used with Lively Wallpaper on the user's **laptop only** (ultrawide layout doesn't matter for wall). Lively forwards the mouse but not the keyboard, and its preview window doesn't share storage with the wallpaper, so `js/osk.js` shows a mouse-driven on-screen keyboard for inputs (widget login, D-day name). Desktop icons hidden. User declined battery saving.

## Design decisions (keep unless the user changes them)

- Liquid glass dashboard on a dark, slowly drifting aurora. Tiles are fairly transparent but not clear.
- Top bar: fully clear when stuck, only edge refraction + RGB prism (SVG backdrop filter, Chromium only, map built at devicePixelRatio) and a thin rim.
- Crimson only on main buttons. Fonts: Switzer + Pretendard, mono for small labels/times.
- Round URIGG logo with a soft halo, no ring, no float.
- Dashboard grid: Today | News (2 rows) | D-day · Shortcuts / 알림·Log · Programs.
- 알림/Log tabs: 알림 first; sliding glass pill; red unread count clears after the list is seen for 2 s.
- Title scrambles between "URIGG" and "Security.log Website" every 15 s; tagline is `urigg.pages.dev`.
- The footer (`.end`) is liked; keep it.
- Rejected before: green hacker theme, ASCII banners, rim glow, red-heavy looks, decorative photos, Progress gauges.

## Checking work

```
node scripts/dev/serve.mjs site 4181                       # local static server
node scripts/dev/shot.mjs http://localhost:4181/ out.png 1440 900   # headless Edge screenshot with mocked login/data
```

Look at screenshots at desktop, wide and phone widths before deploying. If the `design-taste-frontend` skill is installed, also run its `lint.mjs`, `inspect.mjs --app --allow glass,shadow,mono,gradient,covered-text,heavy-shadow,button-fx` and `scenes.mjs` on `site/index.html`.

Gotchas: `core.autocrlf=true` (normalize `\r\n` in Node edit scripts); write regexes with the Edit tool, since shell heredocs have eaten backslashes before.

## Open threads (as of 2026-11-02)

- Lively: on-screen keyboard just shipped; confirm the user could log in to the widget on the wallpaper.
- Wall mode: replace the Programs tile with something glanceable (big clock, time to next event, GitHub grass…). Agreed in principle; **wait for the user to say go** and pick the content.
- Command palette: **on hold** (2026-11-02). The user agreed it isn't needed now: the dashboard already shows everything on one screen, there is little to search, and the main use is the `?wall` wallpaper where keyboard input may not work. If notes/blog posts pile up, add a plain notes + blog search box in the Notes scene instead. Design notes kept in case: Spotlight-style centered glass bar, sliding glass pill selection, grouped results, Korean initial-consonant (초성) search, Ctrl+K and `/`.
- Feature ideas offered: Linux Master mock-exam score chart from commit messages, study timer, next-post reminder, news keyword highlight.
