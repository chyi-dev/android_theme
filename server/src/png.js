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

module.exports = { encodePng, makeBannerPng, makeLogoPng };
