import { execSync } from 'child_process';
import fs from 'fs';
import { PNG } from 'pngjs';

const seeds = [];
for (let x = 10; x < 1024; x += 30) seeds.push([x, 5]);
for (let y = 10; y < 450; y += 30) seeds.push([5, y]);
for (let y = 10; y < 450; y += 30) seeds.push([1015, y]);
for (let x = 100; x < 924; x += 60) seeds.push([x, 35]);

seeds.push([330, 250]);
seeds.push([330, 300]);
seeds.push([330, 350]);
seeds.push([570, 145]);
seeds.push([575, 155]);
seeds.push([565, 195]);
seeds.push([460, 390]);
seeds.push([470, 420]);

const draws = seeds.map(([x, y]) => `-draw "matte ${x},${y} floodfill"`).join(' ');
const cmd = `convert public/assets/aistudio/image_c140dd18.png -fuzz 8.5% -fill none ${draws} test_im_topo_raw.png`;

console.log('Running ImageMagick floodfill with', seeds.length, 'seeds...');
execSync(cmd);

const orig = PNG.sync.read(fs.readFileSync('public/assets/aistudio/image_c140dd18.png'));
const raw = PNG.sync.read(fs.readFileSync('test_im_topo_raw.png'));
const { width, height } = orig;

const alpha = new Uint8Array(width * height);
for (let i = 0; i < width * height; i++) {
  alpha[i] = raw.data[(i << 2) + 3];
}

// 1. Column clamp [308, 631]
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (x < 308 || x > 631) {
      alpha[y * width + x] = 0;
    }
  }
}

// 2. Remove cobblestone pavement at bottom (y >= 460)
for (let y = 460; y < height; y++) {
  for (let x = 308; x <= 631; x++) {
    const idx = y * width + x;
    const inRearShoe = (x >= 308 && x <= 370 && y <= 523);
    const inFrontShoe = (x >= 475 && x <= 565 && y <= 494);

    if (inRearShoe) {
      if (y > 523) alpha[idx] = 0;
    } else if (inFrontShoe) {
      if (y > 494) alpha[idx] = 0;
    } else {
      alpha[idx] = 0;
    }
  }
}

// 3. Solidify white shirt (x: 420..540, y: 170..305)
for (let y = 170; y <= 305; y++) {
  for (let x = 420; x <= 540; x++) {
    const idx = y * width + x;
    const pIdx = idx << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
    if (r > 140 && g > 135 && b > 130) {
      alpha[idx] = 255;
    }
  }
}

// 4. Solidify white pants & faja
for (let y = 305; y <= 470; y++) {
  for (let x = 320; x <= 585; x++) {
    const idx = y * width + x;
    const pIdx = idx << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];

    // Check if in leg gap:
    if (y >= 335 && y <= 465) {
      const leftInner = 442 - (y - 335) * ((442 - 345) / (465 - 335));
      const rightInner = 442 + (y - 335) * ((495 - 442) / (465 - 335));
      if (x > leftInner && x < rightInner) {
        // Red faja ribbons hanging in gap
        if (r > 115 && g < 75 && b < 75) alpha[idx] = 255;
        continue;
      }
    }

    // Rear leg or front leg or groin
    const inRearLeg = (x >= 320 && x <= 425 && y >= 350);
    const inFrontLeg = (x >= 475 && x <= 585 && y >= 350);
    const inGroin = (x >= 415 && x <= 535 && y < 350);

    if (inRearLeg || inFrontLeg || inGroin) {
      if ((r > 140 && g > 135 && b > 130) || (r > 115 && g < 75 && b < 75)) {
        alpha[idx] = 255;
      }
    }
  }
}

// 5. Remove any orphan noise dots (< 4 neighbors)
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

// Find bounds
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

console.log('Flawless runner bounds:', { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 });

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
fs.writeFileSync('src/assets/images/mozo_perfection.png', PNG.sync.write(outPng));
console.log('Saved src/assets/images/mozo_perfection.png:', cropW, 'x', cropH);
