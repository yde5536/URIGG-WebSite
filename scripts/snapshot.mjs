// API가 실패할 때 쓸 예비 데이터를 site/data/에 저장한다.  node scripts/snapshot.mjs [이름…]
// 이름을 주면 그것만 (예: node scripts/snapshot.mjs ctf kev). /api/net은 보는 사람의 IP라 저장하지 않는다.
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchBlog } from '../lib/rss.js';
import { fetchGithub } from '../lib/github.js';
import { fetchNews } from '../lib/news.js';
import { fetchCtf } from '../lib/ctf.js';
import { fetchKev } from '../lib/kev.js';

const ALL = {
  blog: [fetchBlog, (d) => `${d.posts.length} posts`],
  github: [() => fetchGithub(process.env.GITHUB_TOKEN), (d) => `${d.groups.length} groups, ${Object.keys(d.activity).length} active days · release ${d.release?.tag}`],
  news: [fetchNews, (d) => `${d.items.length} items`],
  ctf: [fetchCtf, (d) => `${d.events.length} events`],
  kev: [fetchKev, (d) => `${d.items.length} items (catalog ${d.version})`],
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL);

await mkdir('site/data', { recursive: true });
await Promise.all(names.map(async (name) => {
  const [load, summary] = ALL[name];
  const data = await load();
  await writeFile(`site/data/${name}.json`, JSON.stringify(data, null, 2));
  console.log(`${name}: ${summary(data)}`);
}));
