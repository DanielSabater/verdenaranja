const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Generador de ICO nativo de Windows con DIB (Device Independent Bitmap) de 32 bits no comprimido
function createWindowsIco(images) {
  // images: Array<{ size: number, bgra: Buffer }>
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let currentOffset = headerSize + (count * dirEntrySize);

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const entries = [];
  const imageBuffers = [];

  for (const img of images) {
    const { size, bgra } = img;
    const w = size >= 256 ? 0 : size;
    const h = size >= 256 ? 0 : size;

    // BITMAPINFOHEADER (40 bytes)
    const bihSize = 40;
    const bih = Buffer.alloc(bihSize);
    bih.writeUInt32LE(40, 0); // biSize
    bih.writeInt32LE(size, 4); // biWidth
    bih.writeInt32LE(size * 2, 8); // biHeight (doble altura en ICO para XOR + AND masks)
    bih.writeUInt16LE(1, 12); // biPlanes
    bih.writeUInt16LE(32, 14); // biBitCount (32 bpp BGRA)
    bih.writeUInt32LE(0, 16); // biCompression (BI_RGB = 0)
    bih.writeUInt32LE(bgra.length, 20); // biSizeImage
    bih.writeInt32LE(0, 24); // biXPelsPerMeter
    bih.writeInt32LE(0, 28); // biYPelsPerMeter
    bih.writeUInt32LE(0, 32); // biClrUsed
    bih.writeUInt32LE(0, 36); // biClrImportant

    // AND mask (1 bit per pixel, rows aligned to 32-bit boundary)
    const rowBytes = Math.ceil(size / 32) * 4;
    const andMask = Buffer.alloc(rowBytes * size, 0); // todos 0 = opaco o definido por canal alfa

    // En DIB las filas van de abajo hacia arriba (bottom-up)
    const flippedBgra = Buffer.alloc(bgra.length);
    const stride = size * 4;
    for (let y = 0; y < size; y++) {
      const srcY = y;
      const dstY = size - 1 - y;
      bgra.copy(flippedBgra, dstY * stride, srcY * stride, (srcY + 1) * stride);
    }

    const fullImageData = Buffer.concat([bih, flippedBgra, andMask]);

    // Directory Entry
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(w, 0); // Width
    entry.writeUInt8(h, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(fullImageData.length, 8); // Size
    entry.writeUInt32LE(currentOffset, 12); // Offset in file

    entries.push(entry);
    imageBuffers.push(fullImageData);
    currentOffset += fullImageData.length;
  }

  return Buffer.concat([header, ...entries, ...imageBuffers]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logoFile = path.resolve(__dirname, '../public/logo.png');
  const logoBase64 = fs.readFileSync(logoFile).toString('base64');
  const dataUri = `data:image/png;base64,${logoBase64}`;

  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoImages = [];

  for (const size of icoSizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
            img { width: 100%; height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img id="img" src="${dataUri}" />
        </body>
      </html>
    `);

    // Obtener RGBA raw
    const rgbaArray = await page.evaluate((s) => {
      const img = document.getElementById('img');
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, s, s);
      const imgData = ctx.getImageData(0, 0, s, s);
      return Array.from(imgData.data);
    }, size);

    // Convertir RGBA a BGRA para formato DIB de Windows
    const bgra = Buffer.alloc(size * size * 4);
    for (let i = 0; i < rgbaArray.length; i += 4) {
      const r = rgbaArray[i];
      const g = rgbaArray[i + 1];
      const b = rgbaArray[i + 2];
      const a = rgbaArray[i + 3];
      bgra[i] = b;     // Blue
      bgra[i + 1] = g; // Green
      bgra[i + 2] = r; // Red
      bgra[i + 3] = a; // Alpha
    }

    icoImages.push({ size, bgra });
  }

  const finalIco = createWindowsIco(icoImages);
  fs.writeFileSync(path.resolve(__dirname, '../public/favicon.ico'), finalIco);
  console.log('¡favicon.ico DIB 100% nativo de Windows creado con éxito! Tamaño:', finalIco.length);

  await browser.close();
})();
