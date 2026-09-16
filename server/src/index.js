"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { makeBannerPng, makeLogoPng, makeNinePatchBubblePng } = require("./png");

const DEFAULT_PORT = 8787;
const COLOR_TOKENS = ["brand.primary", "text.primary", "surface", "background"];
const ASSET_SLOTS = ["home.banner", "logo", "chat.bubble"];
const NINEPATCH_SLOTS = new Set(["chat.bubble"]);
const STRING_KEYS = [
  "string.app.title",
  "string.home.welcome",
  "string.home.body",
  "string.action.pull",
  "string.chat.short",
  "string.chat.bubble",
];
const LOCALES = ["zh-CN", "en"];
const DEFAULT_LOCALE = "en";
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const SEED_COLORS = {
  "brand.primary": "#E65100",
  "text.primary": "#3E2723",
  "surface": "#FFF3E0",
  "background": "#FFF8F1",
};

const SEED_STRINGS = {
  "zh-CN": {
    "string.app.title": "动态主题 Demo",
    "string.home.welcome": "你好，{name}！",
    "string.home.body": "这段文字来自远程语言包（zh-CN）。改文案后点发布，App 无需重装。",
    "string.action.pull": "立即拉取",
    "string.chat.short": "你好",
    "string.chat.bubble": "这是可拉伸的九宫格气泡。文字变长时四角保持圆角，中间被拉长——不是普通 ImageView 缩放。",
  },
  en: {
    "string.app.title": "Theme Demo",
    "string.home.welcome": "Hello, {name}!",
    "string.home.body": "This copy comes from the remote language pack (en). Publish to update the app without reinstalling.",
    "string.action.pull": "Pull now",
    "string.chat.short": "Hi",
    "string.chat.bubble": "This nine-patch bubble stretches with the text. Corners stay rounded; the center patches grow — not a plain ImageView scale.",
  },
};

function nowIso() {
  return new Date().toISOString();
}

function newSnapshotId(prefix = "snap") {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const rand = crypto.randomBytes(3).toString("hex");
  return `${prefix}_${stamp}_${rand}`;
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
      type: meta.type || (NINEPATCH_SLOTS.has(slot) ? "ninepatch" : "image"),
      ...(meta.hash ? { hash: meta.hash } : {}),
    };
  }
  return out;
}

function presentShards(shards, base) {
  return LOCALES.map((locale) => {
    const meta = shards?.[locale];
    if (!meta?.filename) return null;
    return {
      locale,
      url: `${base}/i18n/${encodeURIComponent(meta.filename)}`,
      hash: meta.hash,
      size: meta.size,
      keyCount: meta.keyCount,
    };
  }).filter(Boolean);
}

function saveAssetBuffer(assetsDir, slot, buffer, mime, originalName) {
  const original = originalName || "";
  const wantsNine = NINEPATCH_SLOTS.has(slot) || original.includes(".9.png");
  const ext =
    wantsNine ? ".9.png" :
    mime === "image/jpeg" ? ".jpg" :
    mime === "image/webp" ? ".webp" :
    path.extname(original).toLowerCase() === ".jpg" ? ".jpg" :
    ".png";
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const safeSlot = slot.replace(/[^a-z0-9._-]/gi, "_");
  const filename = `${safeSlot}-${hash.slice(0, 16)}${ext}`;
  fs.writeFileSync(path.join(assetsDir, filename), buffer);
  return {
    filename,
    mime,
    type: wantsNine || NINEPATCH_SLOTS.has(slot) ? "ninepatch" : "image",
    hash: `sha256:${hash}`,
    size: buffer.length,
  };
}

function normalizeMessages(input) {
  const messages = {};
  for (const locale of LOCALES) {
    messages[locale] = {};
    const src = input?.[locale] || {};
    for (const key of STRING_KEYS) {
      const value = src[key];
      if (value == null) continue;
      const text = String(value);
      if (text.length > 2000) {
        const err = new Error(`String too long for ${locale} / ${key}`);
        err.statusCode = 400;
        throw err;
      }
      messages[locale][key] = text;
    }
  }
  return messages;
}

function writeShards(i18nDir, messages) {
  ensureDir(i18nDir);
  const shards = {};
  for (const locale of LOCALES) {
    const payload = {
      locale,
      messages: messages[locale] || {},
    };
    const buf = Buffer.from(JSON.stringify(payload), "utf8");
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    const filename = `${locale}-${hash.slice(0, 16)}.json`;
    fs.writeFileSync(path.join(i18nDir, filename), buf);
    shards[locale] = {
      filename,
      hash: `sha256:${hash}`,
      size: buf.length,
      keyCount: Object.keys(payload.messages).length,
    };
  }
  return shards;
}

