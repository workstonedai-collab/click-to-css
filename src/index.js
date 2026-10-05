// SPDX-License-Identifier: MIT
// Copyright 2026 workstonedai-collab
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import postcss from "postcss";

const PROPERTIES = new Set(
  "font-family font-size font-weight line-height letter-spacing text-align color width height min-width max-width display flex-direction justify-content align-items grid-template-columns grid-template-rows gap margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left background-color border-width border-style border-color border-radius box-shadow".split(
    " ",
  ),
);
const PREFIX = "/__click_to_css";
const UI = new URL("./ui/", import.meta.url);
const normalize = (s) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
export function validateValue(value) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 300 ||
    /[;{}<>\u0000-\u001f]/.test(value) ||
    /(?:url|expression)\s*\(|@import|javascript:/i.test(value)
  )
    throw new Error("Unsupported CSS value");
  return value.trim();
}
export function editRule(css, { selector, occurrence = 0, changes }) {
  if (
    typeof selector !== "string" ||
    !selector.trim() ||
    selector.length > 500 ||
    !Number.isInteger(occurrence) ||
    occurrence < 0 ||
    occurrence > 2000 ||
    !Array.isArray(changes) ||
    !changes.length ||
    changes.length > PROPERTIES.size
  )
    throw new Error("Invalid rule edit");
  const root = postcss.parse(css);
  let seen = -1,
    target;
  root.walkRules((rule) => {
    if (
      normalize(rule.selector) === normalize(selector) &&
      ++seen === occurrence
    )
      target = rule;
  });
  if (!target) throw new Error("CSS rule no longer exists");
  for (const change of changes) {
    if (!PROPERTIES.has(change.property))
      throw new Error("Property is not editable");
    const value = validateValue(change.value);
    const declarations = target.nodes.filter(
      (n) => n.type === "decl" && n.prop === change.property,
    );
    if (declarations.length) declarations.at(-1).value = value;
    else target.append({ prop: change.property, value });
  }
  return root.toString();
}
export function editTokens(css, changes, prefix = "--") {
  if (!Array.isArray(changes) || !changes.length || changes.length > 40)
    throw new Error("Invalid token edit");
  const root = postcss.parse(css),
    pending = new Map();
  for (const c of changes) {
    if (
      typeof c.name !== "string" ||
      !/^--[a-zA-Z0-9_-]+$/.test(c.name) ||
      !c.name.startsWith(prefix)
    )
      throw new Error("Token is not allowed");
    pending.set(c.name, validateValue(c.value));
  }
  const found = new Set();
  root.walkDecls((decl) => {
    if (pending.has(decl.prop)) {
      decl.value = pending.get(decl.prop);
      found.add(decl.prop);
    }
  });
  if ([...pending.keys()].some((k) => !found.has(k)))
    throw new Error("Only existing tokens can be edited");
  return root.toString();
}
const inside = (root, file) => {
  const rel = path.relative(root, file);
  return (
    rel !== "" &&
    !rel.startsWith(".." + path.sep) &&
    rel !== ".." &&
    !path.isAbsolute(rel)
  );
};
function relativeName(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    path.isAbsolute(value) ||
    value.split("/").some((p) => p === ".." || p === "." || !p)
  )
    throw new Error("Use a safe relative file path");
  return value;
}
function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
async function body(req) {
  let value = "",
    bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 65536) throw new Error("Request too large");
    value += chunk;
  }
  return JSON.parse(value);
}
async function atomicWrite(file, value) {
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(temp, value, { mode: (await fs.stat(file)).mode });
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
/** Configure only files you own. Ordinary external CSS files in static HTML are supported. */
export function clickToCss(options = {}) {
  const pages = options.pages || [
    { file: "index.html", label: "Home", styles: ["style.css"] },
  ];
  const tokenFile = options.tokenFile || null,
    tokenPrefix = options.tokenPrefix || "--";
  for (const p of pages) {
    relativeName(p.file);
    if (
      !p.file.endsWith(".html") ||
      !Array.isArray(p.styles) ||
      !p.styles.length
    )
      throw new Error("Each page needs an HTML file and CSS files");
    for (const s of p.styles)
      if (!relativeName(s).endsWith(".css"))
        throw new Error("Styles must be CSS files");
  }
  if (tokenFile && !relativeName(tokenFile).endsWith(".css"))
    throw new Error("Token file must be CSS");
  const allowed = new Set([
    ...pages.flatMap((p) => p.styles),
    ...(tokenFile ? [tokenFile] : []),
  ]);
  const undo = [];
  let chain = Promise.resolve();
  return {
    name: "click-to-css",
    apply: "serve",
    async configureServer(server) {
      const root = await fs.realpath(server.config.root);
      async function fileFor(name) {
        relativeName(name);
        if (!allowed.has(name)) throw new Error("File is not allowed");
        const file = await fs.realpath(path.resolve(root, name));
        if (!inside(root, file)) throw new Error("Symlink escapes project");
        return file;
      }
      const serial = (fn) => {
        const next = chain.then(fn);
        chain = next.catch(() => {});
        return next;
      };
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || "").split("?")[0];
        if (!(pathname === PREFIX || pathname.startsWith(PREFIX + "/")))
          return next();
        try {
          const remote = req.socket.remoteAddress;
          const host = req.headers.host || "";
          const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
            remote,
          );
          if (
            !loopback ||
            !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)
          )
            return json(res, 403, { error: "Local development access only" });
          if (
            req.method === "POST" &&
            req.headers.origin !== `http://${host}` &&
            req.headers.origin !== `https://${host}`
          )
            return json(res, 403, { error: "Same-origin request required" });
          if (
            req.method === "GET" &&
            [
              PREFIX,
              PREFIX + "/",
              PREFIX + "/app.js",
              PREFIX + "/style.css",
            ].includes(pathname)
          ) {
            const filename = pathname.endsWith("app.js")
              ? "app.js"
              : pathname.endsWith("style.css")
                ? "style.css"
                : "index.html";
            res.setHeader(
              "Content-Type",
              {
                "index.html": "text/html; charset=utf-8",
                "app.js": "text/javascript",
                "style.css": "text/css",
              }[filename],
            );
            res.setHeader("Cache-Control", "no-store");
            res.end(await fs.readFile(new URL(filename, UI)));
            return;
          }
          if (req.method === "GET" && pathname === PREFIX + "/state") {
            const css = {};
            for (const name of allowed)
              css[name] = await fs.readFile(await fileFor(name), "utf8");
            const tokens = [];
            if (tokenFile)
              postcss.parse(css[tokenFile]).walkDecls((d) => {
                if (d.prop.startsWith(tokenPrefix) && d.prop.startsWith("--"))
                  tokens.push({ name: d.prop, value: d.value });
              });
            return json(res, 200, {
              pages,
              tokenFile,
              tokens,
              properties: [...PROPERTIES],
              css,
              undoCount: undo.length,
            });
          }
          if (req.method !== "POST")
            return json(res, 405, { error: "Method not supported" });
          const payload = await body(req);
          if (pathname === PREFIX + "/save") {
            return await serial(async () => {
              if (
                !pages.some(
                  (p) =>
                    p.file === payload.page && p.styles.includes(payload.file),
                )
              )
                throw new Error("Stylesheet is not allowed for this page");
              const file = await fileFor(payload.file),
                before = await fs.readFile(file, "utf8");
              if (payload.before !== before)
                return json(res, 409, {
                  error: "Source changed; refresh and select the rule again",
                });
              const after = editRule(before, payload);
              await atomicWrite(file, after);
              undo.push({ name: payload.file, before, after });
              if (undo.length > 100) undo.shift();
              json(res, 200, { saved: payload.file, before, after });
            });
          }
          if (pathname === PREFIX + "/tokens") {
            return await serial(async () => {
              if (!tokenFile) throw new Error("No token file configured");
              const file = await fileFor(tokenFile),
                before = await fs.readFile(file, "utf8");
              if (payload.before !== before)
                return json(res, 409, {
                  error: "Source changed; refresh first",
                });
              const after = editTokens(before, payload.changes, tokenPrefix);
              await atomicWrite(file, after);
              undo.push({ name: tokenFile, before, after });
              if (undo.length > 100) undo.shift();
              json(res, 200, { saved: tokenFile, before, after });
            });
          }
          if (pathname === PREFIX + "/undo") {
            return await serial(async () => {
              const last = undo.at(-1);
              if (!last) return json(res, 200, { undone: null });
              const file = await fileFor(last.name),
                current = await fs.readFile(file, "utf8");
              if (current !== last.after)
                return json(res, 409, {
                  error: "Source changed outside the editor; undo refused",
                });
              await atomicWrite(file, last.before);
              undo.pop();
              json(res, 200, {
                undone: last.name,
                before: last.after,
                after: last.before,
              });
            });
          }
          json(res, 404, { error: "Unknown endpoint" });
        } catch (error) {
          json(res, 400, { error: error.message });
        }
      });
    },
  };
}
