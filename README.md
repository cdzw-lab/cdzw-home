# 超导智网

基于分布式账本的软件定义计算机体系结构的第一个具体实现。 

## 核心特征

该系统的核心特征有三： 
1. 这是一种真正的并行计算机系统； 
2. 网络和计算机的融合：计算机即网络，网络即计算机； 
3. 这是一种有心的计算机系统；

## 核心技术
1. 点对点支付技术：支持微支付；支持批处理；实现了全流程无人化；尤其适合用于 Agent 收付款；
2. 抗垄断的共识协议：一票否决机制；
3. 防止财务造假的记账法；
4. 分布式账本；

## 核心产品清单
1. 基于数字签名技术的非中心化统一账户系统；
2. 基于微支付技术的可信流量分成服务；
3. 抗 DDoS 的防护盾服务；
4. 数字心脏服务；

## 官网

官网源码位于 `gh-pages` 分支，当前部署在 GitHub Pages 项目页：

- 访问地址：https://cdzw-lab.github.io/cdzw-home/

## 博客

文章放在 `posts/` 目录，用 Markdown 写，浏览器端实时渲染。

### 写一篇新文章

```bash
node tools/new-post.mjs "文章标题" my-slug   # 创建 posts/my-slug.md 并自动更新清单
node tools/build-posts.mjs                   # 手动重建清单（改了文件名或日期之后）
```

文章开头的 front matter：

```yaml
---
title: 文章标题
date: 2026-10-06
summary: 列表页显示的一句话摘要
tags: 标签一, 标签二
---
```

`title` 和 `date` 必填，且 `date` 必须是 `YYYY-MM-DD`，否则构建时会给出警告。

### 本地预览

**双击 `tools/preview.command`**（macOS）会自动起服务并打开浏览器。也可以在终端里跑：

```bash
node tools/serve.mjs          # http://127.0.0.1:8080/
```

> ⚠️ 不要直接双击 `blog.html`。文章是页面用 `fetch()` 读取 `.md` 之后渲染的，
> 浏览器会拦截 `file://` 下的 fetch —— 那样只会看到「文章列表载入失败」。
> 部署到 GitHub Pages 后没有这个限制。

### 目录结构

| 路径 | 作用 |
|---|---|
| `posts/*.md` | 文章正文 |
| `posts.json` | 文章清单，由脚本生成，不要手改 |
| `blog.html` | 文章列表页 |
| `post.html#/<slug>` | 文章详情页，slug 就是文件名去掉 `.md` |
| `md.js` | 无依赖的 Markdown 渲染器 |
| `tools/build-posts.mjs` | 扫描 posts/ 生成 posts.json |
| `tools/new-post.mjs` | 新建文章骨架 |
| `tools/serve.mjs` | 本地预览服务器 |
| `tools/test-md.mjs` | 渲染器测试：`node tools/test-md.mjs` |

> 文章标识用 URL fragment（`#/slug`）而不是查询串（`?p=slug`）。
> 因为很多静态服务器会做 clean-url 跳转——`/post.html?p=x` 会 **301 到 `/post`**，
> 查询串在跳转中被丢弃，页面就变成「没有指定文章」。fragment 由浏览器保留，
> 能安全穿过 301，因此在 GitHub Pages、`serve`、`python -m http.server` 上都一致。
> 旧的 `?p=` 链接仍然兼容。

### 支持的语法

标题、段落、粗体、斜体、删除线、行内代码、围栏代码块、有序与无序列表（可嵌套）、
引用、分隔线、表格、链接、图片、自动链接。

为安全起见，正文里的 HTML 标签会被原样转义显示，不会执行。

