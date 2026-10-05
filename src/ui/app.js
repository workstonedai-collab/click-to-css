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
  value: "属性值",
  preview: "预览",
  save: "保存 CSS",
  tokens: "设计变量",
  diff: "最近一次源码变化",
  boundary: "仅用于本地开发 · 普通 CSS 文件 · Git 由你控制",
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
      selected.style.outline = "2px solid #2a9474";
      $("#rule").replaceChildren();
      rules.forEach((r, i) =>
        option(
          $("#rule"),
          i,
          r.file + " · " + r.selector + " [" + r.occurrence + "]" + r.context,
        ),
      );
      $("#rule").value = rules.length - 1;
      showValue();
      message(
        rules.length
          ? lang === "zh"
            ? "已选择元素"
            : "Element selected"
          : lang === "zh"
            ? "该元素没有可编辑的外部 CSS 规则"
            : "No editable external CSS rule for this element",
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
$("#apply").onclick = () =>
  run(() => {
    if (!selected)
      throw new Error(lang === "zh" ? "先选择元素" : "Select an element first");
    selected.style.setProperty($("#property").value, $("#value").value);
  });
$("#save").onclick = () =>
  run(async () => {
    const rule = rules[Number($("#rule").value)];
    if (!rule) throw new Error("Select an editable rule");
    const v = await api("save", {
      page: page.file,
      ...rule,
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
