/**
 * generate-icons.js
 * Generates icon16.png, icon48.png, icon128.png for the Chrome extension.
 * Zero dependencies — uses only Node.js built-in zlib.
 *
 * Run: node chrome-extension/generate-icons.js
 */

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ── CRC32 (required for PNG chunks) ──────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG builder ───────────────────────────────────────────────────────────────

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePNG(w, h, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type

  // Scanlines: 1 filter byte + 4 bytes/pixel per row
  const stride = w * 4;
  const raw = Buffer.alloc(h * (1 + stride));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + stride)] = 0; // filter = None
    pixels.copy(raw, y * (1 + stride) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────

function blendPixel(px, w, x, y, r, g, b, a) {
  if (x < 0 || x >= w || y < 0 || y >= w) return;
  const i = (y * w + x) * 4;
  const a1 = a / 255;
  const a0 = px[i + 3] / 255;
  const ao = a1 + a0 * (1 - a1);
  if (ao < 0.001) return;
  px[i]     = Math.round((r * a1 + px[i]     * a0 * (1 - a1)) / ao);
  px[i + 1] = Math.round((g * a1 + px[i + 1] * a0 * (1 - a1)) / ao);
  px[i + 2] = Math.round((b * a1 + px[i + 2] * a0 * (1 - a1)) / ao);
  px[i + 3] = Math.round(ao * 255);
}

/** Fill an axis-aligned rounded rectangle with anti-aliased corners. */
function roundedRect(px, size, x0, y0, x1, y1, cr, r, g, b, a = 255) {
  const corners = [
    [x0 + cr, y0 + cr],
    [x1 - cr, y0 + cr],
    [x0 + cr, y1 - cr],
    [x1 - cr, y1 - cr],
  ];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let alpha = a;
      // Determine which (if any) corner region this pixel is in
      let cx = -1, cy = -1;
      if      (x <= corners[0][0] && y <= corners[0][1]) { cx = corners[0][0]; cy = corners[0][1]; }
      else if (x >= corners[1][0] && y <= corners[1][1]) { cx = corners[1][0]; cy = corners[1][1]; }
      else if (x <= corners[2][0] && y >= corners[2][1]) { cx = corners[2][0]; cy = corners[2][1]; }
      else if (x >= corners[3][0] && y >= corners[3][1]) { cx = corners[3][0]; cy = corners[3][1]; }

      if (cx >= 0) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (d > cr + 0.5) continue;
        if (d > cr - 0.5) alpha = Math.round(a * (cr + 0.5 - d));
      }
      blendPixel(px, size, x, y, r, g, b, alpha);
    }
  }
}

// ── Icon design ───────────────────────────────────────────────────────────────
// Forest (#2F4A3C) rounded-corner background with a paper document card
// and three forest horizontal lines representing resume bullets.

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4, 0); // fully transparent

  const BG_R = 47, BG_G = 74, BG_B = 60; // #2F4A3C forest accent

  // Background
  const bgCr = Math.max(2, Math.round(size * 0.20));
  roundedRect(px, size, 0, 0, size - 1, size - 1, bgCr, BG_R, BG_G, BG_B);

  // White document card
  const dPad = Math.round(size * 0.17);
  const dX0  = dPad;
  const dX1  = size - dPad - 1;
  const dY0  = Math.round(size * 0.13);
  const dY1  = size - Math.round(size * 0.13) - 1;
  const dCr  = Math.max(1, Math.round(size * 0.07));
  roundedRect(px, size, dX0, dY0, dX1, dY1, dCr, 255, 255, 255);

  // Lines inside the card (only meaningful at ≥ 24 px)
  if (size >= 24) {
    const dW   = dX1 - dX0;
    const dH   = dY1 - dY0;
    const lX0  = dX0 + Math.round(dW * 0.15);
    const lX1  = dX0 + Math.round(dW * 0.85);
    const lXS  = dX0 + Math.round(dW * 0.60); // shorter last line
    const lH   = Math.max(1, Math.round(size * 0.055));
    const lineY = [
      dY0 + Math.round(dH * 0.28),
      dY0 + Math.round(dH * 0.52),
      dY0 + Math.round(dH * 0.72),
    ];

    for (let li = 0; li < lineY.length; li++) {
      const endX = li === 2 ? lXS : lX1;
      for (let ly = lineY[li]; ly < lineY[li] + lH; ly++) {
        for (let lx = lX0; lx <= endX; lx++) {
          blendPixel(px, size, lx, ly, BG_R, BG_G, BG_B, 200);
        }
      }
    }
  }

  return px;
}

// ── Generate ──────────────────────────────────────────────────────────────────

const iconsDir = path.join(__dirname, "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png    = makePNG(size, size, pixels);
  const out    = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`✓ icon${size}.png  (${png.length} bytes)`);
}
