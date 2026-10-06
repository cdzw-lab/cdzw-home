#!/usr/bin/env node
/**
 * 扫描 posts/*.md，读取 front matter，生成 posts.json 清单
 *
 *   node tools/build-posts.mjs
 *
 * 也可以被 tools/serve.mjs 导入复用（预览时自动重建）。
 * 兼容 Node 20 / 22 / 24 / 26
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');

export function buildPosts(options) {
  const quiet = !!(options && options.quiet);
  const say = quiet ? function () {} : console.log.bind(console);
  const warn = quiet ? function () {} : console.warn.bind(console);

  const postsDir = join(repo, 'posts');
  const outFile = join(repo, 'posts.json');

  // 复用浏览器端的解析逻辑（md.js），避免前后端两份实现逐渐漂移
  const sandbox = {};
  new Function('window', readFileSync(join(repo, 'md.js'), 'utf8'))(sandbox);
  const MD = sandbox.MarkdownLite;
  if (!MD) throw new Error('无法从 md.js 载入 MarkdownLite');
  if (!existsSync(postsDir)) throw new Error('找不到目录: ' + postsDir);

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

  // 子目录里的 .md 不会被收录。这里主动指出来，避免文件被静默丢掉。
  try {
    for (const entry of readdirSync(postsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = readdirSync(join(postsDir, entry.name))
        .filter(function (f) { return f.endsWith('.md'); });
      if (sub.length) {
        problems.push('posts/' + entry.name + '/ 下有 ' + sub.length +
          ' 个 .md 不会被收录（文章必须直接放在 posts/ 根目录）');
      }
    }
  } catch (e) { /* 忽略 */ }

  // 新的在前；同一天按 slug 稳定排序
  posts.sort(function (a, b) {
    const d = String(b.date).localeCompare(String(a.date));
    return d !== 0 ? d : a.slug.localeCompare(b.slug);
  });

  writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), posts: posts }, null, 2) + '\n');

  say('已生成 posts.json：' + posts.length + ' 篇文章');
  posts.forEach(function (p) {
    say('  ' + (p.date || '(无日期)') + '  ' + p.slug + '  ' + p.title);
  });

  if (problems.length) {
    warn('');
    warn('⚠️  有问题需要处理：');
    problems.forEach(function (p) { warn('  - ' + p); });
  }

  return { posts: posts, problems: problems };
}

// 只在被当作脚本直接运行时才执行（被 import 时不动）
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const result = buildPosts();
    if (result.problems.length) process.exitCode = 1;
  } catch (err) {
    console.error(String((err && err.message) || err));
    process.exit(1);
  }
}
