const fs = require('fs');
const jpeg = require('jpeg-js');

const raw = fs.readFileSync('src/assets/images/tramo2_ayuntamiento_clean_1793697152425.jpg');
const img = jpeg.decode(raw);
const w = img.width; // 1376
const h = img.height; // 768
const data = img.data;

// Crop window:
// sy: 45 (just above the clock tower cross)
// ey: 665 (base of the doors)
// cropHeight = 620
// cropWidth for 16:9 = 620 * (16/9) = 1102
const cropHeight = 620;
const cropWidth = Math.round(cropHeight * (16 / 9)); // 1102
const cropY = 45;
const cropX = Math.round((w - cropWidth) / 2); // 137

console.log(`Cropping from (${cropX}, ${cropY}) with size ${cropWidth}x${cropHeight}`);

// Target output dimensions (standard 1376 x 768)
const outW = 1376;
const outH = 768;
const outData = new Uint8Array(outW * outH * 4);

for (let y = 0; y < outH; y++) {
  const srcY = cropY + (y / outH) * cropHeight;
  for (let x = 0; x < outW; x++) {
    const srcX = cropX + (x / outW) * cropWidth;
    
    // Bilinear interpolation
    const x0 = Math.floor(srcX);
    const x1 = Math.min(w - 1, x0 + 1);
    const y0 = Math.floor(srcY);
    const y1 = Math.min(h - 1, y0 + 1);
    const fx = srcX - x0;
    const fy = srcY - y0;

    const idx00 = (y0 * w + x0) * 4;
    const idx10 = (y0 * w + x1) * 4;
    const idx01 = (y1 * w + x0) * 4;
    const idx11 = (y1 * w + x1) * 4;

    const outIdx = (y * outW + x) * 4;
    for (let c = 0; c < 4; c++) {
      const top = data[idx00 + c] * (1 - fx) + data[idx10 + c] * fx;
      const bot = data[idx01 + c] * (1 - fx) + data[idx11 + c] * fx;
      outData[outIdx + c] = Math.round(top * (1 - fy) + bot * fy);
    }
  }
}

const outJpeg = jpeg.encode({ data: outData, width: outW, height: outH }, 96);
fs.writeFileSync('src/assets/images/tramo2_ayuntamiento_monumental.jpg', outJpeg.data);
console.log('SUCCESS: Written src/assets/images/tramo2_ayuntamiento_monumental.jpg');
