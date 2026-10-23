# Component styles / 组件样式

## 中文

这版增加 JSX/TSX 与 Vue 单文件组件的本地源码定位。它只处理 `sources` 明确列出的文件，在开发响应中给原生元素加定位标记；保存回源码的文件不会带这个标记。构建产物不包含编辑器和定位标记。

运行可操作示例：

```sh
npm ci
npm run dev:frameworks
```

打开开发服务地址加 `/__click_to_css`。示例同时有 React、Vue、Tailwind 和 styled-components，均为虚构内容，不需要账号。点选标题后，侧栏显示文件、行号和可选写回方式。

接入自己的 Vite 应用时，将插件放在 React/Vue 插件之前，列出组件文件；路径相对 Vite root：

```js
plugins: [
  clickToCss({
    pages: [{ file: 'index.html', label: 'App', styles: [] }],
    sources: ['src/App.tsx', 'src/Card.vue'],
  }),
  react(), // 或 vue()；沿用应用自己的框架插件
]
```

| 源码形式 | 怎样编辑 |
| --- | --- |
| React JSX/TSX 原生元素 | 定位到对应组件文件与行号；选择现有内联样式或类名目标 |
| Vue 原生模板元素 | 定位到 SFC；选择类名、字面量 style，或同文件普通 CSS/scoped CSS 的顶层规则 |
| Tailwind 字面量 className/class | 在值输入框修改**完整类名列表**，保留需要的响应式与状态前缀，例如 `text-[46px] md:text-[52px] font-bold`；保存后由项目自己的 Tailwind 重新生成样式 |
| React `style={{...}}` | 支持字符串、数字构成的静态对象；按 CSS 属性名修改，保存时映射为 camelCase。保留注释与未改属性 |
| styled-components / Emotion | 支持同文件默认导入 styled 工厂创建的静态标签模板，如 `styled.h2` 或 `styled('h2')`。按词法作用域匹配绑定，修改模板里的普通声明 |

保存、差异、旧快照冲突与撤销沿用同一个流程。撤销只在文件仍与上次保存结果一致时执行。一个源元素被循环或多处渲染时，保存会影响所有使用该源码的实例；Vue CSS 规则和 styled 模板也可能影响多个元素。

类名编辑需要自己保留完整列表；当前不会把一个 CSS 数值自动换算成 Tailwind utility，也不自动合并冲突 utility。类名在保存后触发重编译；临时「预览」仍只适用于 CSS 属性。

动态 class/:class、clsx/cva、属性展开、动态 style 对象、插值模板、CSS-in-JS 对象/主题函数、跨文件 styled 绑定、Vue CSS Modules、预处理器、复杂嵌套和媒体查询暂不编辑。Vue :deep/:slotted、组件包装与不透传属性的自定义组件也不在当前映射范围。遇到不支持的目标会保留源码；请用常规编辑器处理。模板里有转义或新增值含插值时也会拒绝保存。

使用 Babel 与 Vue 官方解析器，只解析源码，不在服务器执行应用模块。明确配置的源文件会通过本地 state API 提供给编辑器，因此不要配置私有数据文件，不要暴露开发端口。依赖仍保留各自许可。

## English

The component adapter maps native JSX/TSX and Vue template elements back to explicitly configured source files. Development transforms insert a source marker with a relative file and offset. The marker is never saved to project source and is absent from production builds.

Run `npm ci` and `npm run dev:frameworks`, then open the printed development URL plus `/__click_to_css`. Put `clickToCss` before your existing React/Vue plugin and list editable files in `sources`, relative to the Vite root. The example configuration above uses the application's own framework plugin.

Supported edits are literal React/Vue class lists, static React style objects, literal Vue style attributes, top-level ordinary/scoped Vue CSS rules, and flat static styled-components/Emotion templates created by a same-file default styled import. Scope-aware binding checks avoid rewriting a shadowed identifier. Shared source changes can affect multiple rendered instances.

For Tailwind, edit the **whole class list**, keeping required variants, then save. Your existing Tailwind compiler regenerates CSS from the literal source. The editor does not convert arbitrary CSS values into utilities or merge conflicting utilities. Temporary preview applies to CSS properties; class edits require save/recompile.

Dynamic expressions, clsx/cva, attribute spreads, interpolated/nested templates, theme functions, cross-file styled bindings, Vue CSS Modules/preprocessors and complex selectors are outside this adapter. No runtime application code is evaluated by the server. Unsupported values are left untouched or rejected before writing. Source conflict protection and byte-exact undo apply to component edits too.

The demo and automated HTTP checks cover React, Vue, Tailwind and styled-components. Emotion static templates share a parser adapter and have unit coverage; there is no separate Emotion browser demo. Frameworks keep their own configuration and licenses. Only configure trusted source files and keep the development service local.
