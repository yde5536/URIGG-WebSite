import { fetchNews } from '../../lib/news.js';
import { cached } from '../../lib/cache.js';

// GET /api/news — 보안 뉴스 (30분 캐시)
export const onRequestGet = (ctx) => cached(ctx, 1800, () => fetchNews());