function seedThemeIfNeeded(paths) {
  ensureDir(paths.assetsDir);
  let draft = readJson(paths.draftFile, null);
  let published = readJson(paths.publishedFile, null);
  if (!draft || !published) {
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
    const bubble = saveAssetBuffer(
      paths.assetsDir,
      "chat.bubble",
      makeNinePatchBubblePng(SEED_COLORS["brand.primary"]),
      "image/png",
      "chat_bubble.9.png"
    );
    draft = {
      colors: { ...SEED_COLORS },
      assets: {
        "home.banner": banner,
        logo,
        "chat.bubble": bubble,
      },
    };
    published = {
      schemaVersion: 1,
      snapshotId: newSnapshotId("snap"),
      publishedAt: nowIso(),
      colors: { ...draft.colors },
      assets: { ...draft.assets },
    };
    writeJson(paths.draftFile, draft);
    writeJson(paths.publishedFile, published);
  }

  if (draft && !draft.assets?.["chat.bubble"]) {
    draft.assets = draft.assets || {};
    draft.assets["chat.bubble"] = saveAssetBuffer(
      paths.assetsDir,
      "chat.bubble",
      makeNinePatchBubblePng((draft.colors && draft.colors["brand.primary"]) || SEED_COLORS["brand.primary"]),
      "image/png",
      "chat_bubble.9.png"
    );
    writeJson(paths.draftFile, draft);
  }
  if (published && !published.assets?.["chat.bubble"] && draft?.assets?.["chat.bubble"]) {
    published.assets = published.assets || {};
    published.assets["chat.bubble"] = draft.assets["chat.bubble"];
    writeJson(paths.publishedFile, published);
  }
  return { draft, published };
}

function seedI18nIfNeeded(paths) {
  ensureDir(paths.i18nDir);
  let draft = readJson(paths.i18nDraftFile, null);
  let published = readJson(paths.i18nPublishedFile, null);
  if (!draft || !published) {
    draft = {
      defaultLocale: DEFAULT_LOCALE,
      locales: [...LOCALES],
      messages: JSON.parse(JSON.stringify(SEED_STRINGS)),
    };
    const shards = writeShards(paths.i18nDir, draft.messages);
    published = {
      schemaVersion: 1,
      i18nSnapshotId: newSnapshotId("i18n_snap"),
      publishedAt: nowIso(),
      defaultLocale: DEFAULT_LOCALE,
      locales: [...LOCALES],
      messages: draft.messages,
      shards,
    };
    writeJson(paths.i18nDraftFile, draft);
    writeJson(paths.i18nPublishedFile, published);
    return { draft, published };
  }

  let changed = false;
  draft.messages = draft.messages || {};
  for (const locale of LOCALES) {
    draft.messages[locale] = draft.messages[locale] || {};
    for (const key of STRING_KEYS) {
      if (draft.messages[locale][key] == null && SEED_STRINGS[locale]?.[key]) {
        draft.messages[locale][key] = SEED_STRINGS[locale][key];
        changed = true;
      }
    }
  }
  if (changed) writeJson(paths.i18nDraftFile, draft);
  return { draft, published };
}

