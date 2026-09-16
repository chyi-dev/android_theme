"use strict";

const zlib = require("zlib");

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Encode a 32-bit RGBA PNG. getPixel(x, y) -> [r, g, b, a] */
function encodePng(width, height, getPixel) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = getPixel(x, y);
      const i = y * stride + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeBannerPng(hex = "#E65100") {
  const [br, bg, bb] = hexToRgb(hex);
  const width = 960;
  const height = 320;
  return encodePng(width, height, (x, y) => {
    const stripe = y > height * 0.62 && y < height * 0.78;
    if (stripe) return [255, 255, 255, 230];
    const t = x / width;
    const r = Math.round(br * (0.75 + 0.25 * t));
    const g = Math.round(bg * (0.85 + 0.15 * (1 - t)));
    const b = Math.round(bb + (40 * t));
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b), 255];
  });
}

function makeLogoPng(hex = "#E65100") {
  const [br, bg, bb] = hexToRgb(hex);
  const size = 192;
  const cx = (size - 1) / 2;
  const radius = size * 0.42;
  return encodePng(size, size, (x, y) => {
    const dx = x - cx;
    const dy = y - cx;
    if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];
    const inStem = Math.abs(x - cx) < size * 0.08 && y > size * 0.32 && y < size * 0.72;
    const inBar = y > size * 0.30 && y < size * 0.42 && Math.abs(x - cx) < size * 0.22;
    if (inStem || inBar) return [255, 255, 255, 255];
    return [br, bg, bb, 255];
  });
}

function insideRoundedRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  if (x >= r && x < w - r) return true;
  if (y >= r && y < h - r) return true;
  const cx = x < r ? r : w - 1 - r;
  const cy = y < r ? r : h - 1 - r;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Source .9.png (1px markers) for a stretchable chat bubble / panel. */
function makeNinePatchBubblePng(hex = "#E65100") {
  const [br, bg, bb] = hexToRgb(hex);
  const cw = 160;
  const ch = 96;
  const w = cw + 2;
  const h = ch + 2;
  const corner = 18;
  const pad = 10;
  const outline = 3;
  const radius = 16;
  const black = [0, 0, 0, 255];
  const clear = [0, 0, 0, 0];
  return encodePng(w, h, (x, y) => {
    const onBorder = y === 0 || y === h - 1 || x === 0 || x === w - 1;
    if (onBorder) {
      if (y === 0 && x >= corner && x <= w - 1 - corner) return black;
      if (x === 0 && y >= corner && y <= h - 1 - corner) return black;
      if (y === h - 1 && x >= pad && x <= w - 1 - pad) return black;
      if (x === w - 1 && y >= pad && y <= h - 1 - pad) return black;
      return clear;
    }
    const cx = x - 1;
    const cy = y - 1;
    if (!insideRoundedRect(cx, cy, cw, ch, radius)) return clear;
    if (!insideRoundedRect(cx - outline, cy - outline, cw - outline * 2, ch - outline * 2, Math.max(1, radius - outline))) {
      return [Math.max(0, br - 50), Math.max(0, bg - 50), Math.max(0, bb - 50), 255];
    }
    return [br, bg, bb, 255];
  });
}

module.exports = { encodePng, makeBannerPng, makeLogoPng, makeNinePatchBubblePng };
