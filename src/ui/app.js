// SPDX-License-Identifier: MIT
// Copyright 2026 workstonedai-collab
const $ = (s) => document.querySelector(s),
  frame = $("#preview");
let state,
  page,
  selected,
  rules = [],
  interact = false,
  lang = "en";
const zh = {
  subtitle: "点选、调整、保存回源码。",
  interact: "操作页面",
  undo: "撤销",
  heading: "编辑真实 CSS",
  hint: "点选元素，选择规则和属性，然后预览或保存。",
  rule: "源文件规则",
  property: "属性",
  value: "属性值 / 完整类名",
  preview: "预览",
  save: "保存源码",
  tokens: "设计变量",
  diff: "最近一次源码变化",
  boundary: "仅用于本地开发 · CSS 与已配置组件 · Git 由你控制",
};
const english = Object.fromEntries(
  [...document.querySelectorAll("[data-i18n]")].map((e) => [
    e.dataset.i18n,
    e.textContent,
  ]),
);
const message = (s) => {
  $("#status").textContent = s;
};
async function api(endpoint, payload) {
  const r = await fetch(
    "/__click_to_css/" + endpoint,
    payload
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      : {},
  );
  const v = await r.json();
  if (!r.ok) throw new Error(v.error);
  return v;
}
function option(select, value, text) {
  select.add(new Option(text, value));
}
function diff(v) {
  $("#diff").textContent =
    "--- " +
    (v.saved || v.undone || "") +
    "\n" +
    v.before +
    "\n+++\n" +
    v.after;
}
async function refresh() {
  const previousProperty = $("#property").value;
  state = await api("state");
  $("#page").replaceChildren();
  state.pages.forEach((p, i) => option($("#page"), i, p.label || p.file));
  $("#property").replaceChildren();
  state.properties.forEach((p) => option($("#property"), p, p));
  if (state.properties.includes(previousProperty))
    $("#property").value = previousProperty;
  $("#tokens").replaceChildren();
  for (const t of state.tokens) {
    const label = document.createElement("label"),
      name = document.createElement("span"),
      input = document.createElement("input"),
      save = document.createElement("button");
    name.textContent = t.name;
    input.value = t.value;
    save.textContent = lang === "zh" ? "保存变量" : "Save token";
    save.onclick = () =>
      run(async () => {
        const v = await api("tokens", {
          before: state.css[state.tokenFile],
          changes: [{ name: t.name, value: input.value }],
        });
        diff(v);
        await refresh();
        load();
        message(lang === "zh" ? "变量已保存" : "Token saved");
      });
    label.append(name, input, save);
    $("#tokens").append(label);
  }
  if (page)
    $("#page").value = state.pages.findIndex((p) => p.file === page.file);
}
function load() {
  page = state.pages[Number($("#page").value) || 0];
  selected = null;
  rules = [];
  $("#value").value = "";
  $("#rule").replaceChildren();
  frame.src = "/" + page.file + "?editor=" + Date.now();
}
function collect(element) {
  const out = [];
  const id = element.getAttribute('data-click-to-css-source');
  const component = Object.values(state.components || {}).find(c => c.elements.some(e => e.id === id));
  if (component) for (const target of component.targets) {
    let matches = target.elementId === id;
    if (target.mode === 'vue-css') { try { matches = element.matches(target.selector); } catch {} }
    if (matches) out.push({...target, component:true, target:target.id});
  }
  for (const sheet of frame.contentDocument.styleSheets) {
    if (!sheet.href) continue;
    const file = decodeURIComponent(new URL(sheet.href).pathname.slice(1));
    if (!page.styles.includes(file)) continue;
    const counts = new Map();
    const visit = (items, active = true, context = "") => {
      for (const rule of items) {
        if (rule.selectorText) {
          const sel = rule.selectorText
            .replace(/\s+/g, " ")
            .replace(/\s*,\s*/g, ", ")
            .trim();
          const n = counts.get(sel) || 0;
          counts.set(sel, n + 1);
          try {
            if (active && element.matches(rule.selectorText))
              out.push({
                file,
                selector: rule.selectorText,
                occurrence: n,
                context,
              });
          } catch {}
        } else if (rule.cssRules) {
          let applies = active;
          if (rule.conditionText) {
            if (rule.cssText.startsWith("@media"))
              applies =
                active &&
                frame.contentWindow.matchMedia(rule.conditionText).matches;
            else if (rule.cssText.startsWith("@supports"))
              applies = active && CSS.supports(rule.conditionText);
          }
          visit(
            rule.cssRules,
            applies,
            context + " " + (rule.conditionText || ""),
          );
        }
      }
    };
    try {
      visit(sheet.cssRules);
    } catch {}
  }
  return out;
}
function showValue() {
  const rule = rules[Number($("#rule").value)];
  $("#property").disabled = rule?.mode === 'classes';
  if (rule?.mode === 'classes') { $("#value").value = rule.value; return; }
  if (selected)
    $("#value").value = frame.contentWindow
      .getComputedStyle(selected)
      .getPropertyValue($("#property").value)
      .trim();
}
frame.onload = () => {
  const doc = frame.contentDocument;
  doc.addEventListener(
    "click",
    (e) => {
      if (interact) return;
      e.preventDefault();
      e.stopPropagation();
      if (selected) selected.style.outline = "";
      selected = e.target;
      rules = collect(selected);
      const sourceId = selected.getAttribute('data-click-to-css-source');
      const mapped = Object.values(state.components || {}).flatMap(c=>c.elements).find(e=>e.id===sourceId);
      $('#source').textContent = mapped ? `${mapped.file}:${mapped.line} · <${mapped.tag}>` : '';
      selected.style.outline = "2px solid #2a9474";
      $("#rule").replaceChildren();
      rules.forEach((r, i) =>
        option(
          $("#rule"),
          i,
          r.component ? `${r.file}:${r.line} · ${r.mode} ${r.selector || r.tag || ""}` : r.file + " · " + r.selector + " [" + r.occurrence + "]" + r.context,
        ),
      );
      $("#rule").value = 0;
      showValue();
      message(
        rules.length
          ? lang === "zh"
            ? "已选择元素"
            : "Element selected"
          : lang === "zh"
            ? "没有可编辑的静态样式；动态表达式保持不变"
            : "No editable static style; dynamic expressions are left unchanged",
      );
    },
    true,
  );
};
async function run(fn) {
  try {
    await fn();
  } catch (e) {
    message(e.message);
  }
}
$("#page").onchange = load;
$("#property").onchange = showValue;
$("#rule").onchange = showValue;
$("#apply").onclick = () =>
  run(() => {
    if (!selected)
      throw new Error(lang === "zh" ? "先选择元素" : "Select an element first");
    const rule = rules[Number($("#rule").value)];
    if (rule?.mode === 'classes') throw new Error(lang === 'zh' ? '保存完整类名后由 Tailwind 重新生成样式；预览只支持 CSS 属性。' : 'Save literal classes to regenerate Tailwind styles; preview is for CSS properties.');
    selected.style.setProperty($("#property").value, $("#value").value);
  });
