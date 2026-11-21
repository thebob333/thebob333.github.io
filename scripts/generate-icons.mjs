// Generates TELOS app icons (PNG) with no dependencies: a cream target emblem
// on TELOS navy. Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const NAVY = [31, 61, 122];
const CREAM = [245, 242, 235];
const CORAL = [236, 124, 98];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3, o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = pixels[i]; raw[o + 1] = pixels[i + 1]; raw[o + 2] = pixels[i + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Emblem scale: 1 = fills ~64% of the icon; maskable icons use less to stay in the safe zone. */
function draw(size, scale = 1) {
  const px = new Uint8Array(size * size * 3);
  const c = size / 2, SS = 4;
  const ring = (d, r, w) => Math.abs(d - r) <= w / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let cream = 0, coral = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const dx = x + (sx + 0.5) / SS - c, dy = y + (sy + 0.5) / SS - c;
      const d = Math.hypot(dx, dy) / size / scale;
      if (d <= 0.07) coral++;
      else if (ring(d, 0.30, 0.05) || ring(d, 0.185, 0.05)) cream++;
    }
    const n = SS * SS, a = cream / n, b = coral / n, bg = 1 - a - b, i = (y * size + x) * 3;
    for (let k = 0; k < 3; k++) px[i + k] = Math.round(NAVY[k] * bg + CREAM[k] * a + CORAL[k] * b);
  }
  return png(size, px);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/pwa-192x192.png', draw(192));
writeFileSync('public/icons/pwa-512x512.png', draw(512));
writeFileSync('public/icons/maskable-512x512.png', draw(512, 0.8));
writeFileSync('public/icons/apple-touch-icon-180x180.png', draw(180));
writeFileSync('public/icons/favicon-32x32.png', draw(32));
console.log('icons written to public/icons');
