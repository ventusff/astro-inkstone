<h1 align="center">astro-inkstone</h1>

<p align="center"><b>可以直接在页面上编辑的 Astro wiki，所见即所得。</b><br>
纸墨质感的排版，文档站、wiki、数字花园都适用；配合编辑引擎，点一下 ✎ 就能原地编辑，预览效果和最终页面一致。内容始终是 Markdown 文件，修改历史始终记录在 git 里。</p>

<p align="center">
  <a href="https://github.com/ventusff/astro-inkstone/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ventusff/astro-inkstone/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2b2622"></a>
  <img alt="Astro 7" src="https://img.shields.io/badge/Astro-7-b6552e?logo=astro&logoColor=white">
  <a href="https://ventusff.github.io/astro-inkstone/zh/kitchen-sink/"><img alt="在浏览器里试试编辑" src="https://img.shields.io/badge/%E2%9C%8E%20%E8%AF%95%E4%B8%80%E8%AF%95-%E5%9C%A8%E6%B5%8F%E8%A7%88%E5%99%A8%E9%87%8C%E7%BC%96%E8%BE%91-2b6e5f"></a>
</p>

<p align="center">
  <a href="https://ventusff.github.io/astro-inkstone/zh/kitchen-sink/"><b>✎ 在浏览器里试试编辑&nbsp;→</b></a>
  &nbsp;·&nbsp;
  <a href="https://ventusff.github.io/astro-inkstone/zh/">示范站 · 使用手册</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/ventusff/astro-inkbrush">编辑引擎</a>
  &nbsp;·&nbsp;
  <a href="README.md">English</a>
</p>

<p align="center">
  <img alt="把鼠标移到段落上、点 ✎、在正文里输入一个行内公式——预览边输入边渲染；保存后页面原地更新；最后切到同一页的深色主题" src=".github/assets/hero-edit.gif" width="1040">
</p>

把鼠标移到任意内容块上，点 **✎**，就可以直接编辑 Markdown。编辑器的预览和页面用同一套渲染管线——公式、表格、提示块、Mermaid 图、`[[双链]]` 都正常渲染——所以预览效果就是页面的最终效果。保存后当前页面自动更新；开启 `autocommit`，每次保存都会生成一次 git 提交。不需要数据库和后台管理系统，也不用另外装写作软件：Markdown 内容文件就是唯一的数据源。

