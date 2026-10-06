/* ===================================================
   超导智网 — 博客脚本
   blog.html（列表）与 post.html（文章）共用
   依赖：posts.json 清单；文章页额外依赖 md.js
   =================================================== */
(function () {
  'use strict';

  var MANIFEST = 'posts.json';
  var WORDS_PER_MIN = 350;   // 中文阅读速度，字/分钟

  function $(sel) { return document.querySelector(sel); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function get(url, asJson) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) {
        var err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return asJson ? res.json() : res.text();
    });
  }

  function tagsOf(post) {
    if (Array.isArray(post.tags)) return post.tags.filter(Boolean);
    if (typeof post.tags === 'string') {
      return post.tags.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
    }
    return [];
  }

  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? m[1] + '-' + m[2] + '-' + m[3] : String(d || '');
  }

  function readingMinutes(text) {
    var chars = String(text).replace(/\s/g, '').length;
    return Math.max(1, Math.round(chars / WORDS_PER_MIN));
  }

  function stateBox(kind, title, detail) {
    return '<div class="state state--' + esc(kind) + '">' +
             '<p class="state__title">' + esc(title) + '</p>' +
             (detail ? '<p class="state__detail">' + esc(detail) + '</p>' : '') +
           '</div>';
  }

  function tagList(tags) {
    if (!tags.length) return '';
    return '<ul class="post__tags">' + tags.map(function (t) {
      return '<li>' + esc(t) + '</li>';
    }).join('') + '</ul>';
  }

  /* ===================================================
     列表页
     =================================================== */
  function cardHtml(post, i) {
    var tags = tagsOf(post);
    return '<a class="post-card" href="post.html?p=' + encodeURIComponent(post.slug) + '" style="--i:' + i + '">' +
             '<div class="post-card__meta">' +
               '<time datetime="' + esc(post.date) + '">' + esc(fmtDate(post.date)) + '</time>' +
               (tags.length ? '<span class="post-card__sep">·</span><span>' + esc(tags.join(' / ')) + '</span>' : '') +
             '</div>' +
             '<h2 class="post-card__title">' + esc(post.title || post.slug) + '</h2>' +
             (post.summary ? '<p class="post-card__summary">' + esc(post.summary) + '</p>' : '') +
             '<span class="post-card__more">阅读全文' +
               '<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg>' +
             '</span>' +
           '</a>';
  }

  function renderList() {
    var box = document.getElementById('postList');
    if (!box) return false;

    get(MANIFEST, true).then(function (data) {
      var posts = (data && data.posts) || [];

      posts.sort(function (a, b) {
        var d = String(b.date || '').localeCompare(String(a.date || ''));
        return d !== 0 ? d : String(a.slug).localeCompare(String(b.slug));
      });

      box.removeAttribute('aria-busy');

      if (!posts.length) {
        box.innerHTML = stateBox('empty', '还没有文章', '第一篇正在路上。');
        return;
      }
      box.innerHTML = posts.map(cardHtml).join('');
    }).catch(function (err) {
      box.removeAttribute('aria-busy');
      box.innerHTML = stateBox('error', '文章列表载入失败',
        err && err.status === 404 ? '找不到 posts.json，可能是还没有生成文章清单。' : String(err.message || err));
    });

    return true;
  }

  /* ===================================================
     文章页
     =================================================== */
  function slugFromUrl() {
    var m = /[?&]p=([^&]*)/.exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function addHeadingAnchors(root) {
    var heads = root.querySelectorAll('h2, h3');
    Array.prototype.forEach.call(heads, function (h, i) {
      if (!h.id) h.id = 's' + (i + 1);
    });
    return heads.length;
  }

  function renderPost() {
    var article = document.getElementById('post');
    if (!article) return false;

    var status = document.getElementById('postStatus');
    var header = document.getElementById('postHeader');
    var bodyEl = document.getElementById('postBody');
    var pager = document.getElementById('postPager');

    function fail(title, detail) {
      status.className = 'state state--error';
      status.innerHTML = stateBox('error', title, detail);
      status.hidden = false;
    }

    var slug = slugFromUrl();
    if (!slug) {
      fail('没有指定文章', '请从博客列表进入。');
      return true;
    }

    if (!window.MarkdownLite) {
      fail('渲染器未载入', 'md.js 没有成功加载。');
      return true;
    }

    get(MANIFEST, true).then(function (data) {
      var posts = (data && data.posts) || [];
      var idx = -1;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].slug === slug) { idx = i; break; }
      }
      if (idx < 0) {
        var e = new Error('not found');
        e.notFound = true;
        throw e;
      }

      var post = posts[idx];
      return get(post.file, false).then(function (raw) {
        var parsed = window.MarkdownLite.splitFrontMatter(raw);
        var html = window.MarkdownLite.render(parsed.body);

        bodyEl.innerHTML = html;
        addHeadingAnchors(bodyEl);

        var tags = tagsOf(post);
        var mins = readingMinutes(bodyEl.textContent || '');

        header.innerHTML =
          '<div class="post__meta">' +
            '<time datetime="' + esc(post.date) + '">' + esc(fmtDate(post.date)) + '</time>' +
            '<span class="post__sep">·</span>' +
            '<span class="post__read">' +
              '<svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg>' + mins + ' 分钟' +
            '</span>' +
          '</div>' +
          '<h1 class="post__title">' + esc(post.title || post.slug) + '</h1>' +
          tagList(tags);

        document.title = (post.title || post.slug) + ' | 超导智网';

        // 所有文章共用 post.html，规范链接必须按文章改写。
        // 从 location 推导而非写死域名，将来换自有域名无需改动。
        var canon = document.querySelector('link[rel="canonical"]');
        if (canon && /^https?:$/.test(window.location.protocol)) {
          canon.setAttribute('href', window.location.origin + window.location.pathname +
            '?p=' + encodeURIComponent(post.slug));
        }

        // 较新 / 较早，而不是含糊的「上一篇 / 下一篇」
        var newer = posts[idx - 1];
        var older = posts[idx + 1];
        var links = [];
        if (newer) links.push(pagerLink('较新一篇', newer));
        if (older) links.push(pagerLink('较早一篇', older));
        if (links.length) {
          pager.innerHTML = links.join('');
          pager.hidden = false;
        }

        status.hidden = true;
        article.hidden = false;
      });
    }).catch(function (err) {
      if (err && err.notFound) {
        fail('找不到这篇文章', '链接可能已经失效，或者文章被重命名了。');
      } else if (err && err.status === 404) {
        fail('文章文件缺失', 'posts.json 里记录了这个条目，但对应的 .md 文件不存在。');
      } else {
        fail('文章载入失败', String((err && err.message) || err));
      }
    });

    return true;
  }

  function pagerLink(label, post) {
    return '<a class="post-pager__item" href="post.html?p=' + encodeURIComponent(post.slug) + '">' +
             '<span class="post-pager__label">' + esc(label) + '</span>' +
             '<span class="post-pager__title">' + esc(post.title || post.slug) + '</span>' +
           '</a>';
  }

  /* ===================================================
     启动
     =================================================== */
  function boot() {
    if (renderPost()) return;
    renderList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
