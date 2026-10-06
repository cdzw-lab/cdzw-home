#!/usr/bin/env node
/**
 * Markdown Lite 测试套件
 *   node tools/test-md.mjs
 * 兼容 Node 20 / 22 / 24 / 26（只用长期稳定的 API）
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');

// md.js 是给浏览器用的普通脚本：用 new Function 注入一个假的 window 来隔离载入
const sandbox = {};
new Function('window', readFileSync(join(repo, 'md.js'), 'utf8'))(sandbox);
const MD = sandbox.MarkdownLite;

if (!MD) {
  console.error('无法从 md.js 载入 MarkdownLite');
  process.exit(1);
}

/* ---------------- 语法用例 ---------------- */
const syntax = [
  ['标题 h1',            '# 一级标题',                          '<h1>一级标题</h1>'],
  ['标题 h3',            '### 三级',                            '<h3>三级</h3>'],
  ['粗体',               '这是 **粗体** 文字',                  '<strong>粗体</strong>'],
  ['粗体(下划线)',       '这是 __粗体__ 文字',                  '<strong>粗体</strong>'],
  ['斜体',               '这是 *斜体* 文字',                    '<em>斜体</em>'],
  ['删除线',             '这是 ~~删除~~ 文字',                  '<del>删除</del>'],
  ['行内代码',           '用 `npm run dev` 启动',             '<code>npm run dev</code>'],
  ['围栏代码块',         '```js\nconst a = 1;\n```',    '<pre class="md-pre" data-lang="js"><code>const a = 1;</code></pre>'],
  ['无序列表',           '- 甲\n- 乙',                         '<ul><li>甲</li><li>乙</li></ul>'],
  ['有序列表',           '1. 甲\n2. 乙',                       '<ol><li>甲</li><li>乙</li></ol>'],
  ['嵌套列表',           '- 甲\n  - 甲一\n- 乙',              '<li>甲<ul><li>甲一</li></ul></li>'],
  ['引用',               '> 引用内容',                          '<blockquote><p>引用内容</p></blockquote>'],
  ['分隔线',             '---',                                 '<hr>'],
  ['链接',               '[超导智网](https://cdzw.ai)',         'href="https://cdzw.ai"'],
  ['外链带 rel',         '[x](https://a.com)',                  'rel="noopener noreferrer"'],
  ['图片',               '![图](a.png)',                        '<img src="a.png" alt="图"'],
  ['表格',               '| A | B |\n|---|---|\n| 1 | 2 |',  '<th>A</th>'],
  ['自动链接',           '<https://cdzw.ai>',                   '<a href="https://cdzw.ai"'],
  ['段落',               '普通一段话',                          '<p>普通一段话</p>'],
  ['行内换行',           '第一行\n第二行',                     '第一行<br>第二行'],

  // 强调的边界情况。曾经出现过 ** 泄漏成字面量的缺陷，这里锁死防止回归。
  ['斜体',               '*斜体*',                              '<em>斜体</em>'],
  ['粗体含斜体',         '**粗体里的 *斜体***',                   '<strong>粗体里的 <em>斜体</em></strong>'],
  ['三星粗斜体',         '***粗斜体***',                          '<strong><em>粗斜体</em></strong>'],
  ['粗体中间嵌斜体',     '**a *b* c**',                           '<strong>a <em>b</em> c</strong>'],
  ['同行多个粗体',       '**a** 和 **b**',                        '<strong>a</strong> 和 <strong>b</strong>'],
  ['乘法不误判',         '2 * 3 * 4',                             '2 * 3 * 4'],
  ['下划线文件名不误判', 'file_name_with_underscores',            'file_name_with_underscores'],

  // ::: 提示框
  ['info 提示框',        ':::info 标题\n正文\n:::',                    '<div class="md-box md-box--info"><p class="md-box__title">标题</p>'],
  ['warning 提示框',     ':::warning\n小心\n:::',                       'md-box--warning'],
  ['未知类型回退 note',  ':::whatever\n内容\n:::',                      'md-box--note'],
  ['提示框内含 markdown',':::tip 提示\n**粗体**\n:::',                  '<strong>粗体</strong>']
];