**Inkstone（砚）** 负责页面呈现，提供设计 token、正文样式、组件，以及只需一行配置就能接入的 Markdown 管线。[**Inkbrush（笔）**](https://github.com/ventusff/astro-inkbrush) 负责编辑。两者配合，就是一个能在页面上直接编辑的 wiki；只用 Inkstone，就是一个美观、耐读的静态站。

## 你会喜欢的点

- ✎ **原地编辑，所见即所得。** 页面上的每个内容块都可以直接改：段落、标题、表格、代码、公式，frontmatter 也可以直接以 YAML 形式编辑。实时预览用的是站点自己的 Markdown 插件；输入 `[[` 会自动补全笔记名。保存前会对全文做一遍构建检查，并用并发锁避免冲突；只有检查通过并拿到锁，才会写入文件并创建提交。
- 🧪 **所见即所得的编辑——现在就来试一试。** [线上示范站](https://ventusff.github.io/astro-inkstone/zh/kitchen-sink/)右上角有「✎ 试一试编辑」入口：用的是同一套编辑器，所有改动只保存在你的浏览器里，不用安装任何东西。
- ✦ **AI 辅助修改，全程在沙箱里运行。** 把鼠标移到内容块上点 ✦，让 Claude 润色、压缩、修公式，或者直接说明你想怎么改。Claude 通过 `claude` 命令行处理这篇笔记的临时副本：它只能对这个副本使用文件操作工具，不能用 shell，也不能联网；每一步操作都实时显示在弹窗里；修改结果只有通过与手动保存相同的构建检查，才会写回原文件。另外还有一个对话面板，可以针对当前笔记提问，也可以一键把整篇翻译成另一种语言。
- ⟲ **每次保存都有记录，可以一键撤回。** 每个内容块都有自己的修订历史，记录修改者、时间、变更的行和修改前后的 diff；每条记录都可以一键回滚。导入、翻译这类全文操作也会留下记录，需要撤销时用 git 回退。
- 📥 **Obsidian 收件箱。** 把 vault 里的某个文件夹设为收件箱，新笔记会自动转换并导入：附件复制到笔记所在目录，`[[双链]]` 用和页面相同的解析器处理，高亮也保留。
- 🔐 **适合团队使用的登录和权限控制。** 本地开发一键登录；部署到正式域名后，接 Google OAuth 或 Google Workspace SAML。访问控制采用白名单，默认拒绝未授权用户；还可以启用成员管理，只有成员能编辑、只有管理员能管理成员。每篇笔记下都能评论；还可以为单篇笔记生成带密码的静态快照，分享给别人。
- 📜 **适合长时间阅读的排版。** 正文阅读区用偏冷的纸色，只用一种强调色；首页和分类页用暖纸色的书架布局。正文用衬线字体，代码块经过细致调整，表格在窄屏下会自动变成卡片。浅色是默认主题，深色主题也完整可用；所有文字都按实际渲染结果做过像素采样和对比度检测，达到 WCAG AA。
- 🧰 **其他功能。** 数字花园支持按形式、方向、标签和状态分类，并提供带编号章节的 hub 笔记、反链面板、侧栏链接关系图、⌘K 搜索和多语言镜像——示范站的整本手册有 18 种语言版本，由一个注册表驱动的语言菜单统一切换（新增一种语言只需一行注册表、一份界面文案文件和一个内容目录）；CMS 引擎自己的手册也长在这座园地里，即 `inkbrush` 标签下的 `/inkbrush/` 合集。中文排版方面，中文标点旁的加粗正常生效，汉字字形按页面语言选用对应字体，代码里的汉字正好占两格宽。内容校验会拒绝保存有问题的内容，并让构建失败；CI 里还有两项基于无头 Chrome 的检查，用来发现横向溢出、失效锚点和对比度不达标。Inkstone 不需要单独构建，生产环境也不包含 CMS 代码：TypeScript 和 CSS 源码通过 git submodule 直接使用，CMS 只在 `astro dev` 期间启用，读者访问的是纯静态站。

## 看一眼

**✦ 让 Claude 压缩一段。** 选「压缩」这个操作，交给 Claude 处理：它调用工具的每一步都显示在弹窗里，修改只发生在沙箱副本里；处理完成后这一段明显变短，而且已经通过了检查。

<p align="center"><img alt="✦ 弹窗：选了「压缩」，Claude 调用工具的记录实时出现，任务结束后这一段明显变短" src=".github/assets/tour-ai.gif" width="1040"></p>

**输入 `[[双链]]` 时自动补全，保存后反链自动生成。** 新链接立即出现在预览里；保存后，目标笔记的「链接提及」面板多了一条带摘录的记录，侧栏的链接关系图也多了一条边。

<p align="center"><img alt="输入 [[ 弹出笔记候选；链接在预览里渲染；保存后目标笔记的链接提及面板列出这条新提及" src=".github/assets/tour-wikilink.gif" width="1040"></p>

**frontmatter 也是一个可编辑的内容块。** 点页面顶部的元数据栏，就能编辑这篇笔记的 YAML：改状态、标签或日期，页头随之重新渲染。

<p align="center"><img alt="悬停元数据栏打开 frontmatter（YAML）；改状态后保存，元数据栏重新渲染" src=".github/assets/tour-frontmatter.gif" width="1040"></p>

**有问题的内容保存不进去。** 比如 `**` 没有成对出现，就会原样显示成两个星号；这时保存会被拒绝，界面标出具体位置并给出修改建议。同一项检查也在 CI 里运行，发现问题就让构建失败。

<p align="center"><img alt="内容校验拒绝保存：一个没配对的 ** 被指出文件、行、列，并画出插入符" src=".github/assets/guard.png" width="720"></p>

**⟲ 查看当前内容块的修订历史。** 每次修改的作者和保存时间都记录在案；展开就能看 diff，也可以一键回滚。

<p align="center"><img alt="⟲ 块修订史弹窗：列出每次手动修改的作者和时间，可展开改动、一键回滚" src=".github/assets/history.png" width="760"></p>

**纸墨风格。** 左边是暖纸色的首页书架和分类导航，右边是深色主题下的笔记页面；两者用同一套 token，都通过了对比度检测。

<p align="center">
  <img alt="示范站的首页书架（浅色）与笔记页面（深色）" src=".github/assets/demo-preview.png" width="920">
</p>

## 快速开始

示范站本身就是使用手册：它用这个包搭建，是一个可以原地编辑的笔记站点：

```bash
git clone --recurse-submodules https://github.com/ventusff/astro-inkstone
cd astro-inkstone && npm install
cd demo && npm install
npm run wiki      # WIKI=1 astro dev → 登录（开发登录），把鼠标移到段落上，点 ✎
npm run build     # 读者拿到的静态站——不含任何 CMS 代码，postbuild 会检查这一点
```

## 接入你的站点

Inkstone 和编辑引擎都通过 git submodule 引入，直接 import 源码：版本可以精确锁定到 commit，源码在编辑器里直接可读，更新也不用等发布：

```bash
git submodule add https://github.com/ventusff/astro-inkstone.git packages/astro-inkstone
git submodule add https://github.com/ventusff/astro-inkbrush.git packages/astro-inkbrush
```

```ts
// astro.config.ts —— 全站 Markdown 管线，一行接入
import { defineConfig } from 'astro/config';
import { siteMarkdown } from 'astro-inkstone/markdown-preset';

export default defineConfig({
  markdown: siteMarkdown({ math: true, callouts: true, mermaid: true, codeFrame: true }),
});
```

```css
/* 站点全局样式：先 token，再阅读区，有导览页的站再加书架 */
@import 'astro-inkstone/styles/tokens.css';
@import 'astro-inkstone/styles/base.css';
@import 'astro-inkstone/styles/browse.css';

/* 换成自己的颜色：覆盖基础色（白天一个、夜间一个），或者把语义 token 映射到你自己的色板 */
:root { --p-shi: #8a4baf; --p-shi-n: #b98fd6; }
```

在 `package.json` 里声明这两个包（pnpm 用 `workspace:*`，npm 用 `file:`），把 Markdown 渲染出的 HTML 放进 `<main class="note-main"><div class="col">…</div></main>` 里，阅读区样式就生效了。要启用编辑模式，还需在 Astro 配置里加三项设置，全部由 `WIKI=1` 开关控制。布局、导航、路由、部署仍由站点自己决定；示范站提供了一套完整的参考实现。

→ **[快速上手](https://ventusff.github.io/astro-inkstone/zh/getting-started/)**（安装、样式、管线开关、启动编辑器）· [两层色板与主题](https://ventusff.github.io/astro-inkstone/design-tokens/) · [全要素演示](https://ventusff.github.io/astro-inkstone/zh/kitchen-sink/)（Markdown 管线支持的每个功能都在这一页上）· [组件集](https://ventusff.github.io/astro-inkstone/components/) · [检查工具](https://ventusff.github.io/astro-inkstone/checks/) · [引擎手册](https://github.com/ventusff/astro-inkbrush/blob/main/docs/manual.zh-CN.md)（登录、AI 辅助、收件箱、分享和部署方式）

## 三者分工

```
astro-inkbrush   笔——编辑：原地块编辑 CMS、修订历史、评论、AI 辅助、
                 Obsidian 收件箱、Markdown 方言与内容校验
astro-inkstone   砚——呈现：token、正文样式、组件、管线预设、字体、渲染检查
你的站点         手——定制：品牌色板、布局、路由、内容、部署
```

只需遵守一条规则：编辑器和页面渲染必须使用同一种 Markdown 方言。这套方言只在引擎里定义一次，Markdown 预设直接复用这份定义，所以不会出现「编辑器保存正常、页面渲染错误」的情况。

<details>
<summary><b>完整功能清单</b></summary>

- **两层设计 token，两类使用场景**——第一层是纸色和颜料色组成的基础色板（`--p-*`：朱、石、赭、黛、紫），第二层把这些基础色映射为两套语义色，分别用于**阅读区**（`--color-*`）和**导览书架**（`--wb-*`）；覆盖任意一层的 token，就能给整个站点换肤。
- **简单的主题机制**——浅色是默认主题；深色只通过 `[data-theme='dark']` 激活，要不要提供切换由站点自己决定。
- **`base.css`**——提供衬线正文、章节分隔线、代码块（标题栏 / 复制 / 折叠 / 行标注 / diff·focus·词高亮）、提示块（含折叠）、图组、学术论文卡、hub 卡片与阅读路径、文献列表、减少动效模式，以及输出简洁 PDF 的打印样式；表格用纯 CSS 容器查询，在窄容器里自动变成卡片。**`browse.css`**——提供页面标题区、带分隔线的书架、卡片栅格、状态图例、即时筛选和标签云。
- **25 个 Astro 组件**——`Hero`、`Part`、`PartHero`、`Callout`、`Steps`、`Grid`、`PaperCard`、`HubCard`、`Stats`、`LocalToc`、`Backlinks`、`SearchPalette`（⌘K 搜索浮层）、`LocalGraph`、wiki 导览组件（`NoteCard`、`FacetNav`、`TaxonomyLine`……）等。这些组件只负责展示，样式由 token 驱动。
- **数字花园机制**——taxonomy 工厂支持按形式 / 方向 / 标签 / 状态分类，并提供带编号章节的 hub 笔记和不限语种数量的多语言镜像；反链索引构建器生成带上下文摘录的反链。站点只需三行代码就能接入自己的分类词表。
- **`siteMarkdown()`**——支持 GFM，能正确解析中日韩文本里的强调语法；还支持 KaTeX（双主题）、Mermaid、Obsidian 风格提示块、`[[双链]]`、阅读时长统计、标题自动编号与目录提取、子路径链接改写，以及构建期内容校验。
- **中文优先的排版**——中文标点旁的强调语法正常生效，能统计中西混排内容的阅读时长；细致调整过的 Maple Mono CN 子集让汉字正好占两格宽。标题用的衬线字体和界面用的无衬线字体由示范站通过 `@fontsource` 自托管。
- **搜索**——提供一个在构建期生成搜索索引的 endpoint 工厂，以及一个零依赖的轻量客户端。
- **渲染层检查**——`ui_probe` 在四种页面宽度下检查横向溢出、没有对应样式的类名、失效锚点、缺少 alt、标题跳级、重复 id 和没有对应目标的 aria-controls；`contrast_probe` 在浅色和深色主题下逐段检查渲染后的文字，按像素采样检测对比度。库本身另有单元测试。
- **无需单独构建**——直接提供 TypeScript 和 CSS 源码，由站点自己的 Vite 处理，和站点其他代码一起锁定到指定 commit。
- **编辑引擎提供的功能**——支持带实时预览和 `[[` 补全的内容块编辑，也支持以 YAML 形式编辑 frontmatter；还提供内容块修订历史与回滚、在隔离工作区里运行的 AI 辅助（改写 / 提问 / 翻译）、评论、Obsidian 收件箱、共享的双链解析器、开发环境登录 / Google OAuth 登录 / SAML 登录、成员管理、带密码的快照分享，以及三个检查 CLI（`check-content`、`check-wikilinks`、`check-dist`）。CMS 只在 `astro dev` 期间启用；构建产物里只要混进任何 CMS 代码，`check-dist` 就让构建失败。另外示范站还有纯浏览器的体验模式，数据只保存在浏览器本地。

</details>

## 横向对比

- **[Starlight](https://starlight.astro.build/)** 是 Astro 官方的文档框架:侧栏、
  搜索、多语言开箱即用,内容在编辑器里写。Inkstone 是一层设计层,带维基的
  形制——分类面、`[[双链]]`、反向链接、局部链接图——配上 Inkbrush 就能在页面上
  直接改。做产品文档站选 Starlight;想要一座能一直写下去的维基或数字花园,
  或者只想把这套排版和管线用在任意 Astro 站上,选 Inkstone。
- **[Quartz](https://quartz.jzhao.xyz/) 与 Obsidian Publish** 把 Obsidian 仓库
  原样发布。Inkbrush 的收件箱也能导入 vault 目录,但站点仍是普通的 Astro 项目——
  管线、组件、路由都是你自己的——而且改动发生在已发布的页面上,不必回到 Obsidian。
- **基于 git 的 CMS**(Decap、Tina、Pages CMS)在 Markdown 前面架一个后台。
  Inkbrush 没有后台:页面本身就是编辑器,预览跑的是站点自己的 remark / rehype
  插件,生产构建里零 CMS 字节——每次构建 `check-dist` 都会证实这一点。
- **维基引擎**(MediaWiki、Wiki.js、Outline)需要数据库和常驻服务。这里 Markdown
  文件就是数据库,git 就是历史,读者拿到的是静态站。

## 常见问题

**为什么不发 npm？**——设计层会和使用它的站点同步演进。submodule 能精确锁定到 commit，源码可以直接看，本地改起来也方便；按 tag 引入同样可行。

**可以不引入编辑引擎，只用 Inkstone 吗？**——可以，只引入 token、样式和组件就行。Markdown 管线预设依赖引擎定义的 Markdown 方言，所以要用 `siteMarkdown()` 就得一并引入引擎的 submodule；构建产物不含任何编辑代码，CMS 只在 dev 模式下启用。

**怎么升级？**——运行 `git submodule update --remote packages/astro-inkstone`，检查 diff 后提交更新后的 submodule 指针。站点始终锁定在已经验证过的版本上。

## 许可

[MIT](LICENSE) © Jianfei Guo。代码字体为 [Maple Mono](https://github.com/subframe7536/maple-font) 的子集，采用 [SIL OFL 1.1](fonts/OFL.txt) 许可——详见 [`fonts/README.md`](fonts/README.md)。

<p align="center"><sub>如果 Inkstone 让你的笔记更好读、更好写，点个 ⭐ 能让更多人找到它。</sub></p>
