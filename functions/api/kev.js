import { fetchKev } from '../../lib/kev.js';
import { cached } from '../../lib/cache.js';

// GET /api/kev — 실제 악용 중인 취약점 최근 추가분 (1시간 캐시)
export const onRequestGet = (ctx) => cached(ctx, 3600, () => fetchKev());
