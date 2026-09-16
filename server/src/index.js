"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { makeBannerPng, makeLogoPng } = require("./png");

const DEFAULT_PORT = 8787;
const COLOR_TOKENS = ["brand.primary", "text.primary", "surface", "background"];
const ASSET_SLOTS = ["home.banner", "logo"];
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const SEED_COLORS = {
  "brand.primary": "#E65100",
  "text.primary": "#3E2723",
  "surface": "#FFF3E0",
  "background": "#FFF8F1",
};

function nowIso() {
  return new Date().toISOString();
}

function newSnapshotId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const rand = crypto.randomBytes(3).toString("hex");
  return `snap_${stamp}_${rand}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function publicBase(req) {
  const env = process.env.PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

function presentAssets(assets, base) {
  const out = {};
  for (const slot of ASSET_SLOTS) {
    const meta = assets?.[slot];
    if (!meta?.filename) continue;
    out[slot] = {
      url: `${base}/assets/${encodeURIComponent(meta.filename)}`,
      mime: meta.mime,
      ...(meta.hash ? { hash: meta.hash } : {}),
    };
  }
  return out;
}

function saveAssetBuffer(assetsDir, slot, buffer, mime, originalName) {
  const ext =
    mime === "image/jpeg" ? ".jpg" :
    mime === "image/webp" ? ".webp" :
    path.extname(originalName || "").toLowerCase() === ".jpg" ? ".jpg" :
    ".png";
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const safeSlot = slot.replace(/[^a-z0-9._-]/gi, "_");
  const filename = `${safeSlot}-${hash.slice(0, 16)}${ext}`;
  fs.writeFileSync(path.join(assetsDir, filename), buffer);
  return {
    filename,
    mime,
    hash: `sha256:${hash}`,
    size: buffer.length,
  };
}

function seedIfNeeded(paths) {
  ensureDir(paths.assetsDir);
  let draft = readJson(paths.draftFile, null);
  let published = readJson(paths.publishedFile, null);
  if (draft && published) return { draft, published };

  const banner = saveAssetBuffer(
    paths.assetsDir,
    "home.banner",
    makeBannerPng(SEED_COLORS["brand.primary"]),
    "image/png",
    "banner.png"
  );
  const logo = saveAssetBuffer(
    paths.assetsDir,
    "logo",
    makeLogoPng(SEED_COLORS["brand.primary"]),
    "image/png",
    "logo.png"
  );
  draft = {
    colors: { ...SEED_COLORS },
    assets: {
      "home.banner": banner,
      logo,
    },
  };
  published = {
    schemaVersion: 1,
    snapshotId: newSnapshotId(),
    publishedAt: nowIso(),
    colors: { ...draft.colors },
    assets: { ...draft.assets },
  };
  writeJson(paths.draftFile, draft);
  writeJson(paths.publishedFile, published);
  return { draft, published };
}

function createApp(options = {}) {
  const root = path.resolve(options.dataDir || path.join(__dirname, "..", "data"));
  const webDir = path.resolve(options.webDir || path.join(__dirname, "..", "..", "web"));
  const paths = {
    root,
    assetsDir: path.join(root, "assets"),
    draftFile: path.join(root, "theme-draft.json"),
    publishedFile: path.join(root, "theme-published.json"),
  };
  seedIfNeeded(paths);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "256kb" }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
      else cb(new Error("Only PNG / JPEG / WebP images are allowed"));
    },
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "theme-demo" });
  });

  app.get("/admin/theme", (req, res) => {
    const draft = readJson(paths.draftFile, { colors: {}, assets: {} });
    const published = readJson(paths.publishedFile, null);
    const base = publicBase(req);
    res.json({
      tokens: COLOR_TOKENS,
      slots: ASSET_SLOTS,
      draft: {
        colors: draft.colors,
        assets: presentAssets(draft.assets, base),
      },
      published: published && {
        snapshotId: published.snapshotId,
        publishedAt: published.publishedAt,
        colors: published.colors,
        assets: presentAssets(published.assets, base),
      },
    });
  });

  app.put("/admin/theme/colors", (req, res) => {
    const body = req.body || {};
    const draft = readJson(paths.draftFile, { colors: {}, assets: {} });
    const next = { ...draft.colors };
    for (const token of COLOR_TOKENS) {
      if (body[token] == null) continue;
      const hex = String(body[token]).trim();
      if (!HEX_RE.test(hex)) {
        return res.status(400).json({ error: `Invalid hex for ${token}: ${hex}` });
      }
      next[token] = hex.toUpperCase();
    }
    draft.colors = next;
    writeJson(paths.draftFile, draft);
    res.json({ ok: true, colors: draft.colors });
  });

  app.post("/admin/theme/assets/:slot", (req, res) => {
    const slot = req.params.slot;
    if (!ASSET_SLOTS.includes(slot)) {
      return res.status(400).json({ error: `Unknown slot: ${slot}` });
    }
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "Missing file field 'file'" });
      const draft = readJson(paths.draftFile, { colors: {}, assets: {} });
      const meta = saveAssetBuffer(
        paths.assetsDir,
        slot,
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );
      draft.assets = { ...(draft.assets || {}), [slot]: meta };
      writeJson(paths.draftFile, draft);
      const base = publicBase(req);
      res.json({ ok: true, slot, asset: presentAssets({ [slot]: meta }, base)[slot] });
    });
  });

  app.post("/admin/theme/publish", (req, res) => {
    const draft = readJson(paths.draftFile, null);
    if (!draft) return res.status(500).json({ error: "Draft missing" });
    const published = {
      schemaVersion: 1,
      snapshotId: newSnapshotId(),
      publishedAt: nowIso(),
      colors: { ...draft.colors },
      assets: { ...draft.assets },
    };
    writeJson(paths.publishedFile, published);
    const base = publicBase(req);
    res.json({
      ok: true,
      snapshotId: published.snapshotId,
      publishedAt: published.publishedAt,
      colors: published.colors,
      assets: presentAssets(published.assets, base),
    });
  });

  app.get("/v1/theme/manifest", (req, res) => {
    const published = readJson(paths.publishedFile, null);
    if (!published) return res.status(404).json({ error: "No published theme" });
    const base = publicBase(req);
    res.json({
      schemaVersion: published.schemaVersion || 1,
      snapshotId: published.snapshotId,
      publishedAt: published.publishedAt,
      ttlSeconds: 60,
      colors: published.colors,
      assets: presentAssets(published.assets, base),
    });
  });

  app.use("/assets", express.static(paths.assetsDir, {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }));

  if (fs.existsSync(webDir)) {
    app.use(express.static(webDir));
  }

  app.use((err, _req, res, _next) => {
    res.status(400).json({ error: err.message || "Bad request" });
  });

  return app;
}

function start() {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const app = createApp();
  app.listen(port, "0.0.0.0", () => {
    console.log(`Theme demo server listening on http://0.0.0.0:${port}`);
    console.log(`Admin UI:     http://localhost:${port}/`);
    console.log(`Client API:   http://localhost:${port}/v1/theme/manifest`);
    console.log(`Emulator URL: http://10.0.2.2:${port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { createApp, COLOR_TOKENS, ASSET_SLOTS, DEFAULT_PORT };
