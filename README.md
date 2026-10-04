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

### 切换到自有域名 cdzw.ai

1. 在 `gh-pages` 分支根目录新增 `CNAME` 文件，内容为 `cdzw.ai`；
2. 仓库 Settings → Pages → Custom domain 填入 `cdzw.ai`，并勾选 Enforce HTTPS；
3. 把 `404.html` 里的 `<base href="/cdzw-home/">` 改成 `<base href="/">`；
4. 把 `index.html` 里的 `canonical` 与 `og:url` 改回 `https://cdzw.ai/`。

> ⚠️ `404.html` 里的 `<base>` 是项目页的关键：GitHub Pages 会在**任意深度**的错误
> URL 上返回 `404.html`，若用相对路径，`style.css` 会解析到错误目录，404 页会掉样式。

