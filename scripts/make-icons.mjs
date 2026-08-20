/**
 * Generates the PWA icons.
 *
 * Drawn in code rather than committed as binaries nobody can diff: a rounded
 * square in the deck's deep green, a leaf formed by the intersection of two
 * circles, and a gold midrib. Run with `node scripts/make-icons.mjs`.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'icons');

const INK = [0x0e, 0x3e, 0x2e];
const LEAF = [0x2b, 0xa3, 0x63];
const GOLD = [0xf2, 0xb7, 0x05];

/* ----------------------------- PNG encoding ----------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                            // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ------------------------------- drawing -------------------------------- */

/** Smooth coverage of a signed-distance edge, for cheap antialiasing. */
const cover = (d, w = 1.2) => Math.max(0, Math.min(1, 0.5 - d / w));

function blend(dst, i, colour, alpha) {
  if (alpha <= 0) return;
  for (let c = 0; c < 3; c++) {
    dst[i + c] = Math.round(dst[i + c] * (1 - alpha) + colour[c] * alpha);
  }
  dst[i + 3] = Math.max(dst[i + 3], Math.round(255 * alpha));
}

function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);          // transparent
  const c = size / 2;
  const pad = maskable ? size * 0.14 : size * 0.045; // maskable needs safe area
  const radius = maskable ? size * 0.5 : size * 0.22;
  const half = c - pad;

  // Leaf geometry: intersection of two circles offset along the diagonal.
  const scale = maskable ? 0.30 : 0.36;
  const R = size * scale * 1.42;
  const off = size * scale * 0.86;
  const ax = c - off * 0.7071, ay = c + off * 0.7071;
  const bx = c + off * 0.7071, by = c - off * 0.7071;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = Math.abs(x + 0.5 - c), dy = Math.abs(y + 0.5 - c);

      // Rounded square (signed distance).
      const qx = Math.max(dx - (half - radius), 0);
      const qy = Math.max(dy - (half - radius), 0);
      const dBox = Math.hypot(qx, qy) - radius + Math.min(Math.max(dx - (half - radius), dy - (half - radius)), 0) * 0;
      blend(px, i, INK, cover(dBox, 1.6));

      // Leaf: inside both circles.
      const dA = Math.hypot(x + 0.5 - ax, y + 0.5 - ay) - R;
      const dB = Math.hypot(x + 0.5 - bx, y + 0.5 - by) - R;
      const dLeaf = Math.max(dA, dB);
      blend(px, i, LEAF, cover(dLeaf, 1.4));

      // Midrib along the leaf's long axis, clipped to the leaf body.
      const along = ((x + 0.5 - c) + (y + 0.5 - c)) / Math.SQRT2;      // ↘ axis
      const across = ((x + 0.5 - c) - (y + 0.5 - c)) / Math.SQRT2;     // ↗ axis
      const ribLen = size * scale * 1.02;
      const inRib = Math.max(Math.abs(across) - size * 0.012, Math.abs(along) - ribLen);
      blend(px, i, GOLD, cover(Math.max(inRib, dLeaf + 2), 1.2));
    }
  }
  return encodePng(size, size, px);
}

mkdirSync(OUT, { recursive: true });
const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}]
];

for (const [name, size, opts] of targets) {
  const png = draw(size, opts);
  writeFileSync(join(OUT, name), png);
  console.log(`${name.padEnd(26)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
