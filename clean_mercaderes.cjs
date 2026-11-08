const fs = require('fs');
const jpeg = require('jpeg-js');

const raw = fs.readFileSync('src/assets/images/tramo3_mercaderes_flat_1792744136947.jpg');
const img = jpeg.decode(raw);
const w = img.width;
const h = img.height;
const data = img.data;

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

// 1. CLEAN LEFT PEDESTRIANS (x: 0 to 142, y: 532 to 690)
// Sample the exact corresponding vertical zone from clean Farmacia Ruiz base (x: 165 to 260)
for (let y = 530; y < 768; y++) {
  for (let x = 0; x <= 145; x++) {
    let srcX = 165 + (x % 90);
    const [r, g, b] = getPixel(srcX, y);

    let blend = 1;
    if (x > 125) {
      blend = (145 - x) / 20;
    }
    const [origR, origG, origB] = getPixel(x, y);
    const finalR = Math.round(r * blend + origR * (1 - blend));
    const finalG = Math.round(g * blend + origG * (1 - blend));
    const finalB = Math.round(b * blend + origB * (1 - blend));
    setPixel(x, y, finalR, finalG, finalB);
  }
}

// 2. CLEAN RIGHT PEDESTRIANS (x: 1210 to 1375, y: 520 to 768)
// On the right:
// y: 520 to 655: Stone ashlar blocks of Alpargateria building. Sample from clean stone blocks above/adjacent (e.g. x: 1350-1375 or x: 1140-1175)
// y: 655 to 685: Stone sidewalk curb. Sample from x: 1050 to 1180
// y: 685 to 768: Cobblestone pavement. Sample from clean cobblestones at x: 1050 to 1180
for (let y = 520; y < 768; y++) {
  for (let x = 1205; x < w; x++) {
    let srcX, srcY = y;
    if (y < 650) {
      // Stone wall blocks
      srcX = 1355 + ((x - 1205) % 18);
      // Sample stone texture
      srcY = 530 + ((y - 520) % 110);
    } else {
      // Pavement and cobblestones
      srcX = 1060 + ((x - 1205) % 110);
    }

    const [r, g, b] = getPixel(srcX, srcY);

    let blend = 1;
    if (x < 1222) {
      blend = (x - 1205) / 17;
    }
    const [origR, origG, origB] = getPixel(x, y);
    const finalR = Math.round(r * blend + origR * (1 - blend));
    const finalG = Math.round(g * blend + origG * (1 - blend));
    const finalB = Math.round(b * blend + origB * (1 - blend));
    setPixel(x, y, finalR, finalG, finalB);
  }
}

const cleanJpeg = jpeg.encode({ data, width: w, height: h }, 96);
fs.writeFileSync('src/assets/images/tramo3_mercaderes_pristine.jpg', cleanJpeg.data);
console.log('SUCCESS: Written src/assets/images/tramo3_mercaderes_pristine.jpg');
