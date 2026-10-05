import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import {
  clickToCss,
  editRule,
  editTokens,
  validateValue,
} from "../src/index.js";
test("targets the correct rule occurrence inside a media query", () => {
  const source = ".card{color:red}@media(max-width:800px){.card{color:blue}}";
  const out = editRule(source, {
    selector: ".card",
    occurrence: 1,
    changes: [{ property: "color", value: "green" }],
  });
  assert.match(out, /color:red/);
  assert.match(out, /color:green/);
});
test("only existing configured tokens can change", () => {
  assert.match(
    editTokens(
      ":root{--demo-color:red;--other:blue}",
      [{ name: "--demo-color", value: "green" }],
      "--demo-",
    ),
    /--other:blue/,
  );
  assert.throws(() =>
    editTokens(
      ":root{--other:red}",
      [{ name: "--demo-missing", value: "green" }],
      "--demo-",
    ),
  );
});
test("rejects values and properties outside supported edits", () => {
  for (const value of [
    "red;display:none",
    "url(https://example.org/a)",
    "expression(x)",
    "",
  ])
    assert.throws(() => validateValue(value));
  assert.throws(() =>
    editRule(".a{}", {
      selector: ".a",
      changes: [{ property: "position", value: "fixed" }],
    }),
  );
  assert.throws(() =>
    clickToCss({ pages: [{ file: "../index.html", styles: ["a.css"] }] }),
  );
});
test("plugin is absent from production builds", () =>
  assert.equal(clickToCss().apply, "serve"));
test("HTTP edit, optimistic conflict, origin restriction and undo work", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "css-editor-"));
  let server;
  try {
    await fs.writeFile(
      path.join(root, "index.html"),
      '<link rel="stylesheet" href="/style.css"><h1>Hello</h1>',
    );
    const file = path.join(root, "style.css");
    const before = "h1{color:red}";
    await fs.writeFile(file, before);
    server = await createServer({
      configFile: false,
      root,
      plugins: [clickToCss()],
      server: { host: "127.0.0.1", port: 0 },
    });
    await server.listen();
    const port = server.httpServer.address().port,
      base = "http://127.0.0.1:" + port;
    const post = (endpoint, payload, origin = base) =>
      fetch(base + "/__click_to_css/" + endpoint, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    const edit = {
      page: "index.html",
      file: "style.css",
      before,
      selector: "h1",
      occurrence: 0,
      changes: [{ property: "color", value: "green" }],
    };
    assert.equal((await post("save", edit, "https://example.org")).status, 403);
    assert.equal(await fs.readFile(file, "utf8"), before);
    assert.equal((await post("save", edit)).status, 200);
    assert.match(await fs.readFile(file, "utf8"), /green/);
    assert.equal((await post("save", edit)).status, 409);
    assert.equal((await post("undo", {})).status, 200);
    assert.equal(await fs.readFile(file, "utf8"), before);
    await post("save", edit);
    await fs.writeFile(file, "h1{color:purple}");
    assert.equal((await post("undo", {})).status, 409);
    assert.equal(await fs.readFile(file, "utf8"), "h1{color:purple}");
    assert.equal(
      (await post("save", { ...edit, file: "../secret.css" })).status,
      400,
    );
  } finally {
    await server?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
