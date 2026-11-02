import { fetchCtf } from '../../lib/ctf.js';
import { cached } from '../../lib/cache.js';

// GET /api/ctf — 다가오는 CTF 대회 (1시간 캐시)
export const onRequestGet = (ctx) => cached(ctx, 3600, () => fetchCtf());
