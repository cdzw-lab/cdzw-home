#!/usr/bin/env node
/**
 * 本地预览服务器（纯静态，零依赖）
 *
 *   node tools/serve.mjs          默认 http://127.0.0.1:8080/
 *   node tools/serve.mjs 9000     指定端口
 *
 * 为什么需要它：博客文章是通过 fetch() 读取 posts/*.md 再在浏览器里渲染的，
 * 而浏览器出于安全策略会拦截 file:// 下的 fetch。所以本地预览必须走 HTTP。
 * 兼容 Node 20 / 22 / 24 / 26
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { buildPosts } from './build-posts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const port = Number(process.argv[2] || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    // 本地预览最常见的坑：新增了 posts/*.md 却忘了重建清单，页面就看不到新文章。
    // 这里每次请求 posts.json 都顺手重建一次（几十毫秒），省掉这一步手工操作。
    if (pathname === '/posts.json') {
      try { buildPosts({ quiet: true }); }
      catch (e) { console.warn('自动重建 posts.json 失败：' + ((e && e.message) || e)); }
    }

    let target = normalize(join(root, pathname));
    // 防止路径穿越
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403).end('403');
      return;
    }

    // 兼容 clean-url：/post 回退到 post.html。
    // 与 serve、GitHub Pages 等保持一致，否则本地预览 404、线上却正常，
    // 会让人以为是代码问题而白花时间。
    try {
      await stat(target);
    } catch (e) {
      try {
        await stat(target + '.html');
        target = target + '.html';
      } catch (e2) { /* 保持原样，按 404 处理 */ }
    }

    const info = await stat(target);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: pathname + '/' }).end();
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    }).end(body);
    console.log('200 ' + pathname);
  } catch (err) {
    // 和 GitHub Pages 一致：未命中的路径返回站点根的 404.html
    try {
      const nf = await readFile(join(root, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(nf);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
    }
    console.log('404 ' + req.url);
  }
});

server.listen(port, '127.0.0.1', () => {
  try {
    const r = buildPosts({ quiet: true });
    console.log('文章清单: 已自动重建，共 ' + r.posts.length + ' 篇');
    r.problems.forEach(function (p) { console.warn('  ⚠️  ' + p); });
  } catch (e) {
    console.warn('文章清单重建失败：' + ((e && e.message) || e));
  }
  console.log('预览地址: http://127.0.0.1:' + port + '/');
  console.log('根目录  : ' + root);
  console.log('按 Ctrl+C 停止');
});
