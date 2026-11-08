const fs = require('fs');
const jpeg = require('jpeg-js');

const raw = fs.readFileSync('src/assets/images/tramo3_mercaderes_flat_1792744136947.jpg');
const img = jpeg.decode(raw);
const w = img.width;
const h = img.height;
const data = img.data; // RGBA Uint8Array

function getPixel(x, y) {
  x = Math.max(0, Math.min(w - 1, Math.round(x)));
  y = Math.max(0, Math.min(h - 1, Math.round(y)));
  const idx = (y * w + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

function setPixel(x, y, r, g, b, a = 255) {
  x = Math.max(0, Math.min(w - 1, Math.round(x)));
  y = Math.max(0, Math.min(h - 1, Math.round(y)));
  const idx = (y * w + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = a;
}

// 1. CLEAN LEFT PEDESTRIANS (x: 5 to 148, y: 532 to 690)
// For y from 532 to 690, the clean architectural section is at x: 155 to 280 (or repeating texture).
// Notice Farmacia Ruiz:
// The display window bottom is at y ~ 555.
// The wooden base is at y: 555 to 615.
// The stone plinth is at y: 615 to 655.
// The pavement curb is at y: 655 to 685.
// Cobblestone is at y > 685.

console.log('Patching left side...');
for (let y = 530; y < 695; y++) {
  for (let x = 0; x <= 145; x++) {
    // Determine source X to sample clean storefront
    // The clean section of Farmacia Ruiz plinth is around x: 160 to 260
    const srcX = 160 + (x % 90);
    const [r, g, b] = getPixel(srcX, y);

    // Feather edges near x = 145
    let blend = 1;
    if (x > 130) {
      blend = (145 - x) / 15;
    }
    const [origR, origG, origB] = getPixel(x, y);
    const finalR = Math.round(r * blend + origR * (1 - blend));
    const finalG = Math.round(g * blend + origG * (1 - blend));
    const finalB = Math.round(b * blend + origB * (1 - blend));
    setPixel(x, y, finalR, finalG, finalB);
  }
}

// 2. CLEAN RIGHT PEDESTRIANS (x: 1210 to 1350, y: 520 to 695)
console.log('Patching right side...');
for (let y = 520; y < 695; y++) {
  for (let x = 1205; x < w; x++) {
    // The clean section of Alpargateria Luna plinth is around x: 1090 to 1190
    const srcX = 1090 + ((x - 1205) % 95);
    const [r, g, b] = getPixel(srcX, y);

    let blend = 1;
    if (x < 1220) {
      blend = (x - 1205) / 15;
    }
    const [origR, origG, origB] = getPixel(x, y);
    const finalR = Math.round(r * blend + origR * (1 - blend));
    const finalG = Math.round(g * blend + origG * (1 - blend));
    const finalB = Math.round(b * blend + origB * (1 - blend));
    setPixel(x, y, finalR, finalG, finalB);
  }
}

// Encode to new JPEG with maximum quality (96)
const cleanJpeg = jpeg.encode({ data, width: w, height: h }, 96);
fs.writeFileSync('src/assets/images/tramo3_mercaderes_pristine.jpg', cleanJpeg.data);
console.log('Successfully written src/assets/images/tramo3_mercaderes_pristine.jpg');