/* ---------------- 安全用例（必须挡住） ---------------- */
const security = [
  ['原始 script 转义',   '<script>alert(1)</script>',  '&lt;script&gt;',  '<script>'],
  ['img onerror 转义',   '<img src=x onerror=alert(1)>', '&lt;img',        '<img src=x'],
  ['iframe 转义',        '<iframe src="evil"></iframe>', '&lt;iframe',     '<iframe'],
  ['javascript: 链接',   '[点我](javascript:alert(1))',  'href="#"',        'javascript:'],
  ['大小写绕过',         '[点我](JaVaScRiPt:alert(1))',  'href="#"',        'JaVaScRiPt'],
  ['插入空白绕过',       '[点我](java\tscript:alert(1))', null,             '<a href'],
  ['data: 协议',         '[点我](data:text/html,<script>1</script>)', 'href="#"', 'data:text'],
  ['代码块内 HTML 转义', '```\n<script>alert(1)</script>\n```', '&lt;script&gt;', '<script>'],
  ['属性逃逸',           '![x](a.png" onerror="alert(1))', null,       'onerror="alert(1)"']
];

let pass = 0;
const failures = [];

for (const [name, input, expected] of syntax) {
  const got = MD.render(input);
  if (got.includes(expected)) { pass++; }
  else failures.push({ group: '语法', name, expected, got });
}

for (const [name, input, mustHave, mustNot] of security) {
  const got = MD.render(input);
  const okHave = mustHave ? got.includes(mustHave) : true;
  const okNot = mustNot ? !got.includes(mustNot) : true;
  if (okHave && okNot) { pass++; }
  else failures.push({ group: '安全', name, expected: (mustHave ? '含 ' + mustHave + ' ' : '') + (mustNot ? '且不含 ' + mustNot : ''), got });
}

/* ---------------- Front Matter ---------------- */
const fm = MD.splitFrontMatter('---\ntitle: 标题\ndate: 2026-10-06\ntags: a, b\n---\n\n正文');
const fmOk = fm.meta.title === '标题' && fm.meta.date === '2026-10-06' && fm.body.trim() === '正文';
fmOk ? pass++ : failures.push({ group: 'Front Matter', name: '解析', expected: 'title=标题 date=2026-10-06 body=正文', got: JSON.stringify(fm) });

const noFm = MD.splitFrontMatter('没有 front matter');
(noFm.body === '没有 front matter' && Object.keys(noFm.meta).length === 0) ? pass++ : failures.push({ group: 'Front Matter', name: '无 front matter', expected: '原样返回', got: JSON.stringify(noFm) });

/* ---------------- safeUrl 直接单元测试 ---------------- */
const urlCases = [
  ['javascript:',    'javascript:alert(1)',      '#'],
  ['大小写混写',     'JaVaScRiPt:alert(1)',      '#'],
  ['制表符绕过',     'java\tscript:alert(1)',   '#'],
  ['换行绕过',       'java\nscript:alert(1)',   '#'],
  ['前导空格',       '  javascript:alert(1)',    '#'],
  ['data 协议',      'data:text/html,<script>',  '#'],
  ['vbscript',       'vbscript:msgbox(1)',       '#'],
  ['file 协议',      'file:///etc/passwd',       '#'],
  ['正常 https',     'https://cdzw.ai',          'https://cdzw.ai'],
  ['站内相对路径',   '/posts/a.md',              '/posts/a.md'],
  ['mailto',         'mailto:a@b.com',           'mailto:a@b.com'],
  ['锚点',           '#section',                 '#section']
];

for (const [name, input, expected] of urlCases) {
  const got = MD.safeUrl(input);
  if (got === expected) pass++;
  else failures.push({ group: 'safeUrl', name, expected, got });
}

/* ---------------- 不得残留字面标记 ---------------- */
const noLeak = [
  ['粗体星号不泄漏',   '**粗体里的 *斜体***',        '**'],
  ['删除线不泄漏',     '~~删除~~',                   '~~'],
  ['行内代码不泄漏',   '`code`',                   '`'],
  ['提示框记号不泄漏', ':::info 标题\n正文\n:::',  ':::']
];

for (const [name, input, marker] of noLeak) {
  const got = MD.render(input);
  if (!got.includes(marker)) pass++;
  else failures.push({ group: '残留', name, expected: '不含字面量 ' + marker, got });
}

/* ---------------- 报告 ---------------- */
const total = syntax.length + security.length + urlCases.length + noLeak.length + 2;
console.log('');
console.log('Markdown Lite 测试结果');
console.log('─'.repeat(60));
if (failures.length === 0) {
  console.log('  全部通过  ' + pass + '/' + total);
} else {
  console.log('  通过 ' + pass + '/' + total + '，失败 ' + failures.length + ' 项：');
  console.log('');
  for (const f of failures) {
    console.log('  ✗ [' + f.group + '] ' + f.name);
    console.log('      期望: ' + f.expected);
    console.log('      实际: ' + f.got.replace(/\n/g, '\\n').slice(0, 200));
  }
}
console.log('─'.repeat(60));
process.exit(failures.length === 0 ? 0 : 1);
