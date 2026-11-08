import fs from 'fs';
import { PNG } from 'pngjs';

const orig = PNG.sync.read(fs.readFileSync('public/assets/aistudio/image_c140dd18.png'));
const raw = PNG.sync.read(fs.readFileSync('test_im_perfect_raw.png'));
const { width, height } = orig;

const alpha = new Uint8Array(width * height);
for (let i = 0; i < width * height; i++) {
  alpha[i] = raw.data[(i << 2) + 3];
}

// 1. Column clamp: strictly [305, 632]
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (x < 305 || x > 632) {
      alpha[y * width + x] = 0;
    }
  }
}

// 2. Clear wall shadow in chest-arm gap (x: 546..578, y: 165..215)
for (let y = 165; y <= 215; y++) {
  for (let x = 546; x <= 578; x++) {
    alpha[y * width + x] = 0;
  }
}

// 3. Clear cobblestones below y=460 outside shoes
for (let y = 460; y < height; y++) {
  for (let x = 305; x <= 632; x++) {
    const idx = y * width + x;
    const inRearShoe = (x >= 308 && x <= 370 && y <= 528);
    const inFrontShoe = (x >= 475 && x <= 565 && y <= 498);

    if (inRearShoe) {
      if (y > 528) alpha[idx] = 0;
    } else if (inFrontShoe) {
      if (y > 498) alpha[idx] = 0;
    } else {
      alpha[idx] = 0;
    }
  }
}

// 4. Fill interior holes in white shirt (x: 430..530, y: 220..310)
for (let y = 220; y <= 310; y++) {
  for (let x = 430; x <= 530; x++) {
    const idx = y * width + x;
    const pIdx = idx << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
    // White shirt fabric
    if (r > 150 && g > 145 && b > 140) {
      alpha[idx] = 255;
    }
  }
}

// 5. Fill interior holes in white pants
// Rear leg:
for (let y = 350; y <= 470; y++) {
  const legCenterX = 425 - (y - 350) * ((425 - 340) / 120);
  for (let x = Math.round(legCenterX - 24); x <= Math.round(legCenterX + 24); x++) {
    if (x >= 0 && x < width) {
      const idx = y * width + x;
      const pIdx = idx << 2;
      const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
      if ((r > 150 && g > 145 && b > 140) || (r > 115 && g < 75 && b < 75)) {
        alpha[idx] = 255;
      }
    }
  }
}

// Front leg:
for (let y = 350; y <= 470; y++) {
  for (let x = 480; x <= 585; x++) {
    const idx = y * width + x;
    const pIdx = idx << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
    if (r > 150 && g > 145 && b > 140) {
      alpha[idx] = 255;
    }
  }
}

// 6. Remove any remaining orphan specks (< 4 neighbors)
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const idx = y * width + x;
    if (alpha[idx] > 0) {
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const chkX = x + dx, chkY = y + dy;
          if (chkX >= 0 && chkX < width && chkY >= 0 && chkY < height) {
            if (alpha[chkY * width + chkX] > 0) n++;
          }
        }
      }
      if (n <= 5) alpha[idx] = 0;
    }
  }
}

// Find bounds:
let minX = width, maxX = 0, minY = height, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (alpha[y * width + x] > 0) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

console.log('Runner bounds:', { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 });

const pad = 3;
const cropX = Math.max(0, minX - pad);
const cropY = Math.max(0, minY - pad);
const cropW = Math.min(width - cropX, maxX - minX + 1 + pad * 2);
const cropH = Math.min(height - cropY, maxY - minY + 1 + pad * 2);

const outPng = new PNG({ width: cropW, height: cropH });
for (let cy = 0; cy < cropH; cy++) {
  for (let cx = 0; cx < cropW; cx++) {
    const sx = cropX + cx;
    const sy = cropY + cy;
    const sIdx = (sy * width + sx) << 2;
    const dIdx = (cy * cropW + cx) << 2;

    const a = alpha[sy * width + sx];
    outPng.data[dIdx] = orig.data[sIdx];
    outPng.data[dIdx + 1] = orig.data[sIdx + 1];
    outPng.data[dIdx + 2] = orig.data[sIdx + 2];

    if (a > 0) {
      let edgeCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const chkX = sx + dx, chkY = sy + dy;
          if (chkX >= 0 && chkX < width && chkY >= 0 && chkY < height) {
            if (alpha[chkY * width + chkX] > 0) edgeCount++;
          }
        }
      }
      outPng.data[dIdx + 3] = edgeCount <= 6 ? Math.round((edgeCount / 8) * 230) : 255;
    } else {
      outPng.data[dIdx + 3] = 0;
    }
  }
}

fs.writeFileSync('src/assets/images/mozo_photo_master.png', PNG.sync.write(outPng));
fs.writeFileSync('src/assets/images/mozo_flawless.png', PNG.sync.write(outPng));
console.log('Saved src/assets/images/mozo_flawless.png:', cropW, 'x', cropH);
