import fs from 'fs';
import { PNG } from 'pngjs';

const buf = fs.readFileSync('public/assets/aistudio/image_c140dd18.png');
const src = PNG.sync.read(buf);
const { width, height, data } = src;

function isRunner(x: number, y: number): boolean {
  if (x < 308 || x > 631 || y < 34 || y > 530) return false;

  const idx = (y * width + x) << 2;
  const r = data[idx], g = data[idx+1], b = data[idx+2];
  const bright = (r + g + b) / 3;

  // 1. Lower feet & shoes (y >= 440)
  if (y >= 440) {
    // Exact rear leg & shoe column envelope:
    let minRearX = 353, maxRearX = 390;
    if (y < 460) {
      minRearX = 353 - (y - 440) * 0.70;
      maxRearX = 390;
    } else if (y < 480) {
      minRearX = 339 - (y - 460) * 1.05;
      maxRearX = 387 - (y - 460) * 0.95;
    } else if (y <= 528) {
      minRearX = 318 + (y - 480) * 0.55;
      maxRearX = 368;
    }
    const inRear = (x >= minRearX - 1 && x <= maxRearX + 1 && y <= 528);

    // Front leg & shoe envelope:
    const inFront = (x >= 478 && x <= 565 && y <= 500);

    if (!inRear && !inFront) return false;

    // Check sole cutoffs:
    if (inFront) {
      if (x > 528 && y < 472) return false; // air in front of shin
      if (x < 505 && y < 475) return false; // air behind front heel
      const soleY = 484 + (x - 478) * ((496 - 484) / 87);
      if (y > soleY) return false;
      const isShoeWhite = (bright > 135);
      const isShoeRedLace = (r > 115 && g < 75 && b < 75);
      const isRopeSole = (y >= 482 && r > 105 && g > 90 && b > 70);
      if (isShoeWhite || isShoeRedLace || isRopeSole) return true;
      return false;
    }

    if (inRear) {
      if (x > 340 && y < 502) return false; // air in front of rear ankle
      const soleY = 476 + (x - 312) * ((524 - 476) / 56);
      if (y > soleY) return false;
      const isShoeWhite = (bright > 135);
      const isShoeRedLace = (r > 115 && g < 75 && b < 75);
      const isRopeSole = (y >= 500 && r > 105 && g > 90 && b > 70);
      if (isShoeWhite || isShoeRedLace || isRopeSole) return true;
      return false;
    }

    return false;
  }

  // 2. Head & raised fist (y < 135)
  if (y < 135) {
    const isRaisedFist = (x >= 580 && x <= 630 && y >= 85);
    const inHead = (x >= 468 && x <= 562);
    if (!isRaisedFist && !inHead) return false;
  }

  // 3. Neck & shoulder (y: 135..170)
  if (y >= 135 && y < 170) {
    if (x < 380) return false; // left of white shoulder sleeve
    // gap between chin and raised arm
    if (x > 552 && x < 580) return false;
    if (x > 630) return false;
  }

  // 4. Chest-arm air gap (y: 170..245)
  if (y >= 170 && y <= 245) {
    if (x >= 540 && x <= 576) {
      if (b <= g + 1 && bright <= 192) return false;
    }
  }

  // 5. Left trailing arm / back boundary (y: 170..395)
  if (y >= 170 && y < 250 && x < 380) return false;
  if (y >= 250 && y < 395 && x < 368) return false;

  // 6. Distinct runner features:
  const isRed = (r > 120 && g < 75 && b < 75 && r - g > 45); // pañuelo & faja
  const isSkin = (r - g > 18 && r - b > 25); // face, neck, arms, hands
  const isHair = (bright < 85 && y < 160 && x > 465 && x < 555); // hair
  const isWhiteLinen = (bright > 185 || (b >= g && bright > 135)); // white linen

  if (isRed || isSkin || isHair || isWhiteLinen) return true;

  // 7. Leg triangle air gap check for y >= 405
  if (y >= 405 && y < 440) {
    if (x > 385 && x < 515) {
      if (b < g && bright <= 188) return false;
    }
  }

  // Studio wall test (neutral warm grey tone)
  if (b < g && bright <= 188) return false;

  return true;
}

const mask = new Uint8Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (isRunner(x, y)) mask[y * width + x] = 1;
  }
}

// Morphological hole fill (single-pixel gaps)
for (let y = 2; y < height - 2; y++) {
  for (let x = 2; x < width - 2; x++) {
    const idx = y * width + x;
    if (!mask[idx]) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (mask[(y + dy) * width + (x + dx)]) n++;
        }
      }
      if (n >= 7) mask[idx] = 1;
    }
  }
}

// Find bounds
let minX = width, maxX = 0, minY = height, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (mask[y * width + x]) {
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

const out = new PNG({ width: cropW, height: cropH });
for (let cy = 0; cy < cropH; cy++) {
  for (let cx = 0; cx < cropW; cx++) {
    const sx = cropX + cx;
    const sy = cropY + cy;
    const sIdx = (sy * width + sx) << 2;
    const dIdx = (cy * cropW + cx) << 2;

    if (mask[sy * width + sx]) {
      let edgeCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const chkX = sx + dx, chkY = sy + dy;
          if (chkX >= 0 && chkX < width && chkY >= 0 && chkY < height) {
            if (mask[chkY * width + chkX]) edgeCount++;
          }
        }
      }
      out.data[dIdx] = data[sIdx];
      out.data[dIdx+1] = data[sIdx+1];
      out.data[dIdx+2] = data[sIdx+2];
      out.data[dIdx+3] = edgeCount <= 6 ? Math.round((edgeCount / 8) * 230) : 255;
    } else {
      out.data[dIdx+3] = 0;
    }
  }
}

fs.writeFileSync('src/assets/images/mozo_photo_master.png', PNG.sync.write(out));
fs.writeFileSync('src/assets/images/mozo_pristine_final.png', PNG.sync.write(out));
console.log('Saved src/assets/images/mozo_pristine_final.png:', cropW, 'x', cropH);
