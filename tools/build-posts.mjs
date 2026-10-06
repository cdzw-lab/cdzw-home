#!/usr/bin/env node
/**
 * 扫描 posts/*.md，读取 front matter，生成 posts.json 清单
 *
 *   node tools/build-posts.mjs
 *
 * 兼容 Node 20 / 22 / 24 / 26
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const postsDir = join(repo, 'posts');
const outFile = join(repo, 'posts.json');

// 复用浏览器端的解析逻辑（md.js），避免前后端两份实现逐渐漂移
const sandbox = {};
new Function('window', readFileSync(join(repo, 'md.js'), 'utf8'))(sandbox);
const MD = sandbox.MarkdownLite;

if (!MD) {
  console.error('无法从 md.js 载入 MarkdownLite');
  process.exit(1);
}

if (!existsSync(postsDir)) {
  console.error('找不到目录: ' + postsDir);
  process.exit(1);
}

const files = readdirSync(postsDir)
  .filter(function (f) { return f.endsWith('.md') && !f.startsWith('.'); })
  .sort();

const posts = [];
const problems = [];

for (const file of files) {
  const raw = readFileSync(join(postsDir, file), 'utf8');
  const parsed = MD.splitFrontMatter(raw);
  const meta = parsed.meta || {};
  const slug = basename(file, '.md');

  if (!meta.title) problems.push(file + ' 缺少 title');
  if (!meta.date) problems.push(file + ' 缺少 date');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    problems.push(file + ' 的 date 格式不是 YYYY-MM-DD: ' + meta.date);
  }

  posts.push({
    slug: slug,
    file: 'posts/' + file,
    title: meta.title || slug,
    date: meta.date || '',
    summary: meta.summary || '',
    chars: parsed.body.replace(/\s/g, '').length,
    tags: meta.tags
      ? meta.tags.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean)
      : []
  });
}

// 新的在前；同一天按 slug 稳定排序
posts.sort(function (a, b) {
  const d = String(b.date).localeCompare(String(a.date));
  return d !== 0 ? d : a.slug.localeCompare(b.slug);
});

writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), posts: posts }, null, 2) + '\n');

console.log('已生成 posts.json：' + posts.length + ' 篇文章');
posts.forEach(function (p) {
  console.log('  ' + (p.date || '(无日期)') + '  ' + p.slug + '  ' + p.title);
});

if (problems.length) {
  console.warn('');
  console.warn('⚠️  front matter 有问题：');
  problems.forEach(function (p) { console.warn('  - ' + p); });
  process.exitCode = 1;
}
