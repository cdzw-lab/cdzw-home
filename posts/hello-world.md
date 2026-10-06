---
title: 博客开张
date: 2026-10-06
summary: 这个博客怎么运作：写 Markdown、跑一条命令、推送。
tags: 站点, 说明
---

这里是超导智网的博客，用来放设计思路、实现笔记和工程实践。

## 怎么写一篇

在仓库根目录执行：

```bash
node tools/new-post.mjs "文章标题" my-slug
```

它会创建 `posts/my-slug.md`，并自动刷新 `posts.json` 清单。写完正文后：

```bash
node tools/build-posts.mjs
git add -A
git commit -m "post: 文章标题"
git push cdzb168 gh-pages
```

## 文章格式

文件开头是 front matter：

```yaml
---
title: 文章标题
date: 2026-10-06
summary: 列表页显示的一句话摘要
tags: 标签一, 标签二
---
```

`title` 和 `date` 是必填的，其余可以省略。日期必须是 `YYYY-MM-DD` 格式，否则构建时会给出警告。

## 几点约定

> 渲染在浏览器里完成，所以推送之后立刻就能生效，不需要等构建。

- 文件名就是文章的 URL 标识，尽量用英文短横线命名
- 正文里的 HTML 不会被执行，会被原样转义显示
- 单个换行会渲染成换行，段落之间记得空一行

想看看支持哪些语法，可以直接读 [Markdown 语法速查](post.html?p=markdown-guide)。
