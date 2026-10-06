/* ===================================================
   超导智网 — 博客脚本
   blog.html（列表）与 post.html（文章）共用
   依赖：posts.json 清单；文章页额外依赖 md.js
   =================================================== */
(function () {
  'use strict';

  var MANIFEST = 'posts.json';
  var WORDS_PER_MIN = 350;   // 中文阅读速度，字/分钟

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

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
    return m ? m[1] + '.' + m[2] + '.' + m[3] : String(d || '');
  }

  function readingMinutes(chars) {
    var n = Number(chars) || 0;
    return n > 0 ? Math.max(1, Math.round(n / WORDS_PER_MIN)) : 0;
  }

  // 卡片视觉是纯色块，所以色相必须彼此拉开，否则相邻文章长得一样；
  // 色相只落在品牌两端：暖色 8~45°、冷绿 140~168°
  // （对应 blockcell 的 primary #ea580c 与 --cyber #00ff9d）。
  // 但纯色块下「高饱和 + 中明度」的绿会变成刺眼的荧光绿，
  // 所以每一项都带自己的 饱和/明度：暖色保持鲜亮，绿色压暗压灰。
  var PALETTE = [
    [8,   76, 48],   // 朱红
    [21,  80, 49],   // 橙
    [35,  74, 46],   // 琥珀
    [45,  70, 44],   // 金
    [140, 48, 37],   // 森林绿
    [150, 46, 39],   // 绿
    [157, 52, 38],   // 薄荷绿
    [168, 50, 36]    // 青绿
  ];
  function paletteOf(slug) {
    var s = String(slug), h = 2166136261;          // FNV-1a
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    // 必须取高位：FNV-1a 的低位在 % 8 下分布极差（实测 1000 个样本
    // 会出现 23/446 的两极分布，且这两篇真实文章直接撞色）。
    // 改用 >>> 24 之后分布接近理想值。
    return PALETTE[(h >>> 24) % PALETTE.length];
  }

  // 输出成 CSS 变量，供卡片视觉与强调条共用
  function colorVars(c) {
    return '--h:' + c[0] + ';--s:' + c[1] + '%;--l:' + c[2] + '%;';
  }

  function firstGlyph(title) {
    var t = String(title || '').trim();
    return t ? t.charAt(0).toUpperCase() : '文';
  }

  function stateBox(kind, title, detail) {
    return '<div class="state state--' + esc(kind) + '">' +
             '<p class="state__title">' + esc(title) + '</p>' +
             (detail ? '<p class="state__detail">' + esc(detail) + '</p>' : '') +
           '</div>';
  }

  // 把底层错误翻译成使用者能照着做的提示。
  // 最常见的一种：直接双击打开 HTML（file://）时浏览器会拦截 fetch，
  // 只抛出 "Failed to fetch" —— 对使用者完全没有信息量。
  function describeError(err) {
    if (window.location.protocol === 'file:') {
      return '浏览器不允许页面在 file:// 下读取本地数据文件。' +
             '请在仓库根目录运行 node tools/serve.mjs（或双击 tools/preview.command），' +
             '再打开 http://127.0.0.1:8080/ 预览。部署到 GitHub Pages 后没有这个限制。';
    }
    // 带上「请求了哪个地址、失败成什么样」，否则一句 Failed to fetch 无从排查
    var detail = String((err && err.message) || err);
    var where = '';
    try {
      where = ' ｜ 请求地址 ' + new URL(MANIFEST, window.location.href).href;
    } catch (e) {}
    return detail + where + ' ｜ 若地址无误，请强制刷新（Cmd+Shift+R）排除缓存。';
  }

  /* ===================================================
     列表页
     =================================================== */
  function cardHtml(post, i) {
    var tags = tagsOf(post);
    var c = paletteOf(post.slug);
    var mins = readingMinutes(post.chars);

    return '<a class="pcard" href="' + postHref(post.slug) + '"' +
             ' style="' + colorVars(c) + '--i:' + i + '">' +
             '<span class="pcard__art" aria-hidden="true">' +
               '<span class="pcard__mark">' + esc(firstGlyph(post.title || post.slug)) + '</span>' +
             '</span>' +
             '<span class="pcard__body">' +
               '<span class="pcard__meta">' +
                 '<time datetime="' + esc(post.date) + '">' + esc(fmtDate(post.date)) + '</time>' +
                 (mins ? '<i class="pcard__sep"></i><span>' + mins + ' 分钟</span>' : '') +
               '</span>' +
               '<span class="pcard__title">' + esc(post.title || post.slug) + '</span>' +
               (post.summary ? '<span class="pcard__summary">' + esc(post.summary) + '</span>' : '') +
               (tags.length
                 ? '<span class="pcard__tags">' + tags.map(function (t) {
                     return '<em>' + esc(t) + '</em>';
                   }).join('') + '</span>'
                 : '') +
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

      var counter = document.getElementById('postCount');
      if (counter && posts.length) {
        counter.textContent = '共 ' + posts.length + ' 篇';
        counter.hidden = false;
      }

      if (!posts.length) {
        box.innerHTML = stateBox('empty', '还没有文章', '第一篇正在路上。');
        return;
      }
      box.innerHTML = posts.map(cardHtml).join('');
    }).catch(function (err) {
      box.removeAttribute('aria-busy');
      box.innerHTML = stateBox('error', '文章列表载入失败',
        err && err.status === 404
          ? '找不到 posts.json，可能还没有生成文章清单（运行 node tools/build-posts.mjs）。'
          : describeError(err));
    });

    return true;
  }

  /* ===================================================
     文章页
     =================================================== */
  // 文章标识优先放在 URL fragment 里，而不是查询串。
  // 原因：很多静态服务器会做 clean-url 跳转（/post.html?p=x → 301 → /post），
  // 查询串会在跳转中丢掉，而 fragment 由浏览器保留，能安全穿过 301。
  // 仍兼容 ?p= 形式，避免已分享出去的旧链接失效。
  function postHref(slug) {
    return 'post.html#/' + encodeURIComponent(slug);
  }

  function slugFromUrl() {
    var m = /[?&]p=([^&]*)/.exec(window.location.search);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, ' '));

    var h = window.location.hash.replace(/^#/, '');
    if (!h) return '';
    if (h.charAt(0) === '/') h = h.slice(1);
    if (/^s\d+$/.test(h)) return '';   // 这是正文标题的锚点，不是文章
    return decodeURIComponent(h);
  }

  // 依据正文标题生成目录，并跟随滚动高亮当前小节
  function buildToc(root) {
    var heads = root.querySelectorAll('h2, h3');
    var aside = document.getElementById('postToc');
    var list = document.getElementById('tocList');
    if (!aside || !list || heads.length < 2) return;

    var html = '';
    Array.prototype.forEach.call(heads, function (h, i) {
      h.id = 's' + (i + 1);
      html += '<li class="toc__item toc__item--' + h.tagName.toLowerCase() + '">' +
                '<a href="#' + h.id + '">' + esc(h.textContent) + '</a></li>';
    });
    list.innerHTML = html;
    aside.hidden = false;

    var links = list.querySelectorAll('a');
    // 页面顶部还没有标题进入判定带，先把首项点亮
    if (links.length) links[0].classList.add('is-active');

    if (!('IntersectionObserver' in window)) return;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Array.prototype.forEach.call(links, function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-92px 0px -58% 0px', threshold: 0 });
    Array.prototype.forEach.call(heads, function (h) { spy.observe(h); });
  }

  // markdown 里的相对地址是相对 .md 文件写的（图片就放在 posts/ 下），
  // 但文章页位于站点根目录，浏览器会把这些地址解析到根上，导致图片 404。
  // 这里统一补上 posts/ 前缀，让作者直接写文件名即可。
  // 只处理 <img>：站内页面链接用的是 post.html#/slug 这类根目录路径，不能改写。
  function fixRelativeImageUrls(root, postFile) {
    var dir = String(postFile).replace(/[^/]*$/, '');   // 'posts/'
    if (!dir) return;

    Array.prototype.forEach.call(root.querySelectorAll('img[src]'), function (img) {
      var v = img.getAttribute('src') || '';
      if (!v) return;
      if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return;        // http: data: 等
      if (v.charAt(0) === '/' || v.slice(0, 2) === '//') return;
      img.setAttribute('src', dir + v.replace(/^\.\//, ''));
    });
  }

  function pagerLink(label, post) {
    var c = paletteOf(post.slug);
    return '<a class="pager__item" href="' + postHref(post.slug) + '"' +
             ' style="' + colorVars(c) + '">' +
             '<span class="pager__label">' + esc(label) + '</span>' +
             '<span class="pager__title">' + esc(post.title || post.slug) + '</span>' +
           '</a>';
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
    if (!slug) { fail('没有指定文章', '请从博客列表进入。'); return true; }
    if (!window.MarkdownLite) { fail('渲染器未载入', 'md.js 没有成功加载。'); return true; }

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
        bodyEl.innerHTML = window.MarkdownLite.render(parsed.body);
        fixRelativeImageUrls(bodyEl, post.file);

        var c = paletteOf(post.slug);
        article.style.setProperty('--h', c[0]);
        article.style.setProperty('--s', c[1] + '%');
        article.style.setProperty('--l', c[2] + '%');

        buildToc(bodyEl);

        var tags = tagsOf(post);
        var mins = readingMinutes(post.chars || (bodyEl.textContent || '').replace(/\s/g, '').length);

        header.innerHTML =
          '<p class="post__meta">' +
            '<time datetime="' + esc(post.date) + '">' + esc(fmtDate(post.date)) + '</time>' +
            (mins ? '<i class="post__sep"></i><span>' + mins + ' 分钟阅读</span>' : '') +
          '</p>' +
          '<h1 class="post__title">' + esc(post.title || post.slug) + '</h1>' +
          (tags.length
            ? '<ul class="post__tags">' + tags.map(function (t) {
                return '<li>' + esc(t) + '</li>';
              }).join('') + '</ul>'
            : '');

        document.title = (post.title || post.slug) + ' | 超导智网';

        // 所有文章共用 post.html，规范链接必须按文章改写。
        // 从 location 推导而非写死域名，将来换自有域名无需改动。
        var canon = document.querySelector('link[rel="canonical"]');
        if (canon && /^https?:$/.test(window.location.protocol)) {
          canon.setAttribute('href', window.location.origin + window.location.pathname +
            '#/' + encodeURIComponent(post.slug));
        }

        var links = [];
        if (posts[idx - 1]) links.push(pagerLink('较新一篇', posts[idx - 1]));
        if (posts[idx + 1]) links.push(pagerLink('较早一篇', posts[idx + 1]));
        if (links.length) {
          pager.innerHTML = links.join('');
          pager.hidden = false;
        }

        status.hidden = true;
        article.hidden = false;
      });
    }).catch(function (err) {
      if (err && err.notFound) fail('找不到这篇文章', '链接可能已经失效，或者文章被重命名了。');
      else if (err && err.status === 404) fail('文章文件缺失', 'posts.json 里记录了这个条目，但对应的 .md 文件不存在。');
      else fail('文章载入失败', describeError(err));
    });

    return true;
  }

  /* ===================================================
     启动
     =================================================== */
  function boot() {
    if (renderPost()) return;
    renderList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
