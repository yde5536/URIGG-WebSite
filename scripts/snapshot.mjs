// API가 실패할 때 쓸 예비 데이터를 site/data/에 저장한다.  node scripts/snapshot.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchBlog } from '../lib/rss.js';
import { fetchGithub } from '../lib/github.js';
import { fetchNews } from '../lib/news.js';

await mkdir('site/data', { recursive: true });
const [blog, github, news] = await Promise.all([fetchBlog(), fetchGithub(process.env.GITHUB_TOKEN), fetchNews()]);
await writeFile('site/data/blog.json', JSON.stringify(blog, null, 2));
await writeFile('site/data/github.json', JSON.stringify(github, null, 2));
await writeFile('site/data/news.json', JSON.stringify(news, null, 2));
console.log(`blog: ${blog.posts.length} posts · github: ${github.groups.length} groups, ${Object.keys(github.activity).length} active days · release ${github.release?.tag} · news: ${news.items.length}`);
