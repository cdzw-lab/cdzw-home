/*!
 * Markdown Lite — 无依赖的轻量 Markdown 渲染器
 *
 * 设计原则：先把原文 HTML 转义，再生成标签。
 * 因此原文里写的 <script> 只会以文本形式出现，不会被解析执行 —— 天然免疫 XSS。
 *
 * 支持：标题 / 段落 / 粗体 / 斜体 / 删除线 / 行内代码 / 围栏代码块 /
 *       有序与无序列表（含嵌套）/ 引用 / 分隔线 / 表格 / 链接 / 图片
 * 不支持（有意为之）：内嵌 HTML、脚注、数学公式
 */
(function (global) {
  'use strict';

  var SENTINEL = '\u0001';

  /* ---------- 基础工具 ---------- */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 只放行安全协议，挡住 javascript: / data: 等
  function safeUrl(url) {
    var raw = String(url).trim();
    var probe = raw.replace(/[\u0000-\u0020]/g, '').toLowerCase();
    if (/^(javascript|vbscript|data|file|blob):/.test(probe)) return '#';
    return raw.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
  }

  /* ---------- 行内语法（输入必须是已转义的文本） ---------- */

  function renderInline(escaped) {
    var codes = [];

    // 1. 行内代码最先抽出，避免内部内容被后续规则改写
    var out = escaped.replace(/`([^`]+)`/g, function (m, code) {
      codes.push(code);
      return SENTINEL + 'C' + (codes.length - 1) + SENTINEL;
    });

    // 2. 图片（必须在链接之前）
    out = out.replace(/!\[([^\]]*)\]\(\s*([^\s)]+)\s*\)/g, function (m, alt, url) {
      return '<img src="' + safeUrl(url) + '" alt="' + alt + '" loading="lazy">';
    });

    // 3. 链接
    out = out.replace(/\[([^\]]+)\]\(\s*([^\s)]+)\s*\)/g, function (m, text, url) {
      var href = safeUrl(url);
      var ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return '<a href="' + href + '"' + ext + '>' + text + '</a>';
    });

    // 4. 自动链接（原文 <https://...> 已被转义成 &lt;...&gt;）
    out = out.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, function (m, url) {
      return '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });

    // 5. 粗体 / 斜体 / 删除线
    // 粗体内部允许再出现成对的单星号，例如 **粗体里的 *斜体***。
    // 内部必须递归跑一次斜体规则，否则收尾的 ** 会残留成字面量。
    function em(text) {
      // 收尾的 * 前、起始的 * 后都不能是空白，
      // 否则 "2 * 3 * 4" 会被误判成斜体。
      return text.replace(/(^|[^*])\*([^\s*](?:[^*\n]*[^\s*])?)\*/g, '$1<em>$2</em>');
    }
    out = out.replace(/\*\*((?:[^*]|\*[^*]+\*)+)\*\*/g, function (m, inner) {
      return '<strong>' + em(inner) + '</strong>';
    });
    out = out.replace(/__((?:[^_]|_[^_]+_)+)__/g, function (m, inner) {
      return '<strong>' + inner.replace(/(^|[^_\w])_([^\s_](?:[^_\n]*[^\s_])?)_/g, '$1<em>$2</em>') + '</strong>';
    });
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    out = em(out);
    out = out.replace(/(^|[^_\w])_([^\s_](?:[^_\n]*[^\s_])?)_/g, '$1<em>$2</em>');

    // 6. 还原行内代码
    out = out.replace(new RegExp(SENTINEL + 'C(\\d+)' + SENTINEL, 'g'), function (m, i) {
      return '<code>' + codes[+i] + '</code>';
    });

    return out;
  }

  /* ---------- 块级语法 ---------- */

  function isBlockStart(line) {
    return /^\s{0,3}#{1,6}\s+/.test(line) ||
           /^\s*(```|~~~)/.test(line) ||
           /^\s{0,3}>/.test(line) ||
           /^\s*([-*+]|\d+[.)])\s+/.test(line) ||
           /^\s*([-*_])(\s*\1){2,}\s*$/.test(line) ||
           /^\s*:::/.test(line) ||
           /^\s*\|.*\|\s*$/.test(line);
  }

  function splitRow(row) {
    var s = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    return s.split('|').map(function (c) { return c.trim(); });
  }

  // 递归下降解析列表，用缩进判断嵌套层级
  function parseList(lines, i, baseIndent) {
    var head = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+/);
    var ordered = /\d/.test(head[2]);
    var out = ordered ? '<ol>' : '<ul>';

    while (i < lines.length) {
      var m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (!m) break;

      var indent = m[1].replace(/\t/g, '    ').length;
      if (indent !== baseIndent) break;
      if (/\d/.test(m[2]) !== ordered) break;

      var body = m[3];
      i++;

      // 该列表项的续行（缩进 2 空格以上、且不是新的列表项）
      while (i < lines.length && lines[i].trim() &&
             !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && /^\s{2,}/.test(lines[i])) {
        body += '\n' + lines[i].trim();
        i++;
      }

      // 子列表
      var child = '';
      if (i < lines.length) {
        var nm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+/);
        if (nm) {
          var nIndent = nm[1].replace(/\t/g, '    ').length;
          if (nIndent > indent) {
            var sub = parseList(lines, i, nIndent);
            child = sub.html;
            i = sub.next;
          }
        }
      }

      out += '<li>' + renderInline(escapeHtml(body)).replace(/\n/g, '<br>') + child + '</li>';
    }

    return { html: out + (ordered ? '</ol>' : '</ul>'), next: i };
  }

  function render(src) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) { i++; continue; }

      // 围栏代码块
      var fence = line.match(/^\s*(```|~~~)\s*([\w+#.-]*)\s*$/);
      if (fence) {
        var marker = fence[1];
        var lang = fence[2];
        var buf = [];
        i++;
        var closeRe = new RegExp('^\\s*' + marker + '\\s*$');
        while (i < lines.length && !closeRe.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre class="md-pre"' + (lang ? ' data-lang="' + escapeHtml(lang) + '"' : '') +
                 '><code>' + escapeHtml(buf.join('\n')) + '</code></pre>');
        continue;
      }

      // ::: 提示框容器（:::info / :::tip / :::warning / :::danger / :::note）
      var box = line.match(/^\s*:::\s*([A-Za-z]+)?\s*(.*)$/);
      if (box) {
        var kind = (box[1] || 'note').toLowerCase();
        if (['info', 'tip', 'warning', 'danger', 'note'].indexOf(kind) < 0) kind = 'note';
        var boxTitle = box[2] || '';
        var boxBuf = [];
        i++;
        while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) { boxBuf.push(lines[i]); i++; }
        i++;
        out.push('<div class="md-box md-box--' + kind + '">' +
                 (boxTitle ? '<p class="md-box__title">' + renderInline(escapeHtml(boxTitle)) + '</p>' : '') +
                 render(boxBuf.join('\n')) + '</div>');
        continue;
      }

      // 分隔线
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      // 标题
      var h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        var lvl = h[1].length;
        out.push('<h' + lvl + '>' + renderInline(escapeHtml(h[2])) + '</h' + lvl + '>');
        i++; continue;
      }

      // 引用（连续 > 行）
      if (/^\s{0,3}>/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(q.join('\n')) + '</blockquote>');
        continue;
      }

      // 表格：表头 + 分隔行
      if (/\|/.test(line) && i + 1 < lines.length &&
          /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var head = splitRow(line);
        i += 2;
        var t = '<div class="md-table-wrap"><table><thead><tr>';
        head.forEach(function (c) { t += '<th>' + renderInline(escapeHtml(c)) + '</th>'; });
        t += '</tr></thead><tbody>';
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
          t += '<tr>';
          splitRow(lines[i]).forEach(function (c) { t += '<td>' + renderInline(escapeHtml(c)) + '</td>'; });
          t += '</tr>';
          i++;
        }
        t += '</tbody></table></div>';
        out.push(t);
        continue;
      }

      // 列表
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        var indent = line.match(/^(\s*)/)[1].replace(/\t/g, '    ').length;
        var list = parseList(lines, i, indent);
        out.push(list.html);
        i = list.next;
        continue;
      }

      // 段落：连续非空且不是其它块起始
      var p = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { p.push(lines[i]); i++; }
      out.push('<p>' + renderInline(escapeHtml(p.join('\n'))).replace(/\n/g, '<br>') + '</p>');
    }

    return out.join('\n');
  }

  /* ---------- Front Matter ---------- */

  function splitFrontMatter(src) {
    var text = String(src).replace(/^\uFEFF/, '');
    var m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?/.exec(text);
    if (!m) return { meta: {}, body: text };

    var meta = {};
    m[1].split('\n').forEach(function (raw) {
      var kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(raw.trim());
      if (!kv) return;
      var v = kv[2].trim();
      if (v.length > 1 && ((v[0] === '"' && v.slice(-1) === '"') || (v[0] === "'" && v.slice(-1) === "'"))) {
        v = v.slice(1, -1);
      }
      meta[kv[1]] = v;
    });

    return { meta: meta, body: text.slice(m[0].length) };
  }

  global.MarkdownLite = {
    render: render,
    renderInline: renderInline,
    escapeHtml: escapeHtml,
    safeUrl: safeUrl,
    splitFrontMatter: splitFrontMatter
  };
})(typeof window !== 'undefined' ? window : globalThis);
