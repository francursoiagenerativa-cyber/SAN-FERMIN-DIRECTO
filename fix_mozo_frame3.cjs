const fs = require('fs');
const { PNG } = require('pngjs');

const file = 'src/assets/images/mozo_frames/mozo_run_3.png';
const buf = fs.readFileSync(file);
const src = PNG.sync.read(buf);

const w = src.width;
const h = src.height;
const dst = new PNG({ width: w, height: h });

// Clear dst with transparent pixels
dst.data.fill(0);

const shiftY = 68;

for (let y = 0; y < h; y++) {
  const newY = y + shiftY;
  if (newY >= h) continue;

  for (let x = 0; x < w; x++) {
    const srcIdx = (y * w + x) * 4;
    const dstIdx = (newY * w + x) * 4;

    const a = src.data[srcIdx + 3];
    if (a > 0) {
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = a;
    }
  }
}

// Feather / soften the top 4 rows (y = shiftY + 1 to shiftY + 4) for a smooth rounded hair crown
for (let y = shiftY; y < shiftY + 5; y++) {
  const factor = (y - shiftY + 1) / 5;
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    if (dst.data[idx + 3] > 0) {
      dst.data[idx + 3] = Math.round(dst.data[idx + 3] * factor);
    }
  }
}

const outBuf = PNG.sync.write(dst);
fs.writeFileSync(file, outBuf);
console.log('SUCCESS: mozo_run_3.png fixed and saved.');
