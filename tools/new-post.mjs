#!/usr/bin/env node
/**
 * 新建一篇文章
 *
 *   node tools/new-post.mjs "文章标题"
 *   node tools/new-post.mjs "文章标题" my-custom-slug
 *
 * 会创建 posts/<slug>.md 并自动刷新 posts.json。
 * 兼容 Node 20 / 22 / 24 / 26
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const postsDir = join(repo, 'posts');

const title = process.argv[2];
let slug = process.argv[3];

if (!title) {
  console.error('用法: node tools/new-post.mjs "文章标题" [slug]');
  process.exit(1);
}

function pad(n) { return String(n).padStart(2, '0'); }
const now = new Date();
const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

if (!slug) {
  slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // 只保留 ASCII；纯中文标题会退化成空
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  if (!slug) {
    slug = 'post-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
           '-' + pad(now.getHours()) + pad(now.getMinutes());
    console.log('标题里没有可用的英文字符，已自动生成 slug：' + slug);
    console.log('想换成更易读的文件名，重命名 posts/ 下的文件后再跑一次 build-posts.mjs。');
  }
}

mkdirSync(postsDir, { recursive: true });

const target = join(postsDir, slug + '.md');
if (existsSync(target)) {
  console.error('文件已存在，未覆盖: ' + target);
  process.exit(1);
}

const fence = '```';
const inlineCode = '`code`';

const template = [
  '---',
  'title: ' + title,
  'date: ' + today,
  'summary: 一句话摘要，会显示在博客列表里。',
  'tags: 标签一, 标签二',
  '---',
  '',
  '在这里写正文。',
  '',
  '## 小标题',
  '',
  '支持 **粗体**、*斜体*、~~删除线~~、行内代码 ' + inlineCode + ' 和 [链接](https://example.com)。',
  '',
  fence + 'js',
  "console.log('代码块');",
  fence,
  '',
  '> 引用文字',
  '',
  '- 列表项一',
  '- 列表项二',
  ''
].join('\n');

writeFileSync(target, template);
console.log('已创建 ' + target);

execFileSync(process.execPath, [join(here, 'build-posts.mjs')], { stdio: 'inherit' });
