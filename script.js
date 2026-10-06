/* ===================================================
   超导智网 cdzw.ai — 交互脚本
   =================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : null; };
  var reduceMotion = !!(mq('(prefers-reduced-motion: reduce)') || {}).matches;

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }
  function recall(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /* ---------------------------------------------------
     1. 主题切换（深色 / 浅色）
     --------------------------------------------------- */
  var THEME_KEY = 'cdzw-theme';
  var themeToggle = $('#themeToggle');

  function applyTheme(theme, persist) {
    var isLight = theme === 'light';
    root.setAttribute('data-theme', isLight ? 'light' : 'dark');

    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      themeToggle.setAttribute('aria-label', isLight ? '切换到深色主题' : '切换到浅色主题');
    }

    // 两个 media 变体同写，确保地址栏配色始终跟随用户选择
    $$('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute('content', isLight ? '#ffffff' : '#05080f');
    });

    if (persist) store(THEME_KEY, isLight ? 'light' : 'dark');
  }

  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
    });
  }

  // 用户未显式选择时，跟随系统切换
  var systemPref = mq('(prefers-color-scheme: light)');
  if (systemPref) {
    var onSystemChange = function (e) {
      if (!recall(THEME_KEY)) applyTheme(e.matches ? 'light' : 'dark', false);
    };
    if (systemPref.addEventListener) systemPref.addEventListener('change', onSystemChange);
    else if (systemPref.addListener) systemPref.addListener(onSystemChange);
  }

  /* ---------------------------------------------------
     2. 导航：滚动状态 / 阅读进度 / 回到顶部
     --------------------------------------------------- */
  var nav = $('#nav');
  var progress = $('#navProgress');
  var toTop = $('#toTop');

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (nav) nav.classList.toggle('is-scrolled', y > 20);

    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(y / max, 1) : 0;
      progress.style.width = (ratio * 100).toFixed(2) + '%';
    }

    if (toTop) toTop.classList.toggle('is-show', y > 620);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      if (reduceMotion) window.scrollTo(0, 0);
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------------------------------------------
     3. 移动端菜单（is-open 必须加在 .nav 上，见 CSS）
     --------------------------------------------------- */
  var navToggle = $('#navToggle');
  var navLinks = $('#navLinks');
  var MENU_BREAKPOINT = 900;

  function setMenu(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setMenu(!(nav && nav.classList.contains('is-open')));
    });
  }

  if (navLinks) {
    $$('a', navLinks).forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') setMenu(false);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > MENU_BREAKPOINT) setMenu(false);
  });

  /* ---------------------------------------------------
     4. 滚动入场动画
     元素默认可见，仅当 JS 可用时才隐藏（.js 由 <head> 添加）
     --------------------------------------------------- */
  var revealEls = $$('.reveal');

  function showAll() {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  try {
    if ('IntersectionObserver' in window && revealEls.length && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

      revealEls.forEach(function (el) { io.observe(el); });

      // 兜底：3 秒后仍未揭示的内容直接显示，绝不留下空白页
      window.setTimeout(function () {
        revealEls.forEach(function (el) {
          var box = el.getBoundingClientRect();
          if (box.top < window.innerHeight && box.bottom > 0) el.classList.add('is-visible');
        });
      }, 3000);
    } else {
      showAll();
    }
  } catch (err) {
    showAll();
  }

  /* ---------------------------------------------------
     5. 数字滚动
     --------------------------------------------------- */
  $$('[data-count]').forEach(function (el) {
    var raw = el.getAttribute('data-count') || '';
    var target = parseFloat(raw);
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (raw.split('.')[1] || '').length;

    function settle() { el.textContent = target.toFixed(decimals) + suffix; }

    if (!isFinite(target) || reduceMotion || !('IntersectionObserver' in window)) {
      if (isFinite(target)) settle();
      return;
    }

    var numIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        numIO.unobserve(entry.target);

        var startTime = null;
        var DURATION = 1300;

        var tick = function (now) {
          if (startTime === null) startTime = now;
          var p = Math.min((now - startTime) / DURATION, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (target * eased).toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(tick);
          else settle();
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });

    numIO.observe(el);
  });

  /* ---------------------------------------------------
     6. 鼠标跟随高光
     --------------------------------------------------- */
  if (mq('(hover: hover)') && mq('(hover: hover)').matches) {
    $$('[data-spotlight]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
        el.style.setProperty('--my', (e.clientY - rect.top) + 'px');
      });
    });
  }

  /* ---------------------------------------------------
     7. 导航高亮当前区块
     --------------------------------------------------- */
  var sections = $$('main section[id]');
  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = '#' + entry.target.id;
        $$('.nav__links a').forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ---------------------------------------------------
     8. 页脚年份
     --------------------------------------------------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
