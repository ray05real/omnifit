// Draws Omniload's app icon (assets/icon.png and friends) with nothing but Node: run `node scripts/make-icon.js`.
//
// The mark: an "O" that is also a weight plate seen face-on and a ring that fills up. Most of the ring is
// white; the last stretch, at the top right, is green: the load going up. Black, white and one green, like
// the app itself.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SS = 3; // each pixel is sampled 3 × 3 times, for smooth edges

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Is the point inside a ring segment (centre line radius R, thickness w, from angle a0 to a1, round ends)?
function inArc(x, y, cx, cy, R, w, a0, a1) {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  const half = w / 2;
  if (Math.abs(d - R) <= half) {
    let a = Math.atan2(dy, dx);
    while (a < a0) a += Math.PI * 2;
    if (a <= a1) return true;
  }
  for (const a of [a0, a1]) {
    if (Math.hypot(x - (cx + R * Math.cos(a)), y - (cy + R * Math.sin(a))) <= half) return true;
  }
  return false;
}

const deg = (v) => (v * Math.PI) / 180;

// One sample's colour. `u` is the size of the drawing (the icon is designed on a 1024 grid).
function sample(x, y, opts) {
  const c = 512;
  // The green stretch: from about 12:30 to 2:30 on a clock face.
  if (inArc(x, y, c, c, 290, 118, deg(-75), deg(-18))) return hexToRgb('#30D158');
  // The rest of the ring, white, with a small gap either side of the green.
  if (inArc(x, y, c, c, 290, 118, deg(9), deg(258))) return hexToRgb('#FFFFFF');
  // The plate's hub.
  if (Math.abs(Math.hypot(x - c, y - c) - 104) <= 15) return hexToRgb('#48484A');
  if (opts.transparent) return null;
  // Background: black, a touch lighter towards the top.
  const t = Math.max(0, Math.min(1, y / 1024));
  const v = Math.round(30 * (1 - t) * (1 - t));
  return [v, v, v + (v > 0 ? 2 : 0)];
}

function render(size, opts = {}) {
  const scale = 1024 / size; // design units per pixel
  const inset = opts.inset ?? 0; // shrink the mark towards the middle (for icons that get cropped)
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          let x = (i + (si + 0.5) / SS) * scale;
          let y = (j + (sj + 0.5) / SS) * scale;
          if (inset) {
            x = 512 + (x - 512) / (1 - inset);
            y = 512 + (y - 512) / (1 - inset);
          }
          const col = sample(x, y, opts);
          if (col) {
            r += col[0];
            g += col[1];
            b += col[2];
            a += 255;
          }
        }
      }
      const n = SS * SS;
      const o = (j * size + i) * 4;
      const cover = a / 255; // how many samples were painted
      px[o] = cover ? Math.round(r / cover) : 0;
      px[o + 1] = cover ? Math.round(g / cover) : 0;
      px[o + 2] = cover ? Math.round(b / cover) : 0;
      px[o + 3] = Math.round(a / n);
    }
  }
  return px;
}

// A minimal PNG writer (8-bit RGBA).
function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, px) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8; // bit depth
  head[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let j = 0; j < size; j++) px.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = process.argv[2] || path.join(__dirname, '..', 'assets');
const save = (name, size, opts) => {
  fs.writeFileSync(path.join(out, name), png(size, render(size, opts)));
  console.log('wrote', name, size + 'px');
};
save('icon.png', 1024); // the iPhone icon (the phone rounds the corners itself)
save('splash-icon.png', 1024, { transparent: true });
save('favicon.png', 48);
save('android-icon-foreground.png', 1024, { transparent: true, inset: 0.34 });
