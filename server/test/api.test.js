"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/index");
const { encodePng } = require("../src/png");

function listen(app) {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function withServer(fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "theme-demo-"));
  const webDir = path.join(__dirname, "..", "..", "web");
  const app = createApp({ dataDir, webDir });
  const { server, base } = await listen(app);
  try {
    await fn(base);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function tinyPng() {
  return encodePng(2, 2, () => [0, 128, 255, 255]);
}

test("seeded manifest is served with absolute asset URLs", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/theme/manifest`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.schemaVersion, 1);
    assert.match(body.snapshotId, /^snap_/);
    assert.equal(body.colors["brand.primary"], "#E65100");
    assert.match(body.assets["home.banner"].url, /^http:\/\/127\.0\.0\.1:\d+\/assets\//);
    const img = await fetch(body.assets["home.banner"].url);
    assert.equal(img.status, 200);
    assert.ok((await img.arrayBuffer()).byteLength > 32);
  });
});

test("color edits stay in draft until publish", async () => {
  await withServer(async (base) => {
    const before = await (await fetch(`${base}/v1/theme/manifest`)).json();
    const put = await fetch(`${base}/admin/theme/colors`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "brand.primary": "#112233" }),
    });
    assert.equal(put.status, 200);
    const mid = await (await fetch(`${base}/v1/theme/manifest`)).json();
    assert.equal(mid.snapshotId, before.snapshotId);
    assert.equal(mid.colors["brand.primary"], "#E65100");

    const published = await fetch(`${base}/admin/theme/publish`, { method: "POST" });
    assert.equal(published.status, 200);
    const after = await (await fetch(`${base}/v1/theme/manifest`)).json();
    assert.notEqual(after.snapshotId, before.snapshotId);
    assert.equal(after.colors["brand.primary"], "#112233");
  });
});

test("image upload replaces slot after publish", async () => {
  await withServer(async (base) => {
    const png = tinyPng();
    const form = new FormData();
    form.set("file", new Blob([png], { type: "image/png" }), "new-banner.png");
    const up = await fetch(`${base}/admin/theme/assets/home.banner`, { method: "POST", body: form });
    assert.equal(up.status, 200);
    await fetch(`${base}/admin/theme/publish`, { method: "POST" });
    const manifest = await (await fetch(`${base}/v1/theme/manifest`)).json();
    const img = await fetch(manifest.assets["home.banner"].url);
    assert.equal(img.status, 200);
    const bytes = new Uint8Array(await img.arrayBuffer());
    assert.deepEqual(Buffer.from(bytes), png);
  });
});

test("CORS is enabled and admin UI is served", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/theme/manifest`, {
      headers: { Origin: "http://example.com" },
    });
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    const html = await fetch(`${base}/`);
    assert.equal(html.status, 200);
    const text = await html.text();
    assert.match(text, /动态主题/);
  });
});

test("rejects invalid color and unknown slot", async () => {
  await withServer(async (base) => {
    const bad = await fetch(`${base}/admin/theme/colors`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "brand.primary": "blue" }),
    });
    assert.equal(bad.status, 400);
    const slot = await fetch(`${base}/admin/theme/assets/not.a.slot`, { method: "POST" });
    assert.equal(slot.status, 400);
  });
});
