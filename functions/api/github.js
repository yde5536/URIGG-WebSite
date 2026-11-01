import { fetchGithub } from '../../lib/github.js';
import { cached } from '../../lib/cache.js';

// GET /api/github — security.log 목차 + 캘린더 최신 버전 (1시간 캐시)
export const onRequestGet = (ctx) => cached(ctx, 3600, () => fetchGithub(ctx.env.GITHUB_TOKEN));
