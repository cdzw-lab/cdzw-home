#!/bin/bash
# 双击这个文件即可本地预览博客（macOS）。
# 原因：文章是页面用 fetch() 读取 .md 之后渲染的，浏览器会拦截 file:// 下的 fetch，
# 所以直接双击 blog.html 只会看到「文章列表载入失败」。必须走 HTTP。

cd "$(dirname "$0")/.." || exit 1

PORT="$1"
if [ -z "$PORT" ]; then PORT=8080; fi

# Finder 启动的脚本只有极简 PATH，node 往往不在里面，需要自己找
find_node() {
  if command -v node >/dev/null 2>&1; then command -v node; return 0; fi
  local c
  for c in "$HOME/Library/Application Support/fnm/aliases/default/bin/node" \
           "$HOME/.local/share/fnm/aliases/default/bin/node" \
           /opt/homebrew/bin/node \
           /usr/local/bin/node; do
    if [ -x "$c" ]; then echo "$c"; return 0; fi
  done
  c=$(ls -1 "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | tail -1)
  if [ -n "$c" ] && [ -x "$c" ]; then echo "$c"; return 0; fi
  return 1
}

NODE="$(find_node)"
if [ -z "$NODE" ]; then
  echo "找不到 node。请先安装 Node.js，然后在终端里手动运行："
  echo "    node tools/serve.mjs"
  echo
  read -n 1 -s -r -p "按任意键关闭…"
  exit 1
fi

echo "Node 版本 : $("$NODE" -v)"
echo "项目目录 : $(pwd)"
echo "预览地址 : http://127.0.0.1:$PORT/"
echo
echo "按 Ctrl+C 停止服务"
echo

# 稍等服务起来再打开浏览器
( sleep 1; open "http://127.0.0.1:$PORT/" >/dev/null 2>&1 ) &

exec "$NODE" tools/serve.mjs "$PORT"
