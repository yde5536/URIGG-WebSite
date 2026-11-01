import { fetchBlog } from '../../lib/rss.js';
import { cached } from '../../lib/cache.js';

// GET /api/blog — 티스토리 최신 글 (30분 캐시)
export const onRequestGet = (ctx) => cached(ctx, 1800, () => fetchBlog());