$("#save").onclick = () =>
  run(async () => {
    const rule = rules[Number($("#rule").value)];
    if (!rule) throw new Error("Select an editable rule");
    const v = await api(rule.component ? "component" : "save", {
      page: page.file,
      ...rule,
      value: $("#value").value,
      before: state.css[rule.file],
      changes: [{ property: $("#property").value, value: $("#value").value }],
    });
    diff(v);
    await refresh();
    load();
    message(lang === "zh" ? "CSS 已写回源文件" : "CSS saved to source");
  });
$("#undo").onclick = () =>
  run(async () => {
    const v = await api("undo", {});
    if (v.undone) {
      diff(v);
      await refresh();
      load();
      message(lang === "zh" ? "已撤销" : "Undone");
    } else message(lang === "zh" ? "暂无可撤销修改" : "Nothing to undo");
  });
$("#mode").onclick = () => {
  interact = !interact;
  $("#mode").textContent = interact
    ? lang === "zh"
      ? "选择元素"
      : "Select elements"
    : lang === "zh"
      ? "操作页面"
      : "Interact with page";
};
$("#language").onclick = () => {
  lang = lang === "en" ? "zh" : "en";
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document
    .querySelectorAll("[data-i18n]")
    .forEach(
      (e) => (e.textContent = (lang === "zh" ? zh : english)[e.dataset.i18n]),
    );
  $("#language").textContent = lang === "zh" ? "English" : "中文";
  run(refresh);
};
run(async () => {
  await refresh();
  load();
});
