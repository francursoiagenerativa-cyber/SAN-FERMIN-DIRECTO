import fs from 'fs';
import { PNG } from 'pngjs';

const buf = fs.readFileSync('public/assets/aistudio/image_c140dd18.png');
const src = PNG.sync.read(buf);
const { width, height, data } = src;

// Create an exact alpha mask (0 = transparent, 255 = opaque)
const alpha = new Uint8Array(width * height);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) << 2;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Quick rejection: outside overall bounding box
    if (x < 310 || x > 632 || y < 33 || y > 530) {
      continue;
    }

    // Cobblestone ground cutoffs:
    // Below rear shoe sole:
    if (x >= 310 && x <= 370 && y > 528) continue;
    // Between rear shoe and front shoe:
    if (x > 370 && x < 478 && y >= 468) continue;
    // Below front shoe sole:
    if (x >= 478 && x <= 565 && y > 498) continue;
    // Right of front shoe below y=430:
    if (x > 565 && y >= 430) continue;
    // Left of rear heel below y=460:
    if (x < 315 && y >= 460) continue;

    // Head / hair bounds (y: 33..140):
    if (y < 90) {
      // Hair top/back/front:
      if (x < 475 || x > 548) continue;
    } else if (y < 140) {
      // Face / neck / hair:
      // Also raised hand starts at x: 585..630, y: 90..140
      const isHead = (x >= 470 && x <= 552);
      const isRaisedFist = (x >= 585 && x <= 630 && y >= 90);
      if (!isHead && !isRaisedFist) continue;
    }

    // Arm-chest air gap (y: 140..250):
    // Raised forearm is at x: 570..630.
    // Chest is at x: 440..535.
    // Gap is between ~535 and 570:
    if (y >= 140 && y <= 255) {
      // Right edge of chest ~ 535 + (y - 140) * 0.15
      // Left edge of forearm ~ 575 - (y - 140) * 0.12
      const chestRight = 534 + (y - 140) * 0.12;
      const armLeft = 572 - (y - 140) * 0.08;
      if (x > chestRight && x < armLeft) {
        // In the gap between chest and arm!
        // Check if color is the wall:
        const isWall = (r >= 140 && r <= 195 && g >= 135 && g <= 190 && b >= 125 && b <= 180 &&
                        Math.abs(r - g) <= 10 && Math.abs(g - b) <= 18);
        if (isWall) continue;
      }
      if (x > 628) continue; // right of arm
    }

    // Upper back wall (left of torso, y: 90..250):
    // Torso back starts at:
    // y=90: x=478
    // y=160: x=420
    // y=250: x=395
    if (y >= 90 && y < 250) {
      let backX = 478;
      if (y < 160) {
        backX = 478 - (y - 90) * (58 / 70);
      } else {
        backX = 420 - (y - 160) * (25 / 90);
      }
      if (x < backX - 3) continue;
    }

    // Left trailing arm & hand (y: 250..395):
    // Trailing arm is at x: 370..425.
    // Back above faja is at x: 410..450.
    if (y >= 250 && y < 395) {
      // Left of trailing hand:
      if (x < 368) continue;
    }

    // Triangular air gap between legs (y: 335..470):
    // Groin apex is at x=442, y=335.
    // Left leg inner edge goes from (442, 335) to (345, 470)
    // Right leg inner edge goes from (442, 335) to (495, 465)
    if (y >= 335 && y <= 470) {
      const leftInnerEdge = 442 - (y - 335) * ((442 - 345) / (470 - 335));
      const rightInnerEdge = 442 + (y - 335) * ((495 - 442) / (465 - 335));
      if (x > leftInnerEdge && x < rightInnerEdge) {
        // Inside triangle between legs:
        // Check for red faja ribbon hanging down in the triangle!
        // Notice faja ribbon hangs down near x: 460..485, y: 340..420
        const isFajaRibbon = (r > 110 && g < 70 && b < 70 && r - g > 45);
        if (!isFajaRibbon) {
          continue; // It's background air!
        }
      }
    }

    // Left of rear leg below y=390 (y: 390..470):
    // Rear leg outer edge runs from x=415 at y=390 down to x=325 at y=470
    if (y >= 390 && y < 470) {
      const legOuterEdge = 415 - (y - 390) * ((415 - 325) / (470 - 390));
      if (x < legOuterEdge - 2) continue;
    }

    // Right of front leg / knee (y: 250..430):
    // Front edge runs from x=575 at y=250 down to x=585 at y=390 (knee), then down to x=540 at y=450
    if (y >= 250 && y < 430) {
      let frontEdge = 575;
      if (y <= 390) {
        frontEdge = 575 + (y - 250) * (10 / 140);
      } else {
        frontEdge = 585 - (y - 390) * (45 / 40);
      }
      if (x > frontEdge + 2) continue;
    }

    // If it passed all silhouette boundaries, it is the runner!
    alpha[y * width + x] = 255;
  }
}

// Find actual runner bounding box:
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

// Soft feathering (1-2 px gaussian/box blur on alpha channel)
const smoothAlpha = new Uint8Array(width * height);
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const idx = y * width + x;
    if (alpha[idx] === 255) {
      // Check if near edge
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += alpha[(y + dy) * width + (x + dx)];
        }
      }
      smoothAlpha[idx] = Math.round(sum / 9);
    } else {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += alpha[(y + dy) * width + (x + dx)];
        }
      }
      if (sum > 0) {
        smoothAlpha[idx] = Math.round(sum / 12);
      }
    }
  }
}

const pad = 4;
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

    const a = smoothAlpha[sy * width + sx];
    outPng.data[dIdx] = data[sIdx];
    outPng.data[dIdx + 1] = data[sIdx + 1];
    outPng.data[dIdx + 2] = data[sIdx + 2];
    outPng.data[dIdx + 3] = a;
  }
}

fs.writeFileSync('src/assets/images/mozo_photo_master.png', PNG.sync.write(outPng));
console.log('Saved perfect mozo_photo_master.png:', cropW, 'x', cropH);
