import fs from 'fs';
import { PNG } from 'pngjs';

const buf = fs.readFileSync('public/assets/aistudio/image_c140dd18.png');
const src = PNG.sync.read(buf);
const { width, height, data } = src;

// Start with our solid envelope mask from extract_runner
// Runner overall envelope:
// X: 310 to 630
// Y: 33 to 530

const isSolid = new Uint8Array(width * height);

for (let y = 33; y <= 530; y++) {
  for (let x = 310; x <= 630; x++) {
    // Spatial ground cutoffs:
    if (x >= 310 && x <= 370 && y > 528) continue;
    if (x > 370 && x < 478 && y >= 468) continue;
    if (x >= 478 && x <= 565 && y > 498) continue;
    if (x > 565 && y >= 430) continue;
    if (x < 315 && y >= 460) continue;

    // Head / hair bounds (y: 33..140):
    if (y < 90) {
      if (x < 472 || x > 552) continue;
    } else if (y < 140) {
      const isHead = (x >= 468 && x <= 556);
      const isRaisedFist = (x >= 580 && x <= 630 && y >= 90);
      if (!isHead && !isRaisedFist) continue;
    }

    // Trailing left arm:
    if (y >= 250 && y < 395 && x < 365) continue;
    if (y < 250 && y >= 90) {
      let backX = 478;
      if (y < 160) backX = 478 - (y - 90) * (58 / 70);
      else backX = 420 - (y - 160) * (25 / 90);
      if (x < backX - 5) continue;
    }

    // Triangular air gap between legs:
    if (y >= 335 && y <= 470) {
      const leftInnerEdge = 442 - (y - 335) * ((442 - 345) / (470 - 335));
      const rightInnerEdge = 442 + (y - 335) * ((495 - 442) / (465 - 335));
      if (x > leftInnerEdge && x < rightInnerEdge) {
        const pIdx = (y * width + x) << 2;
        const r = data[pIdx], g = data[pIdx+1], b = data[pIdx+2];
        const isFajaRibbon = (r > 110 && g < 70 && b < 70 && r - g > 45);
        if (!isFajaRibbon) continue;
      }
    }

    // Left of rear leg:
    if (y >= 390 && y < 470) {
      const legOuterEdge = 415 - (y - 390) * ((415 - 325) / (470 - 390));
      if (x < legOuterEdge - 5) continue;
    }

    // Right of front leg:
    if (y >= 250 && y < 430) {
      let frontEdge = 575;
      if (y <= 390) frontEdge = 575 + (y - 250) * (10 / 140);
      else frontEdge = 585 - (y - 390) * (45 / 40);
      if (x > frontEdge + 5) continue;
    }

    isSolid[y * width + x] = 1;
  }
}

// Function to check if a pixel is definitely background wall
function isBackgroundWallPixel(x: number, y: number): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height) return true;
  const pIdx = (y * width + x) << 2;
  const r = data[pIdx], g = data[pIdx+1], b = data[pIdx+2];

  // If in cobblestones region (y > 470):
  if (y > 470) {
    // Dark cobblestones
    if (r < 140 && g < 135 && b < 125) return true;
    // Cobblestone pavement outside shoes
    if (!(x >= 310 && x <= 368 && y <= 528) && !(x >= 478 && x <= 565 && y <= 498)) {
      return true;
    }
  }

  // Check if it's the smooth wall:
  // Studio wall has low saturation: |r-g| <= 8 and |g-b| <= 15
  // And brightness between 110 and 195
  const isNeutralTone = Math.abs(r - g) <= 8 && Math.abs(g - b) <= 15;
  const isWallBrightness = r >= 110 && r <= 195;

  if (isNeutralTone && isWallBrightness) {
    // Make sure it's not skin
    const isSkin = (r - g > 18 && r - b > 25);
    // Make sure it's not red ribbon
    const isRed = (r > 120 && g < 75 && b < 75);
    // Make sure it's not dark hair
    const isHair = (r < 80 && g < 75 && b < 70 && y < 160 && x > 465 && x < 555);
    // Make sure it's not white linen (white linen has high brightness r>198 or blue-tinted shadows)
    const isWhiteLinen = (r > 200 && g > 195 && b > 190) || (b > g && r > 160);

    if (!isSkin && !isRed && !isHair && !isWhiteLinen) {
      return true;
    }
  }

  return false;
}

// Inward contraction:
// Find boundary pixels of isSolid that are actually background wall, and strip them away
let changed = true;
let iterations = 0;
while (changed && iterations < 35) {
  changed = false;
  iterations++;
  const toRemove: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (isSolid[idx]) {
        // Is this on the boundary of isSolid?
        const isBoundary = (!isSolid[idx - 1] || !isSolid[idx + 1] ||
                            !isSolid[idx - width] || !isSolid[idx + width]);
        if (isBoundary) {
          if (isBackgroundWallPixel(x, y)) {
            toRemove.push(idx);
          }
        }
      }
    }
  }

  if (toRemove.length > 0) {
    changed = true;
    for (const idx of toRemove) {
      isSolid[idx] = 0;
    }
  }
}

console.log('Contracted in', iterations, 'iterations');

// Find runner bounding box
let minX = width, maxX = 0, minY = height, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (isSolid[y * width + x]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

console.log('Final runner bounds:', { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 });

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

    if (isSolid[sy * width + sx]) {
      // Check if on edge for 1px antialiased edge
      let edgeCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (isSolid[(sy + dy) * width + (sx + dx)]) edgeCount++;
        }
      }
      outPng.data[dIdx] = data[sIdx];
      outPng.data[dIdx + 1] = data[sIdx + 1];
      outPng.data[dIdx + 2] = data[sIdx + 2];
      outPng.data[dIdx + 3] = edgeCount <= 6 ? Math.round((edgeCount / 8) * 230) : 255;
    } else {
      outPng.data[dIdx] = 0;
      outPng.data[dIdx + 1] = 0;
      outPng.data[dIdx + 2] = 0;
      outPng.data[dIdx + 3] = 0;
    }
  }
}

fs.writeFileSync('src/assets/images/mozo_photo_master_clean.png', PNG.sync.write(outPng));
// Also update mozo_photo_master.png
fs.writeFileSync('src/assets/images/mozo_photo_master.png', PNG.sync.write(outPng));
console.log('Saved src/assets/images/mozo_photo_master_clean.png:', cropW, 'x', cropH);