function createApp(options = {}) {
  const root = path.resolve(options.dataDir || path.join(__dirname, "..", "data"));
  const webDir = path.resolve(options.webDir || path.join(__dirname, "..", "..", "web"));
  const paths = {
    root,
    assetsDir: path.join(root, "assets"),
    i18nDir: path.join(root, "i18n"),
    draftFile: path.join(root, "theme-draft.json"),
    publishedFile: path.join(root, "theme-published.json"),
    i18nDraftFile: path.join(root, "i18n-draft.json"),
    i18nPublishedFile: path.join(root, "i18n-published.json"),
  };
  seedThemeIfNeeded(paths);
  seedI18nIfNeeded(paths);

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
    const i18nDraft = readJson(paths.i18nDraftFile, { messages: {} });
    const i18nPublished = readJson(paths.i18nPublishedFile, null);
    const base = publicBase(req);
    res.json({
      tokens: COLOR_TOKENS,
      slots: ASSET_SLOTS,
      stringKeys: STRING_KEYS,
      locales: LOCALES,
      defaultLocale: DEFAULT_LOCALE,
      draft: {
        colors: draft.colors,
        assets: presentAssets(draft.assets, base),
        strings: i18nDraft.messages || {},
      },
      published: published && {
        snapshotId: published.snapshotId,
        publishedAt: published.publishedAt,
        linkedI18nSnapshotId: published.linkedI18nSnapshotId || i18nPublished?.i18nSnapshotId || null,
        colors: published.colors,
        assets: presentAssets(published.assets, base),
      },
      i18nPublished: i18nPublished && {
        i18nSnapshotId: i18nPublished.i18nSnapshotId,
        publishedAt: i18nPublished.publishedAt,
        defaultLocale: i18nPublished.defaultLocale,
        shards: presentShards(i18nPublished.shards, base),
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

  app.put("/admin/i18n", (req, res) => {
    try {
      const draft = readJson(paths.i18nDraftFile, {
        defaultLocale: DEFAULT_LOCALE,
        locales: [...LOCALES],
        messages: {},
      });
      const incoming = req.body?.messages || req.body || {};
      const merged = { ...(draft.messages || {}) };
      for (const locale of LOCALES) {
        merged[locale] = { ...(merged[locale] || {}) };
      }
      const normalized = normalizeMessages(incoming);
      for (const locale of LOCALES) {
        merged[locale] = { ...merged[locale], ...normalized[locale] };
      }
      draft.messages = merged;
      draft.defaultLocale = DEFAULT_LOCALE;
      draft.locales = [...LOCALES];
      writeJson(paths.i18nDraftFile, draft);
      res.json({ ok: true, messages: draft.messages });
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message || "Invalid i18n payload" });
    }
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
    const i18nDraft = readJson(paths.i18nDraftFile, null);
    if (!draft || !i18nDraft) return res.status(500).json({ error: "Draft missing" });
    const snapshotId = newSnapshotId("snap");
    const i18nSnapshotId = newSnapshotId("i18n_snap");
    const publishedAt = nowIso();
    const shards = writeShards(paths.i18nDir, i18nDraft.messages || {});
    const i18nPublished = {
      schemaVersion: 1,
      i18nSnapshotId,
      publishedAt,
      defaultLocale: i18nDraft.defaultLocale || DEFAULT_LOCALE,
      locales: [...LOCALES],
      messages: i18nDraft.messages,
      shards,
      linkedThemeSnapshotId: snapshotId,
    };
    const published = {
      schemaVersion: 1,
      snapshotId,
      publishedAt,
      linkedI18nSnapshotId: i18nSnapshotId,
      colors: { ...draft.colors },
      assets: { ...draft.assets },
    };
    writeJson(paths.publishedFile, published);
    writeJson(paths.i18nPublishedFile, i18nPublished);
    const base = publicBase(req);
    res.json({
      ok: true,
      snapshotId,
      i18nSnapshotId,
      publishedAt,
      colors: published.colors,
      assets: presentAssets(published.assets, base),
      i18n: {
        i18nSnapshotId,
        defaultLocale: i18nPublished.defaultLocale,
        shards: presentShards(shards, base),
      },
    });
  });

  app.get("/v1/theme/manifest", (req, res) => {
    const published = readJson(paths.publishedFile, null);
    const i18nPublished = readJson(paths.i18nPublishedFile, null);
    if (!published) return res.status(404).json({ error: "No published theme" });
    const base = publicBase(req);
    res.json({
      schemaVersion: published.schemaVersion || 1,
      snapshotId: published.snapshotId,
      publishedAt: published.publishedAt,
      ttlSeconds: 60,
      linkedI18nSnapshotId: published.linkedI18nSnapshotId || i18nPublished?.i18nSnapshotId || null,
      colors: published.colors,
      assets: presentAssets(published.assets, base),
    });
  });

  app.get("/v1/i18n/manifest", (req, res) => {
    const published = readJson(paths.i18nPublishedFile, null);
    const themePublished = readJson(paths.publishedFile, null);
    if (!published) return res.status(404).json({ error: "No published language pack" });
    const base = publicBase(req);
    res.json({
      schemaVersion: published.schemaVersion || 1,
      i18nSnapshotId: published.i18nSnapshotId,
      publishedAt: published.publishedAt,
      ttlSeconds: 60,
      defaultLocale: published.defaultLocale || DEFAULT_LOCALE,
      locales: published.locales || LOCALES,
      linkedThemeSnapshotId: published.linkedThemeSnapshotId || themePublished?.snapshotId || null,
      shards: presentShards(published.shards, base),
    });
  });

  app.use("/assets", express.static(paths.assetsDir, {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }));

  app.use("/i18n", express.static(paths.i18nDir, {
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
    console.log(`Theme API:    http://localhost:${port}/v1/theme/manifest`);
    console.log(`i18n API:     http://localhost:${port}/v1/i18n/manifest`);
    console.log(`Emulator URL: http://10.0.2.2:${port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  createApp,
  COLOR_TOKENS,
  ASSET_SLOTS,
  STRING_KEYS,
  LOCALES,
  DEFAULT_PORT,
};
