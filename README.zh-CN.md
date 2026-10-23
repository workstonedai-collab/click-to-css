# Click-to-CSS · 点选式网页样式编辑器

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/workstonedai-collab/click-to-css/actions/workflows/ci.yml/badge.svg)](https://github.com/workstonedai-collab/click-to-css/actions/workflows/ci.yml) · [MIT](LICENSE) · Node.js 22.18+

**在网页上点选元素、调整样式，把修改保存回真实 CSS 源文件。**

Click-to-CSS 是一个本地 Vite 插件，适合处理页面最后一轮精调：标题间距不舒服、卡片太挤、颜色需要改变。打开自己的静态页面，选择匹配的源文件规则，预览属性值，再保存到原有样式表。你可以查看修改前后内容、撤销，再通过习惯的 Git 流程提交。

它适合开发者、使用 HTML/CSS 的设计人员，以及希望微调 Agent 生成页面的人。无需账号、模型 API 或云端服务。

当前面向静态 HTML 和普通外部 CSS；React/Vue 组件映射、Tailwind 和 CSS-in-JS 暂未支持。

## 先看实际操作

![真实点选、保存与撤销，2 倍速预览](docs/demo.gif)

[观看完整约 30 秒视频](docs/demo.mp4) · [逐步操作教程](docs/walkthrough.zh-CN.md) · [English guide](docs/walkthrough.en.md)

录屏使用自带静态页面：点选标题、预览 46px、保存回真实 CSS、查看源码并撤销。无需账号或 API 密钥。

![本地编辑器与原创示例页面](docs/editor.png)

## 先试用示例

需要 **Node.js 22.18 或更新版本**。在下载后的项目目录运行：

```sh
git clone https://github.com/workstonedai-collab/click-to-css.git
cd click-to-css
npm ci
npm run dev
```

打开 Vite 打印的本地地址，并加上 `/__click_to_css`，通常为 `http://127.0.0.1:5173/__click_to_css`。

1. 点选预览中的大标题。
2. 选择 `h1` 规则，属性选择 `font-size`。
3. 输入 `46px`，点击「预览」。
4. 点击「保存 CSS」；真实的 `style.css` 会改变，侧栏显示修改前后内容。
5. 点击「撤销」恢复。之后用自己的 Git 工具查看和提交改动。

工具栏可以切换中英文。「操作页面」会暂时让点击进入原页面，方便打开标签、折叠区或弹窗，再切回元素选择。

## 阅读导航

- [哪些场景适合用](#哪些场景适合用)
- [先试用示例](#先试用示例)
- [已有能力](#已有能力)
- [接入自己的页面](#接入自己的页面)
- [接入已有目录，不搬动原页面](#接入已有目录不搬动原页面)
- [常见问题](#常见问题)
- [首版范围](#首版范围)
- [检查与开发](#检查与开发)
- [交给你的 Agent 部署](#交给你的-agent-部署)
- [贡献与许可](#贡献与许可)

## 哪些场景适合用

- **精调 Agent 生成的页面**：直接看着页面调整标题、卡片间距和配色。
- **维护小型静态网站**：点选元素后查找匹配规则，减少猜测哪个选择器生效。
- **与开发者一起复核设计修改**：保存为普通源码改动，在 Git 中审阅后进入现有构建流程。

操作顺序是 **点选 → 选择源规则 → 预览 → 保存 → 查看差异**。预览临时作用于当前元素；保存修改共享 CSS 规则，可能影响其他匹配元素。

## 已有能力

| 能力 | 实际行为 |
| --- | --- |
| 点选元素 | 列出配置中外部 CSS 文件匹配的规则 |
| 选择源规则 | 区分重复选择器，包括生效媒体查询中的规则 |
| 调整属性 | 字体、间距、颜色、尺寸、边框及部分布局属性 |
| 设计变量 | 修改已存在且符合配置前缀的 CSS 自定义属性 |
| 预览 | 只对当前元素应用临时样式，不写文件 |
| 保存 | 通过 PostCSS 修改指定源规则中的声明 |
| 撤销 | 仅在文件未被外部改动时恢复上一次内容 |
| 组件源码 | JSX/TSX 与 Vue 定位；字面量类名、静态内联样式、Vue scoped CSS 和静态 styled 模板 |
| 冲突保护 | 如果源文件比读取快照更新，拒绝覆盖 |

撤销历史属于当前开发服务会话，最多保留 100 次；长期历史由 Git 管理。保存共享选择器会影响多个元素，因此应确认选中的源规则。

## 接入自己的页面

在 Vite 配置中加入插件，指定允许编辑的文件：

```js
import { defineConfig } from 'vite';
import { clickToCss } from './src/index.js';

export default defineConfig({
  plugins: [clickToCss({
    pages: [{
      file: 'index.html',
      label: '首页',
      styles: ['styles/page.css', 'styles/tokens.css'],
    }],
    tokenFile: 'styles/tokens.css',
    tokenPrefix: '--theme-',
  })],
  server: { host: '127.0.0.1' },
});
```

路径相对 Vite 项目根目录。样式表应是同源、普通的 `<link rel="stylesheet">` 文件；建议将设计变量放入专用文件。变量修改可能影响全站，应在提交前查看差异。

## 接入已有目录，不搬动原页面

可以把工具与自己的静态站点放在相邻目录：

```text
workspace/
  click-to-css/       # 本工具及其依赖
  my-page/
    index.html
    styles/page.css
    styles/tokens.css
```

修改工具目录中的 `vite.config.js`，将 Vite 的 `root` 指向自己的页面目录，插件仍从工具的 `src/index.js` 导入：

```js
import path from 'node:path';
import { defineConfig } from 'vite';
import { clickToCss } from './src/index.js';

export default defineConfig({
  root: path.resolve('../my-page'),
  plugins: [clickToCss({
    pages: [{ file: 'index.html', label: '我的页面',
      styles: ['styles/page.css', 'styles/tokens.css'] }],
    tokenFile: 'styles/tokens.css',
    tokenPrefix: '--theme-',
  })],
  server: { host: '127.0.0.1' },
});
```

在**工具目录**中运行 `npm run dev`。自己的 HTML 应通过 link 引入这些样式表。配置中的 HTML/CSS 路径都相对 `my-page`，即 Vite 根目录。加入多个页面后可通过页面选择器切换；不用变量编辑时省略 `tokenFile`。前缀限制哪些已存在的变量出现在编辑器里。

保存后查看自己站点的修改，例如运行 `git -C ../my-page diff`。工具不会自动创建提交或触发部署。

## 常见问题

| 现象 | 怎样处理 |
| --- | --- |
| 编辑器地址返回 404 | 确认用开发模式启用了插件，打开实际端口加 `/__click_to_css`；普通静态生产站点不提供编辑器 |
| 点选后没有源规则 | 使用普通外部 CSS，在当前页面的 `styles` 中登记文件，并确认选择器匹配 |
| 属性值为空 | 当前规则可能没声明该属性；换一个源规则，或添加支持的属性 |
| 保存提示冲突 | 文件被其他编辑器改过；重新加载，查看最新源码后再操作 |
| 无法撤销 | 当前文件已经不同于上次保存结果；保留新修改，使用 Git 或人工查看差异 |
| 属性值被拒绝 | 使用受支持的普通值；网址导入、声明分隔符和可执行表达式不属于编辑范围 |
| 找不到某个变量 | 检查 `tokenFile`、变量名称和 `tokenPrefix`；首版不新建变量 |

## 首版范围

- 继续支持静态 HTML 和外部 CSS；新增 [React/Vue 组件定位与编辑](docs/components.md)，可写回字面量 Tailwind 类名、静态 React 内联样式、Vue scoped CSS 和静态 styled-components/Emotion 模板。动态表达式和远程样式表暂不编辑。
- CSS import、虚拟样式和复杂嵌套可能无法直接映射到源规则。保持可编辑文件简单，并核对选中规则。
- 写入接口只在 Vite 开发模式开启，限制本机回环访问及同源写入；拒绝通过符号链接逃出项目的文件。
- 用于可信本地项目。其他本机进程仍可修改同一文件，不宜作为在线多人编辑服务。
- 保存后由你决定是否提交、推送和部署。生产构建只包含示例页面，不包含开发编辑器。

## 检查与开发

```sh
npm test
npm run build
```

测试覆盖重复规则、变量边界、属性值校验、真实 HTTP 保存、外部修改冲突与撤销。CI 配置覆盖 Node 22/24 及 Linux、macOS、Windows。截图来自真实本地浏览器验收。

文件分工：`src/index.js` 为插件与写入逻辑，`src/ui/` 为编辑界面，`vite.config.js` 为示例配置，`test/` 为测试。

## 交给你的 Agent 部署

请它识别静态页面的 HTML 与外部 CSS，填写插件配置、启动本地编辑器，并在调整后帮助查看源码差异。文件与 Git 操作由你掌握。

## 贡献与许可

欢迎提交小型可复现示例，见 [CONTRIBUTING.md](CONTRIBUTING.md)。项目代码使用 [MIT](LICENSE)。第三方依赖及数据保留自身条款。

[React/Vue、Tailwind、CSS-in-JS 示例与边界](docs/components.md)：`npm run dev:frameworks`。
