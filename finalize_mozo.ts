import { execSync } from 'child_process';
import fs from 'fs';
import { PNG } from 'pngjs';

const seeds = [];
// Top border
for (let x = 10; x < 1024; x += 30) seeds.push([x, 5]);
// Left border
for (let y = 10; y < 450; y += 30) seeds.push([5, y]);
// Right border
for (let y = 10; y < 450; y += 30) seeds.push([1015, y]);
// Top closer
for (let x = 100; x < 924; x += 60) seeds.push([x, 35]);

// Safe interior seeds (strictly in the air):
// Behind left arm (left arm is x >= 370):
seeds.push([330, 250]);
seeds.push([330, 300]);
seeds.push([330, 350]);

// Gap between chest and raised arm (chest <= 535, arm >= 570):
seeds.push([555, 220]);

// Gap between legs (rear leg <= 420, front leg >= 480):
seeds.push([445, 360]);
seeds.push([450, 400]);
seeds.push([455, 430]);

const draws = seeds.map(([x, y]) => `-draw "matte ${x},${y} floodfill"`).join(' ');
const cmd = `convert public/assets/aistudio/image_c140dd18.png -fuzz 8.5% -fill none ${draws} test_im_perfect_raw.png`;

console.log('Running safe ImageMagick floodfill with', seeds.length, 'seeds...');
execSync(cmd);

// Load original and raw mask
const orig = PNG.sync.read(fs.readFileSync('public/assets/aistudio/image_c140dd18.png'));
const raw = PNG.sync.read(fs.readFileSync('test_im_perfect_raw.png'));
const { width, height } = orig;

const alpha = new Uint8Array(width * height);
for (let i = 0; i < width * height; i++) {
  alpha[i] = raw.data[(i << 2) + 3];
}

// 1. Column bounds: runner is strictly within [305, 632]
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (x < 305 || x > 632) {
      alpha[y * width + x] = 0;
    }
  }
}

// 2. Remove cobblestones below y=460
for (let y = 460; y < height; y++) {
  for (let x = 305; x <= 632; x++) {
    const idx = y * width + x;
    const pIdx = idx << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];

    const inRearShoe = (x >= 308 && x <= 370 && y <= 528);
    const inFrontShoe = (x >= 475 && x <= 565 && y <= 498);

    if (inRearShoe) {
      if (y > 528) alpha[idx] = 0;
      else if (y > 522 && r < 110 && g < 100 && b < 90) alpha[idx] = 0;
    } else if (inFrontShoe) {
      if (y > 498) alpha[idx] = 0;
      else if (y > 492 && r < 110 && g < 100 && b < 90) alpha[idx] = 0;
    } else {
      alpha[idx] = 0;
    }
  }
}

// 3. Solidify white shirt (x: 420..535, y: 170..300)
for (let y = 170; y <= 300; y++) {
  for (let x = 420; x <= 535; x++) {
    alpha[y * width + x] = 255;
  }
}

// 4. Solidify white pants hips & thighs
for (let y = 300; y <= 380; y++) {
  for (let x = 420; x <= 530; x++) {
    // Air gap starts below y=340
    if (y >= 340) {
      const leftInner = 442 - (y - 335) * ((442 - 345) / (465 - 335));
      const rightInner = 442 + (y - 335) * ((495 - 442) / (465 - 335));
      if (x > leftInner && x < rightInner) continue;
    }
    alpha[y * width + x] = 255;
  }
}

// 5. Solidify rear leg (x: 320..425, y: 380..475)
for (let y = 380; y <= 475; y++) {
  // Rear leg center line runs from x=420 at y=380 down to x=340 at y=475
  const legCenterX = 420 - (y - 380) * ((420 - 340) / 95);
  for (let x = Math.round(legCenterX - 22); x <= Math.round(legCenterX + 22); x++) {
    if (x >= 0 && x < width) {
      const pIdx = (y * width + x) << 2;
      const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
      // Only white pants or red ribbon
      if ((r > 160 && g > 155 && b > 150) || (r > 115 && g < 75 && b < 75)) {
        alpha[y * width + x] = 255;
      }
    }
  }
}

// 6. Solidify front leg (x: 475..585, y: 380..475)
for (let y = 380; y <= 475; y++) {
  for (let x = 480; x <= 585; x++) {
    const pIdx = (y * width + x) << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
    if (r > 160 && g > 155 && b > 150) {
      alpha[y * width + x] = 255;
    }
  }
}

// 7. Solidify raised right arm and fist (x: 575..630, y: 90..250)
for (let y = 90; y <= 250; y++) {
  for (let x = 575; x <= 630; x++) {
    const pIdx = (y * width + x) << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
    if (r > 120 && r - g > 15 && r - b > 20) {
      alpha[y * width + x] = 255;
    }
  }
}

// 8. Solidify trailing left arm (x: 370..425, y: 250..395)
for (let y = 250; y <= 395; y++) {
  for (let x = 370; x <= 425; x++) {
    const pIdx = (y * width + x) << 2;
    const r = orig.data[pIdx], g = orig.data[pIdx+1], b = orig.data[pIdx+2];
    if (r > 120 && r - g > 15 && r - b > 20) {
      alpha[y * width + x] = 255;
    }
  }
}

// 9. Remove any orphan noise
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

// 10. Find runner bounds
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
fs.writeFileSync('src/assets/images/mozo_showcase.png', PNG.sync.write(outPng));
console.log('Saved perfect mozo_showcase.png:', cropW, 'x', cropH);
